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

    for prize in prize_distributions {
        if prize.amount <= 0 {
            continue;
        }

        let winner_key = prize.user;
        
        // Find the winner's token account
        let mut winner_account_found = false;
        for account in remaining_accounts {
            if account.owner == &token::ID {
                // Try to deserialize as token account
                if let Ok(token_account) = TokenAccount::try_deserialize(&mut &account.data.borrow()[..]) {
                    if token_account.owner == winner_key {
                        // Found the right account, transfer tokens
                        let transfer_cpi_accounts = Transfer {
                            from: pool_token_info.clone(),
                            to: account.clone(),
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
                        
                        winner_account_found = true;
                        break;
                    }
                }
            }
        }
        
        if !winner_account_found {
            msg!("Winner account not found for {}", winner_key);
            // Skip if account not found
            continue;
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