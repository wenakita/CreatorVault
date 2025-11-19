import { EndpointId } from '@layerzerolabs/lz-definitions'
import { ExecutorOptionType } from '@layerzerolabs/lz-v2-utilities'

// LayerZero config for WLFI OFT Bridge (Ethereum ↔ Base)

const ETHEREUM_EID = EndpointId.ETHEREUM_V2_MAINNET // 30101
const BASE_EID = EndpointId.BASE_V2_MAINNET // 30184

// Contract addresses
const WLFI_ADAPTER_ETHEREUM = '0x2437F6555350c131647daA0C655c4B49A7aF3621'
const WLFI_OFT_BASE = '0x47af3595BFBE6c86E59a13d5db91AEfbFF0eA91e'

const ethereumContract = {
    eid: ETHEREUM_EID,
    contractName: 'WLFIOFTAdapter',
    address: WLFI_ADAPTER_ETHEREUM,
}

const baseContract = {
    eid: BASE_EID,
    contractName: 'WLFIOFT',
    address: WLFI_OFT_BASE,
}

export default {
    contracts: [
        { contract: ethereumContract },
        { contract: baseContract },
    ],
    connections: [
        // Ethereum → Base
        {
            from: ethereumContract,
            to: baseContract,
            config: {
                sendLibrary: '0xbB2Ea70C9E858123480642Cf96acbcCE1372dCe1',
                receiveLibraryConfig: {
                    receiveLibrary: '0xc02Ab410f0734EFa3F14628780e6e695156024C2',
                    gracePeriod: 0,
                },
                sendConfig: {
                    executorConfig: {
                        maxMessageSize: 10000,
                        executor: '0x173272739Bd7Aa6e4e214714048a9fE699453059',
                    },
                    ulnConfig: {
                        confirmations: 15,
                        requiredDVNs: [
                            '0x589dedbd617e0cbcb916a9223f4d1300c294236b', // LayerZero DVN
                            '0xd56e4eab23cb81f43168f9f45211eb027b9ac7cc', // Google Cloud DVN
                        ],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
                receiveConfig: {
                    ulnConfig: {
                        confirmations: 15,
                        requiredDVNs: [
                            '0x9e059a54699a285714207b43b055483e78faac25', // LayerZero DVN (Base)
                            '0xd56e4eab23cb81f43168f9f45211eb027b9ac7cc', // Google Cloud DVN
                        ],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
                enforcedOptions: [
                    {
                        msgType: 1,
                        optionType: ExecutorOptionType.LZ_RECEIVE,
                        gas: 200000,
                        value: 0,
                    },
                ],
            },
        },
        // Base → Ethereum
        {
            from: baseContract,
            to: ethereumContract,
            config: {
                sendLibrary: '0xB5320B0B3a13cC860893E2Bd79FCd7e13484Dda2',
                receiveLibraryConfig: {
                    receiveLibrary: '0xc02Ab410f0734EFa3F14628780e6e695156024C2',
                    gracePeriod: 0,
                },
                sendConfig: {
                    executorConfig: {
                        maxMessageSize: 10000,
                        executor: '0x2CCA08ae69E0C44b18A57Ab2A87644234dAeBaE4',
                    },
                    ulnConfig: {
                        confirmations: 5,
                        requiredDVNs: [
                            '0x9e059a54699a285714207b43b055483e78faac25', // LayerZero DVN
                            '0xd56e4eab23cb81f43168f9f45211eb027b9ac7cc', // Google Cloud DVN
                        ],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
                receiveConfig: {
                    ulnConfig: {
                        confirmations: 5,
                        requiredDVNs: [
                            '0x589dedbd617e0cbcb916a9223f4d1300c294236b', // LayerZero DVN (Ethereum)
                            '0xd56e4eab23cb81f43168f9f45211eb027b9ac7cc', // Google Cloud DVN
                        ],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
                enforcedOptions: [
                    {
                        msgType: 1,
                        optionType: ExecutorOptionType.LZ_RECEIVE,
                        gas: 200000,
                        value: 0,
                    },
                ],
            },
        },
    ],
}

