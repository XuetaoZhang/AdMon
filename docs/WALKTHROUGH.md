# AdMon Product Walkthrough

## Setup

- Run the reference publisher with Monad testnet RPC access and the encrypted relayer keystore configured.
- Configure the current direct-payout contract and a funded campaign.
- Use a payout wallet whose balance is visible in a block explorer or wallet application.

## Script

1. Open the Moss-powered reference agent and submit the onchain-action prompt.
2. Show the neutral unsigned-action preview, followed by the separate Sponsored card.
3. Point out the advertiser, destination, private topic-match reason, disclosure, and `0.0025 MON` click reward.
4. Click `Visit sponsor` once. The advertiser destination opens immediately; no wallet connection or confirmation appears.
5. Return to the agent page. The card changes briefly to `Sending MON reward`, then to `+0.0025 MON sent` after Monad finality.
6. Refresh the user and publisher wallet balances. The same transaction adds `0.0025 MON` to the user and `0.006 MON` to the publisher.
7. Open the transaction in Monadscan and show `ClickSettled` plus the three `RewardPaid` events.
8. Reopen the same signed link and show that the offer is already redeemed and no second payout occurs.

## Closing line

AdMon turns an agent ad click into a one-step, auditable Monad payment: no hidden placement, no wallet interruption, and no reward left waiting in a contract.
