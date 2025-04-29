use anchor_lang::prelude::*;

use crate::{CustomError, MatchEndedEvent, MatchPool};

pub fn process_end_match(ctx: Context<EndMatch>) -> Result<()> {
    let match_pool = &mut ctx.accounts.match_pool;

    require!(match_pool.is_active, CustomError::MatchInactive);
    require!(!match_pool.is_finalized, CustomError::MatchFinalized);

    match_pool.is_active = false;

    emit!(MatchEndedEvent {
        match_id: match_pool.match_id.clone(),
        total_deposited: match_pool.total_deposited,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct EndMatch<'info> {
    #[account(
        mut,
        seeds = [b"match_pool", match_pool.match_id.as_bytes()],
        bump = match_pool.bump,
        constraint = match_pool.admin == admin.key() @ CustomError::Unauthorized,
    )]
    pub match_pool: Account<'info, MatchPool>,

    pub admin: Signer<'info>,

    pub sytem_program: Program<'info, System>,
}