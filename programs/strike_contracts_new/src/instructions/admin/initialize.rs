use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::{Mint, Token, TokenAccount}};

use crate::state::MatchPool;

pub fn process_initialize(ctx: Context<Initialize>, match_id: String, registration_end_time: i64) -> Result<()> {
    let match_pool = &mut ctx.accounts.match_pool;
    let admin = &ctx.accounts.admin;

    // Initialize the match pool
    match_pool.admin = admin.key();
    match_pool.match_id = match_id;
    match_pool.registration_end_time = registration_end_time;
    match_pool.total_deposited = 0;
    match_pool.is_active = true;
    match_pool.is_finalized = false;
    match_pool.bump = ctx.bumps.match_pool;
    match_pool.token_bump = ctx.bumps.pool_token_account;

    Ok(())
}

#[derive(Accounts)]
#[instruction(match_id: String, registration_end_time: i64)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + MatchPool::INIT_SPACE,
        seeds = [b"match_pool", match_id.as_bytes()],
        bump,
    )]
    pub match_pool: Account<'info, MatchPool>,

    #[account(
        init,
        payer = admin,
        seeds = [b"pool_token", match_id.as_bytes()],
        bump,
        token::mint = token_mint,
        token::authority = match_pool,
    )]
    pub pool_token_account: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, Mint>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,

}