use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo, Burn};

declare_id!("11111111111111111111111111111112"); // Will be updated after deployment

#[program]
pub mod eagle_share_oft {
    use super::*;

    /// Initialize the EAGLE OFT token
    pub fn initialize(
        ctx: Context<Initialize>,
        decimals: u8,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.mint = ctx.accounts.mint.key();
        config.decimals = decimals;
        config.bump = ctx.bumps.config;
        
        msg!("EAGLE Share OFT initialized");
        msg!("Mint: {}", ctx.accounts.mint.key());
        msg!("Decimals: {}", decimals);
        
        Ok(())
    }

    /// Mint EAGLE shares (for bridging IN from other chains)
    pub fn mint(
        ctx: Context<MintTokens>,
        amount: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.config.authority,
            OftError::Unauthorized
        );

        let seeds = &[
            b"config",
            &[ctx.accounts.config.bump],
        ];
        let signer = &[&seeds[..]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.to.to_account_info(),
                    authority: ctx.accounts.config.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        msg!("Minted {} EAGLE shares to {}", amount, ctx.accounts.to.key());
        
        Ok(())
    }

    /// Burn EAGLE shares (for bridging OUT to other chains)
    pub fn burn(
        ctx: Context<BurnTokens>,
        amount: u64,
    ) -> Result<()> {
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.mint.to_account_info(),
                    from: ctx.accounts.from.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            amount,
        )?;

        msg!("Burned {} EAGLE shares from {}", amount, ctx.accounts.from.key());
        
        Ok(())
    }

    /// Bridge EAGLE shares to another chain via LayerZero
    pub fn bridge_out(
        ctx: Context<BridgeOut>,
        amount: u64,
        destination_chain_id: u32,
        recipient: [u8; 32],
    ) -> Result<()> {
        // Burn tokens on Solana
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.mint.to_account_info(),
                    from: ctx.accounts.from.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            amount,
        )?;

        msg!("Bridging {} EAGLE shares to chain {}", amount, destination_chain_id);
        msg!("Recipient: {:?}", recipient);
        
        // TODO: Integrate LayerZero messaging here
        // For now, just emit event for off-chain relayer
        
        Ok(())
    }

    /// Receive EAGLE shares from another chain via LayerZero
    pub fn bridge_in(
        ctx: Context<BridgeIn>,
        amount: u64,
        _source_chain_id: u32,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.config.authority,
            OftError::Unauthorized
        );

        let seeds = &[
            b"config",
            &[ctx.accounts.config.bump],
        ];
        let signer = &[&seeds[..]];

        // Mint tokens on Solana
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.to.to_account_info(),
                    authority: ctx.accounts.config.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        msg!("Bridged in {} EAGLE shares", amount);
        
        Ok(())
    }
}

// ============================================================================
// Account Structs
// ============================================================================

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + OftConfig::LEN,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, OftConfig>,
    
    #[account(
        init,
        payer = authority,
        mint::decimals = 9,
        mint::authority = config,
    )]
    pub mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, OftConfig>,
    
    #[account(
        mut,
        address = config.mint
    )]
    pub mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,
    
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, OftConfig>,
    
    #[account(
        mut,
        address = config.mint
    )]
    pub mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub from: Account<'info, TokenAccount>,
    
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BridgeOut<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, OftConfig>,
    
    #[account(
        mut,
        address = config.mint
    )]
    pub mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub from: Account<'info, TokenAccount>,
    
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BridgeIn<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, OftConfig>,
    
    #[account(
        mut,
        address = config.mint
    )]
    pub mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,
    
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// ============================================================================
// State
// ============================================================================

#[account]
pub struct OftConfig {
    pub authority: Pubkey,     // 32 bytes
    pub mint: Pubkey,          // 32 bytes
    pub decimals: u8,          // 1 byte
    pub bump: u8,              // 1 byte
}

impl OftConfig {
    pub const LEN: usize = 32 + 32 + 1 + 1; // Total: 66 bytes
}

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum OftError {
    #[msg("Unauthorized: Only authority can perform this action")]
    Unauthorized,
    
    #[msg("Invalid amount: Amount must be greater than zero")]
    InvalidAmount,
    
    #[msg("Invalid chain ID")]
    InvalidChainId,
}

