use anchor_lang::prelude::*;
use anchor_spl::token::{self, transfer, Token, TokenAccount, Transfer};

use crate::{error::CustomError, MatchPool, PrizeDistributedEvent};

pub fn process_distribute_prizes<'a, 'b, 'c, 'info>(
    ctx: Context<'a, 'b, 'c, 'info, DistributePrizes<'info>>,
    prize_distributions: Vec<PrizeDistribution>,
) -> Result<()> {
    let match_pool = &mut ctx.accounts.match_pool;

    require!(!match_pool.is_active, CustomError::MatchStillActive);
    require!(!match_pool.is_finalized, CustomError::MatchAlreadyFinalized);

    let mut total_distribution: u64 = 0;
    for distribution in prize_distributions.iter() {
        total_distribution += distribution.amount;
    }

    require!(total_distribution <= match_pool.total_deposited, CustomError::InsufficientPoolFunds);

    let remaining_accounts = ctx.remaining_accounts;
    let pool_token_info = ctx.accounts.pool_token_account.to_account_info();
    let match_pool_info = match_pool.to_account_info();
    let token_program_info = ctx.accounts.token_program.to_account_info();

    let seeds = &[
        b"match_pool",
        match_pool.match_id.as_bytes(),
        &[match_pool.bump],
    ];
    let signer = &[&seeds[..]];
    
    // Process all token accounts first to map users to their token accounts
    let mut user_token_accounts = std::collections::HashMap::new();
    
    for account in remaining_accounts.iter() {
        if account.owner == &token::ID {
            // Create a copy of the data that we can deserialize
            let data = account.data.borrow();
            if let Ok(token_account) = TokenAccount::try_deserialize(&mut &data[..]) {
                user_token_accounts.insert(token_account.owner, account);
            }
        }
    }
    
    // Now process the prizes without borrowing the same account multiple times
    for prize in prize_distributions {
        if prize.amount <= 0 {
            continue;
        }

        let winner_key = prize.user;
        
        if let Some(winner_account) = user_token_accounts.get(&winner_key) {
            // Found the right account, transfer tokens
            let transfer_cpi_accounts = Transfer {
                from: pool_token_info.clone(),
                to: (*winner_account).clone(),
                authority: match_pool_info.clone(),
            };
            
            let cpi_ctx = CpiContext::new_with_signer(
                token_program_info.clone(),
                transfer_cpi_accounts,
                signer,
            );
            
            transfer(cpi_ctx, prize.amount)?;
            
            emit!(PrizeDistributedEvent {
                user: winner_key,
                match_id: match_pool.match_id.clone(),
                amount: prize.amount,
            });
        } else {
            msg!("Winner account not found for {}", winner_key);
            // Skip if account not found
        }
    }

    match_pool.is_finalized = true;

    Ok(())
}

#[derive(Accounts)]
pub struct DistributePrizes<'info> {
    #[account(
        mut,
        seeds = [b"match_pool", match_pool.match_id.as_bytes()],
        bump = match_pool.bump,
        constraint = match_pool.admin == admin.key() @ CustomError::Unauthorized,
    )]
    pub match_pool: Account<'info, MatchPool>,

    #[account(
        mut,
        seeds = [b"pool_token", match_pool.match_id.as_bytes()],
        bump = match_pool.token_bump,
    )]
    pub pool_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct PrizeDistribution {
    pub user: Pubkey,
    pub amount: u64,
}