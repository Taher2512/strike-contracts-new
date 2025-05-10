use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("Match is inactive")]
    MatchInactive,
    #[msg("Match is still active")]
    MatchStillActive,
    #[msg("Match is finalized")]
    MatchFinalized,
    #[msg("Match is already finalized")]
    MatchAlreadyFinalized,
    #[msg("Match not finalized")]
    MatchNotFinalized,
    #[msg("Registration is closed")]
    RegistrationClosed,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Insufficient funds in the pool")]
    InsufficientPoolFunds,
    #[msg("Winner account not found")]
    WinnerAccountNotFound,
    #[msg("Pool not empty")]
    PoolNotEmpty,
    #[msg("Insufficient balance for transfer")]
    InsufficientBalance,
    #[msg("Token transfer error")]
    TokenTransferError,
}