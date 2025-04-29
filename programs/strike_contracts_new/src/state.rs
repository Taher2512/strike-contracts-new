use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct MatchPool {
    pub admin: Pubkey,
    pub match_id: String,
    pub registration_end_time: i64,
    pub total_deposited: u64,
    pub is_active: bool,
    pub is_finalized: bool,
    pub deposits: Vec<UserDeposit>,
    pub bump: u8,
    pub token_bump: u8,
}

impl MatchPool {
    pub const INIT_SPACE: usize =
        32 +                          // admin: Pubkey
        4 + 50 +                      // match_id: String (max 50 chars)
        8 +                           // registration_end_time: i64
        8 +                           // total_deposited: u64
        1 +                           // is_active: bool
        1 +                           // is_finalized: bool
        4 + (50 * (32 + 8)) +         // deposits: Vec<UserDeposit> (max 50 users)
        1 +                           // bump: u8
        1;                            // token_bump: u8
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct UserDeposit {
    pub user: Pubkey,
    pub amount: u64,
}