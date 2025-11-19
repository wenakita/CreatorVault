use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};

entrypoint!(process_instruction);

// Program instructions
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum Instruction {
    /// Initialize the EAGLE OFT
    /// Accounts:
    /// 0. [writable, signer] Authority
    /// 1. [writable] Config PDA
    /// 2. [writable] Mint account
    /// 3. [] System program
    /// 4. [] Token program
    /// 5. [] Rent sysvar
    Initialize,
    
    /// Mint EAGLE tokens (relayer only)
    /// Accounts:
    /// 0. [signer] Authority
    /// 1. [] Config PDA
    /// 2. [writable] Mint account
    /// 3. [writable] Destination token account
    /// 4. [] Token program
    Mint { amount: u64 },
    
    /// Burn EAGLE tokens (anyone can burn their own)
    /// Accounts:
    /// 0. [signer] Token owner
    /// 1. [] Config PDA
    /// 2. [writable] Mint account
    /// 3. [writable] Source token account
    /// 4. [] Token program
    Burn { amount: u64 },
}

// Config account structure
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct Config {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub bump: u8,
}

// Config PDA seed
pub const CONFIG_SEED: &[u8] = b"config";

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = Instruction::try_from_slice(instruction_data)?;
    
    match instruction {
        Instruction::Initialize => process_initialize(program_id, accounts),
        Instruction::Mint { amount } => process_mint(program_id, accounts, amount),
        Instruction::Burn { amount } => process_burn(program_id, accounts, amount),
    }
}

fn process_initialize(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    
    let authority = next_account_info(accounts_iter)?;
    let config_account = next_account_info(accounts_iter)?;
    let mint_account = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    let _token_program = next_account_info(accounts_iter)?;
    let rent_sysvar = next_account_info(accounts_iter)?;
    
    if !authority.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Derive config PDA
    let (config_pda, bump) = Pubkey::find_program_address(&[CONFIG_SEED], program_id);
    if config_pda != *config_account.key {
        return Err(ProgramError::InvalidSeeds);
    }
    
    // Create config account
    let config_data = Config {
        authority: *authority.key,
        mint: *mint_account.key,
        bump,
    };
    
    let config_size = std::mem::size_of::<Config>();
    let rent = Rent::from_account_info(rent_sysvar)?;
    let lamports = rent.minimum_balance(config_size);
    
    invoke_signed(
        &system_instruction::create_account(
            authority.key,
            config_account.key,
            lamports,
            config_size as u64,
            program_id,
        ),
        &[authority.clone(), config_account.clone(), system_program.clone()],
        &[&[CONFIG_SEED, &[bump]]],
    )?;
    
    config_data.serialize(&mut &mut config_account.data.borrow_mut()[..])?;
    
    msg!("EAGLE OFT initialized");
    msg!("Mint: {}", mint_account.key);
    msg!("Authority: {}", authority.key);
    
    Ok(())
}

fn process_mint(program_id: &Pubkey, accounts: &[AccountInfo], amount: u64) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    
    let authority = next_account_info(accounts_iter)?;
    let config_account = next_account_info(accounts_iter)?;
    let mint_account = next_account_info(accounts_iter)?;
    let dest_account = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;
    
    if !authority.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify config PDA
    let (config_pda, _) = Pubkey::find_program_address(&[CONFIG_SEED], program_id);
    if config_pda != *config_account.key {
        return Err(ProgramError::InvalidSeeds);
    }
    
    // Deserialize config
    let config = Config::try_from_slice(&config_account.data.borrow())?;
    
    // Check authority
    if config.authority != *authority.key {
        return Err(ProgramError::IllegalOwner);
    }
    
    // Mint tokens
    let mint_ix = spl_token::instruction::mint_to(
        token_program.key,
        mint_account.key,
        dest_account.key,
        config_account.key,
        &[],
        amount,
    )?;
    
    invoke_signed(
        &mint_ix,
        &[
            mint_account.clone(),
            dest_account.clone(),
            config_account.clone(),
            token_program.clone(),
        ],
        &[&[CONFIG_SEED, &[config.bump]]],
    )?;
    
    msg!("Minted {} EAGLE", amount);
    Ok(())
}

fn process_burn(program_id: &Pubkey, accounts: &[AccountInfo], amount: u64) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    
    let owner = next_account_info(accounts_iter)?;
    let config_account = next_account_info(accounts_iter)?;
    let mint_account = next_account_info(accounts_iter)?;
    let source_account = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;
    
    if !owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify config PDA
    let (config_pda, _) = Pubkey::find_program_address(&[CONFIG_SEED], program_id);
    if config_pda != *config_account.key {
        return Err(ProgramError::InvalidSeeds);
    }
    
    // Burn tokens
    let burn_ix = spl_token::instruction::burn(
        token_program.key,
        source_account.key,
        mint_account.key,
        owner.key,
        &[],
        amount,
    )?;
    
    invoke_signed(
        &burn_ix,
        &[
            source_account.clone(),
            mint_account.clone(),
            owner.clone(),
            token_program.clone(),
        ],
        &[],
    )?;
    
    msg!("Burned {} EAGLE from {}", amount, owner.key);
    Ok(())
}

