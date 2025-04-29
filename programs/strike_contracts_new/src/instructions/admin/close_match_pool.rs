use anchor_lang::prelude::*;

use anchor_spl::token::{Token, TokenAccount};

use crate::{CustomError, MatchPool};

pub fn process_close_match_pool(ctx: Context<CloseMatchPool>) -> Result<()> {
    let match_pool = &ctx.accounts.match_pool;

    require!(match_pool.is_finalized, CustomError::MatchNotFinalized);

    Ok(())
}

#[derive(Accounts)]
pub struct CloseMatchPool<'info> {
    #[account(
        mut,
        seeds = [b"match_pool", match_pool.match_id.as_bytes()],
        bump = match_pool.bump,
        constraint = match_pool.admin == admin.key() @ CustomError::Unauthorized,
        close = admin
    )]
    pub match_pool: Account<'info, MatchPool>,
    
    #[account(
        mut,
        seeds = [b"pool_token", match_pool.match_id.as_bytes()],
        bump = match_pool.token_bump,
        constraint = pool_token_account.amount == 0 @ CustomError::PoolNotEmpty,
        close = admin
    )]
    pub pool_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}