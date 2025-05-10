use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate};
use crate::state::MatchPool;
use anchor_spl::token::TokenAccount;

/// Account structure for delegating a match pool to MagicBlock Ephemeral Rollups
#[delegate]
#[derive(Accounts)]
pub struct DelegateMatchPool<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    /// The match pool to delegate
    #[account(
        mut,
        seeds = [b"match_pool", match_pool.match_id.as_bytes()],
        bump = match_pool.bump,
        constraint = match_pool.admin == admin.key() @ crate::error::CustomError::Unauthorized,
        del
    )]
    pub match_pool: Account<'info, MatchPool>,
}

/// Account structure for delegating a pool token account to MagicBlock Ephemeral Rollups
#[delegate]
#[derive(Accounts)]
pub struct DelegatePoolTokenAccount<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    /// The match pool associated with the pool token account
    #[account(
        seeds = [b"match_pool", match_pool.match_id.as_bytes()],
        bump = match_pool.bump,
        constraint = match_pool.admin == admin.key() @ crate::error::CustomError::Unauthorized,
    )]
    pub match_pool: Account<'info, MatchPool>,
    
    /// The pool token account to delegate
    #[account(
        mut, 
        seeds = [b"pool_token", match_pool.match_id.as_bytes()],
        bump = match_pool.token_bump,
        del
    )]
    pub pool_token_account: Account<'info, TokenAccount>,
}

/// Account structure for delegating a user deposit to MagicBlock Ephemeral Rollups
#[delegate]
#[derive(Accounts)]
pub struct DelegateUserDeposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// The match pool associated with the user deposit
    #[account(
        seeds = [b"match_pool", match_pool.match_id.as_bytes()],
        bump = match_pool.bump,
    )]
    pub match_pool: Account<'info, MatchPool>,
    
    /// CHECK: The user deposit to delegate - will be handled by the delegation program
    #[account(
        mut, 
        seeds = [b"user_deposit", match_pool.match_id.as_bytes(), user.key().as_ref()],
        bump,
        del
    )]
    pub user_deposit: AccountInfo<'info>,
}

/// Account structure for delegating a user's token account to MagicBlock Ephemeral Rollups
#[delegate]
#[derive(Accounts)]
pub struct DelegateUserTokenAccount<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// The match pool reference
    #[account(
        seeds = [b"match_pool", match_pool.match_id.as_bytes()],
        bump = match_pool.bump,
    )]
    pub match_pool: Account<'info, MatchPool>,
    
    /// The user token account to delegate
    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ crate::error::CustomError::Unauthorized,
        del
    )]
    pub user_token_account: Account<'info, TokenAccount>,
}

/// Account structure for committing or undelegating a match pool from MagicBlock Ephemeral Rollups
#[commit]
#[derive(Accounts)]
pub struct CommitMatchPool<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    /// The match pool to commit
    #[account(
        mut,
        seeds = [b"match_pool", match_pool.match_id.as_bytes()],
        bump = match_pool.bump,
        constraint = match_pool.admin == admin.key() @ crate::error::CustomError::Unauthorized,
    )]
    pub match_pool: Account<'info, MatchPool>,
}