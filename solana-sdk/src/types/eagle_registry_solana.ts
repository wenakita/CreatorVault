/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/eagle_registry_solana.json`.
 */
export type EagleRegistrySolana = {
  address: string;
  metadata: {
    name: "eagleRegistrySolana";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Eagle Registry Solana Adapter for LayerZero V2 Cross-Chain Messaging";
  };
  instructions: [
    {
      name: "initialize";
      discriminator: [175, 175, 109, 31, 13, 152, 155, 237];
      accounts: [
        {
          name: "registryConfig";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [114, 101, 103, 105, 115, 116, 114, 121];
              }
            ];
          };
        },
        {
          name: "authority";
          writable: true;
          signer: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111112";
        }
      ];
      args: [
        {
          name: "solanaEid";
          type: "u32";
        },
        {
          name: "wsolAddress";
          type: "pubkey";
        },
        {
          name: "lzEndpoint";
          type: "pubkey";
        }
      ];
    },
    {
      name: "updateConfig";
      discriminator: [29, 158, 252, 191, 10, 83, 219, 99];
      accounts: [
        {
          name: "registryConfig";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [114, 101, 103, 105, 115, 116, 114, 121];
              }
            ];
          };
        },
        {
          name: "authority";
          signer: true;
        }
      ];
      args: [
        {
          name: "newEndpoint";
          type: {
            option: "pubkey";
          };
        },
        {
          name: "isActive";
          type: {
            option: "bool";
          };
        }
      ];
    },
    {
      name: "registerPeerChain";
      discriminator: [198, 51, 53, 241, 155, 125, 114, 230];
      accounts: [
        {
          name: "registryConfig";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [114, 101, 103, 105, 115, 116, 114, 121];
              }
            ];
          };
        },
        {
          name: "peerConfig";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 101, 101, 114];
              },
              {
                kind: "arg";
                path: "chainEid";
              }
            ];
          };
        },
        {
          name: "authority";
          writable: true;
          signer: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111112";
        }
      ];
      args: [
        {
          name: "chainEid";
          type: "u32";
        },
        {
          name: "chainName";
          type: "string";
        },
        {
          name: "peerAddress";
          type: {
            array: ["u8", 32];
          };
        }
      ];
    },
    {
      name: "lzReceive";
      discriminator: [28, 34, 30, 82, 80, 239, 155, 252];
      accounts: [
        {
          name: "registryConfig";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [114, 101, 103, 105, 115, 116, 114, 121];
              }
            ];
          };
        },
        {
          name: "peerConfig";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 101, 101, 114];
              },
              {
                kind: "arg";
                path: "srcEid";
              }
            ];
          };
        },
        {
          name: "lzEndpoint";
        }
      ];
      args: [
        {
          name: "srcEid";
          type: "u32";
        },
        {
          name: "sender";
          type: {
            array: ["u8", 32];
          };
        },
        {
          name: "nonce";
          type: "u64";
        },
        {
          name: "guid";
          type: {
            array: ["u8", 32];
          };
        },
        {
          name: "message";
          type: {
            vec: "u8";
          };
        }
      ];
    },
    {
      name: "sendQuery";
      discriminator: [95, 112, 107, 71, 30, 244, 172, 157];
      accounts: [
        {
          name: "registryConfig";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [114, 101, 103, 105, 115, 116, 114, 121];
              }
            ];
          };
        },
        {
          name: "peerConfig";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [112, 101, 101, 114];
              },
              {
                kind: "arg";
                path: "dstEid";
              }
            ];
          };
        },
        {
          name: "lzEndpoint";
        },
        {
          name: "authority";
          signer: true;
        }
      ];
      args: [
        {
          name: "dstEid";
          type: "u32";
        },
        {
          name: "queryType";
          type: "u8";
        },
        {
          name: "queryData";
          type: {
            vec: "u8";
          };
        }
      ];
    }
  ];
  accounts: [
    {
      name: "registryConfig";
      discriminator: [155, 234, 173, 219, 105, 23, 199, 85];
    },
    {
      name: "peerChainConfig";
      discriminator: [141, 188, 168, 215, 63, 144, 131, 221];
    }
  ];
  events: [
    {
      name: "messageReceived";
      discriminator: [160, 203, 233, 44, 49, 176, 30, 126];
    },
    {
      name: "querySent";
      discriminator: [234, 120, 216, 254, 44, 141, 17, 153];
    }
  ];
  errors: [
    {
      code: 6000;
      name: "registryInactive";
      msg: "Registry is not active";
    },
    {
      code: 6001;
      name: "unknownPeer";
      msg: "Unknown peer chain";
    },
    {
      code: 6002;
      name: "peerInactive";
      msg: "Peer chain is not active";
    },
    {
      code: 6003;
      name: "invalidSender";
      msg: "Invalid sender address";
    },
    {
      code: 6004;
      name: "emptyMessage";
      msg: "Empty message received";
    },
    {
      code: 6005;
      name: "unknownAction";
      msg: "Unknown action type";
    },
    {
      code: 6006;
      name: "nameTooLong";
      msg: "Chain name too long (max 32 characters)";
    }
  ];
  types: [
    {
      name: "registryConfig";
      type: {
        kind: "struct";
        fields: [
          {
            name: "authority";
            type: "pubkey";
          },
          {
            name: "solanaEid";
            type: "u32";
          },
          {
            name: "wsolAddress";
            type: "pubkey";
          },
          {
            name: "lzEndpoint";
            type: "pubkey";
          },
          {
            name: "isActive";
            type: "bool";
          },
          {
            name: "bump";
            type: "u8";
          }
        ];
      };
    },
    {
      name: "peerChainConfig";
      type: {
        kind: "struct";
        fields: [
          {
            name: "chainEid";
            type: "u32";
          },
          {
            name: "chainName";
            type: "string";
          },
          {
            name: "peerAddress";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "isActive";
            type: "bool";
          },
          {
            name: "bump";
            type: "u8";
          }
        ];
      };
    },
    {
      name: "messageReceived";
      type: {
        kind: "struct";
        fields: [
          {
            name: "srcEid";
            type: "u32";
          },
          {
            name: "sender";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "nonce";
            type: "u64";
          },
          {
            name: "guid";
            type: {
              array: ["u8", 32];
            };
          }
        ];
      };
    },
    {
      name: "querySent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "dstEid";
            type: "u32";
          },
          {
            name: "queryType";
            type: "u8";
          }
        ];
      };
    }
  ];
};

