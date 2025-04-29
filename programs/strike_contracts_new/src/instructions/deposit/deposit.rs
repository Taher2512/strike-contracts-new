use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Token, TokenAccount, Transfer};

use crate::{CustomError, DepositEvent, MatchPool, UserDeposit};

pub fn process_deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    let match_pool = &mut ctx.accounts.match_pool;
    let clock = Clock::get()?;

    require!(match_pool.is_active, CustomError::MatchInactive);
    require!(clock.unix_timestamp < match_pool.registration_end_time, CustomError::RegistrationClosed);

    // Transfer tokens from user to pool
    let transfer_cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.pool_token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };

    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, transfer_cpi_accounts);

    transfer(cpi_ctx, amount)?;

    // Update user deposits in mapping
    let user_key = ctx.accounts.user.key();

    if let Some(user_deposit) = match_pool.deposits.iter_mut().find(|d| d.user == user_key) {
        user_deposit.amount += amount;
    } else {
        // If user doesn't exist in deposits map, add new user
        match_pool.deposits.push(UserDeposit {
            user: user_key,
            amount,
        });
    };

    match_pool.total_deposited += amount;

    emit!(DepositEvent {
        user: user_key,
        match_id: match_pool.match_id.clone(),
        amount,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"match_pool", match_pool.match_id.as_bytes()],
        bump = match_pool.bump,
    )]
    pub match_pool: Account<'info, MatchPool>,

    #[account(
        mut,
        seeds = [b"pool_token", match_pool.match_id.as_bytes()],
        bump = match_pool.token_bump,
    )]
    pub pool_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}