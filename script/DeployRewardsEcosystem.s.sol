// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

import {VaultGaugeVoting} from "../contracts/governance/VaultGaugeVoting.sol";
import {VoterRewardsDistributor} from "../contracts/governance/VoterRewardsDistributor.sol";
import {BribesFactory} from "../contracts/factories/BribesFactory.sol";
import {ve4626} from "../contracts/governance/ve4626.sol";
import {ve4626BoostManager} from "../contracts/governance/ve4626BoostManager.sol";

interface ICreatorLotteryManagerForRewards {
    function setBoostManager(address manager) external;
    function setVaultGaugeVoting(address vaultGaugeVoting) external;
}

interface ICreatorRegistryForRewards {
    function getAllCreatorCoins() external view returns (address[] memory);
    function getGaugeControllerForToken(address token) external view returns (address);
}

interface ICreatorGaugeControllerForRewards {
    function setVaultGaugeVoting(address voting) external;
    function setVoterRewardsDistributor(address distributor) external;
}

/**
 * @notice Deploys + wires the ve(3,3) rewards ecosystem:
 * - ve4626 (vote-escrow token)
 * - ve4626BoostManager (personal lottery boost)
 * - VaultGaugeVoting (weekly gauge voting)
 * - VoterRewardsDistributor (routes the 9.61% slice to voters)
 * - BribesFactory (CREATE2 BribeDepot per vault)
 *
 * Wiring:
 * - ve4626.setBoostManager(boostManager)
 * - lotteryManager.setBoostManager(boostManager)
 * - lotteryManager.setVaultGaugeVoting(vaultGaugeVoting)
 * - each CreatorGaugeController: setVaultGaugeVoting + setVoterRewardsDistributor
 *
 * Run (broadcast):
 *   export BASE_RPC_URL="https://mainnet.base.org"
 *   forge script script/DeployRewardsEcosystem.s.sol:DeployRewardsEcosystem --rpc-url "$BASE_RPC_URL" --broadcast -vvvv
 *
 * Env:
 *   PRIVATE_KEY=...
 *   OWNER=...                        (default: broadcaster)
 *   REGISTRY=0x...                    (default: Base registry)
 *   LOTTERY_MANAGER=0x...             (default: Base lottery manager)
 *   PROTOCOL_TREASURY=0x...           (default: Base protocol treasury)
 *   WRAPPED_SHARE_OFT=0x...           (required)  ■4626 token to lock in ve4626
 *
 * Optional:
 *   WIRE_EXISTING_GAUGES=1|0          (default: 1)
 *   SET_VOTING_REGISTRY_WHITELIST=1|0 (default: 1)
 *   VE_NAME="Vote-Escrowed ■4626"
 *   VE_SYMBOL="ve■4626"
 */
contract DeployRewardsEcosystem is Script {
    address constant DEFAULT_REGISTRY = 0x02c8031c39E10832A831b954Df7a2c1bf9Df052D;
    address constant DEFAULT_LOTTERY_MANAGER = 0xA02A858E67c98320dCFB218831B645692E8f3483;
    address constant DEFAULT_PROTOCOL_TREASURY = 0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);

        address owner = vm.envOr("OWNER", broadcaster);
        address registry = vm.envOr("REGISTRY", DEFAULT_REGISTRY);
        address lotteryManager = vm.envOr("LOTTERY_MANAGER", DEFAULT_LOTTERY_MANAGER);
        address protocolTreasury = vm.envOr("PROTOCOL_TREASURY", DEFAULT_PROTOCOL_TREASURY);
        address wrappedShareOFT = vm.envAddress("WRAPPED_SHARE_OFT");

        bool wireExistingGauges = vm.envOr("WIRE_EXISTING_GAUGES", uint256(1)) == 1;
        bool setRegistryWhitelist = vm.envOr("SET_VOTING_REGISTRY_WHITELIST", uint256(1)) == 1;

        string memory veName = vm.envOr("VE_NAME", string("Vote-Escrowed \u25A04626"));
        string memory veSymbol = vm.envOr("VE_SYMBOL", string("ve\u25A04626"));

        console2.log("Broadcaster:", broadcaster);
        console2.log("Owner:", owner);
        console2.log("Registry:", registry);
        console2.log("LotteryManager:", lotteryManager);
        console2.log("ProtocolTreasury (sweep target):", protocolTreasury);
        console2.log("WRAPPED_SHARE_OFT:", wrappedShareOFT);

        vm.startBroadcast(pk);

        console2.log("\nDeploy ve4626...");
        ve4626 ve = new ve4626(veName, veSymbol, wrappedShareOFT, owner);
        console2.log("ve4626:", address(ve));

        console2.log("\nDeploy ve4626BoostManager...");
        ve4626BoostManager boostManager = new ve4626BoostManager(address(ve), owner);
        console2.log("veBoostManager:", address(boostManager));

        console2.log("\nDeploy VaultGaugeVoting...");
        VaultGaugeVoting voting = new VaultGaugeVoting(address(ve), owner);
        console2.log("VaultGaugeVoting:", address(voting));

        if (setRegistryWhitelist) {
            console2.log("\nConfigure VaultGaugeVoting registry whitelist...");
            voting.setRegistry(registry);
            voting.setUseRegistryWhitelist(true);
        }

        console2.log("\nDeploy VoterRewardsDistributor...");
        VoterRewardsDistributor rewards = new VoterRewardsDistributor(address(voting), owner);
        rewards.setProtocolTreasury(protocolTreasury);
        console2.log("VoterRewardsDistributor:", address(rewards));

        console2.log("\nDeploy BribesFactory...");
        BribesFactory bribesFactory = new BribesFactory(address(voting));
        console2.log("BribesFactory:", address(bribesFactory));

        console2.log("\nWire ve4626 -> boostManager...");
        ve.setBoostManager(address(boostManager));

        console2.log("\nWire CreatorLotteryManager -> boostManager + gauge voting...");
        ICreatorLotteryManagerForRewards(lotteryManager).setBoostManager(address(boostManager));
        ICreatorLotteryManagerForRewards(lotteryManager).setVaultGaugeVoting(address(voting));

        if (wireExistingGauges) {
            console2.log("\nWire existing CreatorGaugeControllers (set voting + rewards distributor)...");
            address[] memory tokens = ICreatorRegistryForRewards(registry).getAllCreatorCoins();
            for (uint256 i = 0; i < tokens.length; i++) {
                address gauge = ICreatorRegistryForRewards(registry).getGaugeControllerForToken(tokens[i]);
                if (gauge == address(0)) continue;
                // These setters are owner-only on the gauge controller (protocol treasury owner).
                // This script must be broadcast by the gauge owner to succeed.
                ICreatorGaugeControllerForRewards(gauge).setVaultGaugeVoting(address(voting));
                ICreatorGaugeControllerForRewards(gauge).setVoterRewardsDistributor(address(rewards));
            }
            console2.log("Wired gauges for token count:", tokens.length);
        }

        vm.stopBroadcast();

        console2.log("\n=== SUMMARY ===");
        console2.log("ve4626:", address(ve));
        console2.log("veBoostManager:", address(boostManager));
        console2.log("VaultGaugeVoting:", address(voting));
        console2.log("VoterRewardsDistributor:", address(rewards));
        console2.log("BribesFactory:", address(bribesFactory));
    }
}

