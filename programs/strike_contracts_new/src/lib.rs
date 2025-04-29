use anchor_lang::prelude::*;

pub mod state;
pub mod instructions;
pub mod error;
pub mod event;

use crate::state::*;
use crate::error::*;
use crate::event::*;
use crate::instructions::*;

declare_id!("HhYHJWkj2rFNx2pHjasv3pqwGgqqRNqugUEwow2qgPZu");

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
}
