use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::{commit_accounts, commit_and_undelegate_accounts};

pub mod state;
pub mod instructions;
pub mod error;
pub mod event;

use crate::state::*;
use crate::error::*;
use crate::event::*;
use crate::instructions::*;

declare_id!("BL31QTN3JkKaWTrwKwrJEjgYUtVKz7gQodhNdb9dpSXZ");

#[ephemeral]
#[program]
pub mod strike_contracts_new {

    use super::*;

    // Admin instructions
    pub fn initialize(
        ctx: Context<Initialize>, 
        match_id: String, 
        registration_end_time: i64
    ) -> Result<()> {
        process_initialize(ctx, match_id, registration_end_time)
    }

    pub fn end_match(ctx: Context<EndMatch>) -> Result<()> {
        process_end_match(ctx)
    }

    pub fn distribute_prizes<'a, 'b, 'c, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, DistributePrizes<'info>>, 
        prize_distributions: Vec<PrizeDistribution>
    ) -> Result<()> {
        process_distribute_prizes(ctx, prize_distributions)
    }

    pub fn close_match_pool(ctx: Context<CloseMatchPool>) -> Result<()> {
        process_close_match_pool(ctx)
    }

    // Deposit instructions
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        process_deposit(ctx, amount)
    }
    
    // Token transfer instruction for rollup environment
    pub fn transfer_in_rollup(ctx: Context<TransferInRollup>, amount: u64) -> Result<()> {
        process_transfer_in_rollup(ctx, amount)
    }
    
    // MagicBlock instructions
    
    /// Delegate a match pool account to the delegation program
    pub fn delegate_match_pool(ctx: Context<DelegateMatchPool>) -> Result<()> {
        ctx.accounts.delegate_match_pool(
            &ctx.accounts.admin,
            &[b"match_pool", ctx.accounts.match_pool.match_id.as_bytes()],
            DelegateConfig {
                commit_frequency_ms: 120_000,
                ..Default::default()
            },
        )?;
        Ok(())
    }

    /// Delegate a pool token account to the delegation program
    pub fn delegate_pool_token_account(ctx: Context<DelegatePoolTokenAccount>) -> Result<()> {
        ctx.accounts.delegate_pool_token_account(
            &ctx.accounts.admin,
            &[b"pool_token", ctx.accounts.match_pool.match_id.as_bytes()],
            DelegateConfig {
                commit_frequency_ms: 120_000,
                ..Default::default()
            },
        )?;
        Ok(())
    }

    /// Delegate a user's token account to the delegation program
    pub fn delegate_user_token_account(ctx: Context<DelegateUserTokenAccount>) -> Result<()> {
        ctx.accounts.delegate_user_token_account(
            &ctx.accounts.user,
            &[],  // No seeds needed for user token accounts as they're not PDAs
            DelegateConfig {
                commit_frequency_ms: 120_000,
                ..Default::default()
            },
        )?;
        Ok(())
    }

    /// Delegate a user deposit account to the delegation program
    pub fn delegate_user_deposit(ctx: Context<DelegateUserDeposit>) -> Result<()> {
        ctx.accounts.delegate_user_deposit(
            &ctx.accounts.user,
            &[b"user_deposit", ctx.accounts.match_pool.match_id.as_bytes(), ctx.accounts.user.key().as_ref()],
            DelegateConfig {
                commit_frequency_ms: 120_000,
                ..Default::default()
            },
        )?;
        Ok(())
    }

    /// Manual commit of a match pool account in the ER back to Solana
    pub fn commit_match_pool(ctx: Context<CommitMatchPool>) -> Result<()> {
        commit_accounts(
            &ctx.accounts.admin,
            vec![&ctx.accounts.match_pool.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;
        Ok(())
    }

    /// Undelegate a match pool account from the delegation program
    pub fn undelegate_match_pool(ctx: Context<CommitMatchPool>) -> Result<()> {
        commit_and_undelegate_accounts(
            &ctx.accounts.admin,
            vec![&ctx.accounts.match_pool.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;
        Ok(())
    }
}