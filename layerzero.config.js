// LayerZero OApp Configuration for Eagle OVault (JavaScript)
// Static configuration for Ethereum ↔ Base connections

const { ExecutorOptionType } = require('@layerzerolabs/lz-v2-utilities')

const ETHEREUM_EID = 30101
const BASE_EID = 30184

const ETHEREUM_CONTRACT = {
    eid: ETHEREUM_EID,
    contractName: 'OFT',
}

const BASE_CONTRACT = {
    eid: BASE_EID,
    contractName: 'OFT',
}

module.exports = {
    contracts: [
        {
            contract: ETHEREUM_CONTRACT,
        },
        {
            contract: BASE_CONTRACT,
        },
    ],
    connections: [
        {
            from: ETHEREUM_CONTRACT,
            to: BASE_CONTRACT,
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
                        requiredDVNs: ['0x589dedbd617e0cbcb916a9223f4d1300c294236b'],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
                receiveConfig: {
                    ulnConfig: {
                        confirmations: 15,
                        requiredDVNs: ['0x9e059a54699a285714207b43b055483e78faac25'],
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
        {
            from: BASE_CONTRACT,
            to: ETHEREUM_CONTRACT,
            config: {
                sendLibrary: '0xB5320B0B3a13cC860893E2Bd79FCd7e13484Dda2',
                receiveLibraryConfig: {
                    receiveLibrary: '0xc70AB6f32772f59fBfc23889Caf4Ba3376C84bAf',
                    gracePeriod: 0,
                },
                sendConfig: {
                    executorConfig: {
                        maxMessageSize: 10000,
                        executor: '0x2CCA08ae69E0C44b18a57Ab2A87644234dAebaE4',
                    },
                    ulnConfig: {
                        confirmations: 15,
                        requiredDVNs: ['0x9e059a54699a285714207b43b055483e78faac25'],
                        optionalDVNs: [],
                        optionalDVNThreshold: 0,
                    },
                },
                receiveConfig: {
                    ulnConfig: {
                        confirmations: 15,
                        requiredDVNs: ['0x589dedbd617e0cbcb916a9223f4d1300c294236b'],
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

