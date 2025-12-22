// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

import {OApp, Origin, MessagingFee} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";

import {IveDRAGON} from "../../interfaces/governance/IveDRAGON.sol";
import {IDragonOVault} from "../../interfaces/vaults/IDragonOVault.sol";
import {IOmniDragonRegistry} from "../../interfaces/config/IOmniDragonRegistry.sol";

/**
 * @title veDRAGON
 * @author 0xakita.eth
 * @notice Vote-escrowed DRAGON for governance and gauge voting
 * @dev Lock DragonOVault vault tokens to receive voting power
 * 
 * Mechanics:
 * - Lock baseDRAGON/arbDRAGON/etc. for 1 week to 4 years
 * - Voting power decays linearly to 0 at lock end
 * - Cross-chain voting power aggregation via LayerZero
 * 
 * Lock Formula:
 * votingPower = lockedAmount * (lockEnd - now) / MAX_LOCK_DURATION
 */
contract veDRAGON is IveDRAGON, Ownable, ERC20, ERC20Permit, ERC20Votes, OApp, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using OptionsBuilder for bytes;

    // ================================
    // CONSTANTS
    // ================================

    uint256 public constant override MIN_LOCK_DURATION = 7 days;
    uint256 public constant override MAX_LOCK_DURATION = 4 * 365 days; // 4 years

    // LayerZero message types
    uint16 private constant MSG_TYPE_SYNC_VOTING_POWER = 1;

    // ================================
    // STATE
    // ================================

    /// @notice OmniDragon registry
    IOmniDragonRegistry public immutable registry;

    /// @notice The vault token this veDRAGON accepts
    address public immutable override vaultToken;

    /// @notice GaugeController address
    address public override gaugeController;

    /// @notice User locks
    mapping(address => Lock) private _locks;

    /// @notice Total voting supply (sum of all voting power)
    uint256 private _totalVotingSupply;

    /// @notice Cross-chain voting power: user -> sourceEid -> snapshot
    mapping(address => mapping(uint32 => VotingSnapshot)) private _remoteVotingPower;

    /// @notice List of remote chain EIDs we've received votes from
    mapping(address => uint32[]) private _userRemoteChains;

    // ================================
    // CONSTRUCTOR
    // ================================

    /**
     * @notice Constructor using registry for LZ endpoint (CREATE2 compatible)
     * @dev Registry must be deployed first at same address on all chains
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _vaultToken,
        address _registry,
        address _owner
    )
        ERC20(_name, _symbol)
        ERC20Permit(_name)
        OApp(IOmniDragonRegistry(_registry).getLayerZeroEndpoint(uint16(block.chainid)), _owner)
        Ownable(_owner)
    {
        require(_vaultToken != address(0), "Invalid vault token");
        require(_registry != address(0), "Invalid registry");

        vaultToken = _vaultToken;
        registry = IOmniDragonRegistry(_registry);
    }

    // ================================
    // LOCK FUNCTIONS
    // ================================

    /**
     * @notice Lock vault tokens to receive voting power
     */
    function lock(
        address _vaultToken,
        uint256 amount,
        uint256 duration
    ) external override nonReentrant returns (uint256 votingPowerAmount) {
        if (_vaultToken != vaultToken) revert InvalidVaultToken();
        if (amount == 0) revert ZeroAmount();
        if (duration < MIN_LOCK_DURATION) revert InvalidLockDuration();
        if (duration > MAX_LOCK_DURATION) revert InvalidLockDuration();
        if (_locks[msg.sender].amount > 0) revert NoExistingLock(); // Must use increaseLock

        uint256 lockEnd = block.timestamp + duration;

        // Transfer vault tokens
        IERC20(vaultToken).safeTransferFrom(msg.sender, address(this), amount);

        // Calculate voting power
        votingPowerAmount = _calculateVotingPower(amount, lockEnd);

        // Store lock
        _locks[msg.sender] = Lock({
            amount: amount,
            end: lockEnd,
            start: block.timestamp,
            vaultToken: vaultToken,
            dragonValue: _getDragonValue(amount)
        });

        // Mint veDRAGON (non-transferable representation)
        _mint(msg.sender, votingPowerAmount);
        _totalVotingSupply += votingPowerAmount;

        emit Locked(msg.sender, vaultToken, amount, lockEnd, votingPowerAmount);
    }

    /**
     * @notice Extend lock duration
     */
    function extendLock(uint256 newEnd) external override nonReentrant returns (uint256 newVotingPower) {
        Lock storage userLock = _locks[msg.sender];
        if (userLock.amount == 0) revert NoExistingLock();
        if (newEnd <= userLock.end) revert LockDurationTooShort();
        if (newEnd > block.timestamp + MAX_LOCK_DURATION) revert InvalidLockDuration();

        uint256 oldEnd = userLock.end;
        uint256 oldPower = balanceOf(msg.sender);

        // Update lock end
        userLock.end = newEnd;

        // Recalculate voting power
        newVotingPower = _calculateVotingPower(userLock.amount, newEnd);

        // Adjust veDRAGON balance
        if (newVotingPower > oldPower) {
            _mint(msg.sender, newVotingPower - oldPower);
            _totalVotingSupply += (newVotingPower - oldPower);
        }

        emit LockExtended(msg.sender, oldEnd, newEnd, newVotingPower);
    }

    /**
     * @notice Increase lock amount
     */
    function increaseLock(uint256 amount) external override nonReentrant returns (uint256 newVotingPower) {
        if (amount == 0) revert ZeroAmount();
        
        Lock storage userLock = _locks[msg.sender];
        if (userLock.amount == 0) revert NoExistingLock();
        if (block.timestamp >= userLock.end) revert LockExpired();

        uint256 oldPower = balanceOf(msg.sender);

        // Transfer additional tokens
        IERC20(vaultToken).safeTransferFrom(msg.sender, address(this), amount);

        // Update lock
        userLock.amount += amount;
        userLock.dragonValue = _getDragonValue(userLock.amount);

        // Recalculate voting power
        newVotingPower = _calculateVotingPower(userLock.amount, userLock.end);

        // Mint additional veDRAGON
        if (newVotingPower > oldPower) {
            _mint(msg.sender, newVotingPower - oldPower);
            _totalVotingSupply += (newVotingPower - oldPower);
        }

        emit LockIncreased(msg.sender, amount, userLock.amount, newVotingPower);
    }

    /**
     * @notice Unlock tokens after lock expires
     */
    function unlock() external override nonReentrant returns (uint256 amount) {
        Lock storage userLock = _locks[msg.sender];
        if (userLock.amount == 0) revert NoExistingLock();
        if (block.timestamp < userLock.end) revert LockNotExpired();

        amount = userLock.amount;
        address tokenToReturn = userLock.vaultToken;

        // Burn veDRAGON
        uint256 veBalance = balanceOf(msg.sender);
        if (veBalance > 0) {
            _burn(msg.sender, veBalance);
            _totalVotingSupply -= veBalance;
        }

        // Clear lock
        delete _locks[msg.sender];

        // Return vault tokens
        IERC20(tokenToReturn).safeTransfer(msg.sender, amount);

        emit Unlocked(msg.sender, amount, tokenToReturn);
    }

    // ================================
    // CROSS-CHAIN FUNCTIONS
    // ================================

    /**
     * @notice Broadcast voting power to hub chain
     */
    function broadcastVotingPower() external payable override {
        uint256 power = votingPower(msg.sender);
        
        // Get hub chain EID from registry
        uint32 hubEid = registry.hubChainEid();
        
        // Don't send if we're on the hub
        if (uint16(block.chainid) == registry.hubChainId()) return;

        // Encode message
        bytes memory payload = abi.encode(
            MSG_TYPE_SYNC_VOTING_POWER,
            msg.sender,
            power,
            block.timestamp
        );

        // Build options
        bytes memory options = OptionsBuilder.newOptions()
            .addExecutorLzReceiveOption(200000, 0);

        // Quote and send
        MessagingFee memory fee = _quote(hubEid, payload, options, false);
        require(msg.value >= fee.nativeFee, "Insufficient fee");

        _lzSend(hubEid, payload, options, fee, payable(msg.sender));

        emit VotingPowerSynced(msg.sender, hubEid, power);
    }

    /**
     * @notice Handle incoming cross-chain voting power sync
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32 /*_guid*/,
        bytes calldata _payload,
        address /*_executor*/,
        bytes calldata /*_extraData*/
    ) internal override {
        (
            uint16 msgType,
            address user,
            uint256 power,
            uint256 timestamp
        ) = abi.decode(_payload, (uint16, address, uint256, uint256));

        if (msgType == MSG_TYPE_SYNC_VOTING_POWER) {
            _updateRemoteVotingPower(user, _origin.srcEid, power, timestamp);
        }
    }

    function _updateRemoteVotingPower(
        address user,
        uint32 sourceEid,
        uint256 power,
        uint256 timestamp
    ) internal {
        VotingSnapshot storage snapshot = _remoteVotingPower[user][sourceEid];
        
        // Only update if newer
        if (timestamp > snapshot.timestamp) {
            // Track new chains
            if (snapshot.power == 0 && power > 0) {
                _userRemoteChains[user].push(sourceEid);
            }

            snapshot.power = power;
            snapshot.timestamp = timestamp;
            snapshot.sourceEid = sourceEid;

            emit RemoteVotingPowerReceived(user, sourceEid, power);
        }
    }

    /**
     * @notice Get total voting power (local + remote)
     */
    function getTotalVotingPower(address user) external view override returns (uint256 totalPower) {
        // Local power
        totalPower = votingPower(user);

        // Add remote powers
        uint32[] memory chains = _userRemoteChains[user];
        for (uint i = 0; i < chains.length; i++) {
            totalPower += _remoteVotingPower[user][chains[i]].power;
        }
    }

    /**
     * @notice Get voting power from a specific chain
     */
    function getChainVotingPower(address user, uint32 sourceEid) external view override returns (uint256) {
        return _remoteVotingPower[user][sourceEid].power;
    }

    // ================================
    // INTERNAL FUNCTIONS
    // ================================

    function _calculateVotingPower(uint256 amount, uint256 lockEnd) internal view returns (uint256) {
        if (block.timestamp >= lockEnd) return 0;
        
        uint256 duration = lockEnd - block.timestamp;
        // Linear: max power at MAX_LOCK_DURATION, decreases proportionally
        return (amount * duration) / MAX_LOCK_DURATION;
    }

    function _getDragonValue(uint256 vaultTokenAmount) internal view returns (uint256) {
        // Get DRAGON value from vault's pricePerShare
        return IDragonOVault(vaultToken).previewRedeem(vaultTokenAmount);
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    function getLock(address user) external view override returns (Lock memory) {
        return _locks[user];
    }

    function votingPower(address user) public view override returns (uint256) {
        Lock memory userLock = _locks[user];
        if (userLock.amount == 0) return 0;
        return _calculateVotingPower(userLock.amount, userLock.end);
    }

    function votingPowerAt(address user, uint256 timestamp) external view override returns (uint256) {
        Lock memory userLock = _locks[user];
        if (userLock.amount == 0) return 0;
        if (timestamp >= userLock.end) return 0;
        
        uint256 duration = userLock.end - timestamp;
        return (userLock.amount * duration) / MAX_LOCK_DURATION;
    }

    function totalVotingSupply() external view override returns (uint256) {
        return _totalVotingSupply;
    }

    /// @notice Get voting power for a user
    function getVotingPower(address user) external view override returns (uint256) {
        return votingPower(user);
    }

    /// @notice Get voting power at a specific timestamp
    function getVotingPowerAt(address user, uint256 timestamp) external view override returns (uint256) {
        Lock memory userLock = _locks[user];
        if (userLock.amount == 0) return 0;
        if (timestamp >= userLock.end) return 0;
        uint256 duration = userLock.end - timestamp;
        return (userLock.amount * duration) / MAX_LOCK_DURATION;
    }

    /// @notice Get total voting power
    function getTotalVotingPower() external view override returns (uint256) {
        return _totalVotingSupply;
    }

    function hasActiveLock(address user) external view override returns (bool) {
        return _locks[user].amount > 0 && block.timestamp < _locks[user].end;
    }

    // ================================
    // ADMIN
    // ================================

    function setGaugeController(address _gaugeController) external onlyOwner {
        require(_gaugeController != address(0), "Invalid address");
        gaugeController = _gaugeController;
    }

    // ================================
    // OVERRIDES (Non-transferable)
    // ================================

    /**
     * @dev veDRAGON is non-transferable
     */
    function transfer(address, uint256) public pure override(ERC20, IERC20) returns (bool) {
        revert("veDRAGON: non-transferable");
    }

    function transferFrom(address, address, uint256) public pure override(ERC20, IERC20) returns (bool) {
        revert("veDRAGON: non-transferable");
    }

    function approve(address, uint256) public pure override(ERC20, IERC20) returns (bool) {
        revert("veDRAGON: non-transferable");
    }

    // Required overrides for ERC20Votes
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }

    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}

