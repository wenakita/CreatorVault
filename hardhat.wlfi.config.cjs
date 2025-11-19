require('dotenv').config()
require('@nomicfoundation/hardhat-ethers')
require('hardhat-deploy')
require('@layerzerolabs/toolbox-hardhat')

module.exports = {
    solidity: {
        version: '0.8.22',
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        'ethereum-mainnet': {
            eid: 30101,
            url: process.env.ETHEREUM_RPC_URL || '',
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        },
        'base-mainnet': {
            eid: 30184,
            url: process.env.BASE_RPC_URL || '',
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        },
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
    },
    paths: {
        deployments: 'deployments',
    },
    external: {
        deployments: {
            'ethereum-mainnet': ['deployments/ethereum'],
            'base-mainnet': ['deployments/base'],
        },
    },
}

