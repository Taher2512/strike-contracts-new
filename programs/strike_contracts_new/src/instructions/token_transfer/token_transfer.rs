use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use crate::error::CustomError;
use crate::state::MatchPool;
use crate::event::DepositEvent;

// Function to process a token transfer within the rollup environment
pub fn process_transfer_in_rollup(
    ctx: Context<TransferInRollup>,
    amount: u64,
) -> Result<()> {
    let match_pool = &mut ctx.accounts.match_pool;
    let sender = &ctx.accounts.sender;
    let receiver_key = ctx.accounts.receiver.key();
    
    // Find the sender's deposit record
    let sender_key = sender.key();
    let sender_deposit_opt = match_pool.deposits.iter_mut().find(|d| d.user == sender_key);
    
    // Ensure sender has enough balance
    let sender_deposit = if let Some(deposit) = sender_deposit_opt {
        deposit
    } else {
        return Err(error!(CustomError::InsufficientBalance));
    };
    
    if sender_deposit.amount < amount {
        return Err(error!(CustomError::InsufficientBalance));
    }
    
    // Deduct from sender
    sender_deposit.amount = sender_deposit.amount.checked_sub(amount)
        .ok_or(error!(CustomError::InsufficientBalance))?;
    
    // Add to receiver (create new deposit record if needed)
    if let Some(receiver_deposit) = match_pool.deposits.iter_mut().find(|d| d.user == receiver_key) {
        receiver_deposit.amount = receiver_deposit.amount.checked_add(amount)
            .ok_or(error!(CustomError::TokenTransferError))?;
    } else {
        // Create new deposit record for receiver
        match_pool.deposits.push(crate::state::UserDeposit {
            user: receiver_key,
            amount,
        });
    }
    
    // Emit event for the token transfer
    emit!(DepositEvent {
        user: receiver_key,
        match_id: match_pool.match_id.clone(),
        amount,
    });
    
    Ok(())
}

#[derive(Accounts)]
pub struct TransferInRollup<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    
    /// CHECK: Receiver can be any account
    pub receiver: AccountInfo<'info>,
    
    #[account(
        mut,
        seeds = [b"match_pool", match_pool.match_id.as_bytes()],
        bump = match_pool.bump,
    )]
    pub match_pool: Account<'info, MatchPool>,
    
    pub system_program: Program<'info, System>,
}

// Structure for user token account delegation
#[derive(Accounts)]
pub struct DelegateUserTokenAccount<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ CustomError::Unauthorized
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}