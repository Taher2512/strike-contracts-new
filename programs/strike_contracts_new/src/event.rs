use anchor_lang::prelude::*;

#[event]
pub struct DepositEvent {
    pub user: Pubkey,
    pub match_id: String,
    pub amount: u64,
}

#[event]
pub struct MatchEndedEvent {
    pub match_id: String,
    pub total_deposited: u64,
}

#[event]
pub struct PrizeDistributedEvent {
    pub user: Pubkey,
    pub match_id: String,
    pub amount: u64,
}