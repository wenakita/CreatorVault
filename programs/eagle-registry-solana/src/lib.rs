use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;

declare_id!("7wSrZXHF6BguZ1qwkXdZcNf3qyV2MPNvcztQLwrh9qPJ"); // Placeholder - will be generated on first build

#[program]
pub mod eagle_registry_solana {
    use super::*;

    /// Initialize the registry with Solana chain configuration
    /// Only the deployer can call this once
    pub fn initialize(
        ctx: Context<Initialize>,
        solana_eid: u32,
        wsol_address: Pubkey,
        lz_endpoint: Pubkey,
    ) -> Result<()> {
        let registry = &mut ctx.accounts.registry_config;
        
        registry.authority = ctx.accounts.authority.key();
        registry.solana_eid = solana_eid;
        registry.wsol_address = wsol_address;
        registry.lz_endpoint = lz_endpoint;
        registry.is_active = true;
        registry.bump = ctx.bumps.registry_config;

        msg!("Eagle Registry initialized on Solana");
        msg!("EID: {}, WSOL: {}", solana_eid, wsol_address);
        
        Ok(())
    }

    /// Update registry configuration
    /// Only the authority can call this
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_endpoint: Option<Pubkey>,
        is_active: Option<bool>,
    ) -> Result<()> {
        let registry = &mut ctx.accounts.registry_config;

        if let Some(endpoint) = new_endpoint {
            registry.lz_endpoint = endpoint;
            msg!("Updated LayerZero endpoint: {}", endpoint);
        }

        if let Some(active) = is_active {
            registry.is_active = active;
            msg!("Updated active status: {}", active);
        }

        Ok(())
    }

    /// Register a new EVM chain that can send messages to Solana
    /// This stores minimal metadata about cross-chain peers
    pub fn register_peer_chain(
        ctx: Context<RegisterPeerChain>,
        chain_eid: u32,
        chain_name: String,
        peer_address: [u8; 32], // bytes32 address on EVM
    ) -> Result<()> {
        require!(chain_name.len() <= 32, ErrorCode::NameTooLong);

        let peer_config = &mut ctx.accounts.peer_config;
        
        peer_config.chain_eid = chain_eid;
        peer_config.chain_name = chain_name.clone();
        peer_config.peer_address = peer_address;
        peer_config.is_active = true;
        peer_config.bump = ctx.bumps.peer_config;

        msg!("Registered peer chain: {} (EID: {})", chain_name, chain_eid);
        
        Ok(())
    }

    /// Handle incoming LayerZero message from EVM chains
    /// This would integrate with LayerZero's OApp receive pattern
    /// NOTE: This is a simplified version - full integration requires LayerZero SDK
    pub fn lz_receive(
        ctx: Context<LzReceive>,
        src_eid: u32,
        sender: [u8; 32],
        nonce: u64,
        guid: [u8; 32],
        message: Vec<u8>,
    ) -> Result<()> {
        let registry = &ctx.accounts.registry_config;
        
        require!(registry.is_active, ErrorCode::RegistryInactive);
        
        // Verify the peer is registered
        let peer = &ctx.accounts.peer_config;
        require!(peer.chain_eid == src_eid, ErrorCode::UnknownPeer);
        require!(peer.peer_address == sender, ErrorCode::InvalidSender);
        require!(peer.is_active, ErrorCode::PeerInactive);

        // Decode and process message
        // Message format (example): [action_type(1), data(...)]
        if message.is_empty() {
            return Err(ErrorCode::EmptyMessage.into());
        }

        let action_type = message[0];
        
        match action_type {
            0 => {
                // Action 0: Sync chain data
                msg!("Received chain data sync from EID: {}", src_eid);
                // Process sync data...
            },
            1 => {
                // Action 1: Update configuration
                msg!("Received config update from EID: {}", src_eid);
                // Process config update...
            },
            _ => {
                msg!("Unknown action type: {}", action_type);
                return Err(ErrorCode::UnknownAction.into());
            }
        }

        emit!(MessageReceived {
            src_eid,
            sender,
            nonce,
            guid,
        });

        Ok(())
    }

    /// Send a cross-chain query to an EVM registry
    /// NOTE: This requires integration with LayerZero's send pattern
    /// Placeholder for future implementation
    pub fn send_query(
        ctx: Context<SendQuery>,
        dst_eid: u32,
        query_type: u8,
        query_data: Vec<u8>,
    ) -> Result<()> {
        let registry = &ctx.accounts.registry_config;
        
        require!(registry.is_active, ErrorCode::RegistryInactive);

        let peer = &ctx.accounts.peer_config;
        require!(peer.chain_eid == dst_eid, ErrorCode::UnknownPeer);
        require!(peer.is_active, ErrorCode::PeerInactive);

        // Build message payload
        let mut message = vec![query_type];
        message.extend_from_slice(&query_data);

        msg!("Sending query to EID: {}, type: {}", dst_eid, query_type);
        
        // TODO: Integrate with LayerZero endpoint to actually send
        // This would call the LayerZero endpoint program with proper CPIs
        
        emit!(QuerySent {
            dst_eid,
            query_type,
        });

        Ok(())
    }
}

// ============================================================================
// Account Structures
// ============================================================================

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + RegistryConfig::INIT_SPACE,
        seeds = [b"registry"],
        bump
    )]
    pub registry_config: Account<'info, RegistryConfig>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [b"registry"],
        bump = registry_config.bump,
        has_one = authority,
    )]
    pub registry_config: Account<'info, RegistryConfig>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(chain_eid: u32)]
pub struct RegisterPeerChain<'info> {
    #[account(
        seeds = [b"registry"],
        bump = registry_config.bump,
        has_one = authority,
    )]
    pub registry_config: Account<'info, RegistryConfig>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + PeerChainConfig::INIT_SPACE,
        seeds = [b"peer", &chain_eid.to_le_bytes()],
        bump
    )]
    pub peer_config: Account<'info, PeerChainConfig>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(src_eid: u32)]
pub struct LzReceive<'info> {
    #[account(
        seeds = [b"registry"],
        bump = registry_config.bump,
    )]
    pub registry_config: Account<'info, RegistryConfig>,
    
    #[account(
        seeds = [b"peer", &src_eid.to_le_bytes()],
        bump = peer_config.bump,
    )]
    pub peer_config: Account<'info, PeerChainConfig>,
    
    /// The LayerZero endpoint program would be invoked here
    /// CHECK: This would be validated against registry_config.lz_endpoint
    pub lz_endpoint: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(dst_eid: u32)]
pub struct SendQuery<'info> {
    #[account(
        seeds = [b"registry"],
        bump = registry_config.bump,
    )]
    pub registry_config: Account<'info, RegistryConfig>,
    
    #[account(
        seeds = [b"peer", &dst_eid.to_le_bytes()],
        bump = peer_config.bump,
    )]
    pub peer_config: Account<'info, PeerChainConfig>,
    
    /// CHECK: This would be validated against registry_config.lz_endpoint
    pub lz_endpoint: AccountInfo<'info>,
    
    pub authority: Signer<'info>,
}

// ============================================================================
// State Accounts
// ============================================================================

#[account]
#[derive(InitSpace)]
pub struct RegistryConfig {
    /// The authority that can update the registry
    pub authority: Pubkey,
    
    /// Solana's LayerZero Endpoint ID
    pub solana_eid: u32,
    
    /// Wrapped SOL token address
    pub wsol_address: Pubkey,
    
    /// LayerZero endpoint program on Solana
    pub lz_endpoint: Pubkey,
    
    /// Whether the registry is active
    pub is_active: bool,
    
    /// PDA bump
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PeerChainConfig {
    /// The EID of the peer chain (e.g., 30101 for Ethereum)
    pub chain_eid: u32,
    
    /// Name of the peer chain (e.g., "Ethereum")
    #[max_len(32)]
    pub chain_name: String,
    
    /// The address of the EagleRegistry contract on the peer chain
    /// (32 bytes to match Solidity bytes32/address)
    pub peer_address: [u8; 32],
    
    /// Whether this peer is active
    pub is_active: bool,
    
    /// PDA bump
    pub bump: u8,
}

// ============================================================================
// Events
// ============================================================================

#[event]
pub struct MessageReceived {
    pub src_eid: u32,
    pub sender: [u8; 32],
    pub nonce: u64,
    pub guid: [u8; 32],
}

#[event]
pub struct QuerySent {
    pub dst_eid: u32,
    pub query_type: u8,
}

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum ErrorCode {
    #[msg("Registry is not active")]
    RegistryInactive,
    
    #[msg("Unknown peer chain")]
    UnknownPeer,
    
    #[msg("Peer chain is not active")]
    PeerInactive,
    
    #[msg("Invalid sender address")]
    InvalidSender,
    
    #[msg("Empty message received")]
    EmptyMessage,
    
    #[msg("Unknown action type")]
    UnknownAction,
    
    #[msg("Chain name too long (max 32 characters)")]
    NameTooLong,
}

