# AdMon Product Walkthrough

AdMon is deployed and its create-campaign, click-settlement, claim, and replay-rejection checks have passed on Monad testnet at `0xA423ce5FE84554217554Af834C921269c1aaef38`. The publisher application keeps resettable activity labeled `Session preview`, while the separate `Monad testnet proof` band reads finalized public-chain evidence. Do not narrate a session transaction hash as an explorer transaction.

## Setup

- The reference host running with network access to Monad testnet RPC.
- The fixed testnet reward wallet shown in the publisher application.
- The controlled advertiser landing page and a reset local click store.
- Monadscan links for the finalized settlement and claim transactions.

## Script

**0-08 seconds**

Show the Moss-powered reference agent preparing an unsigned onchain-action preview. Point out that the advertisement is not inside the answer and that the end user installed nothing.

**08-18 seconds**

Send the example prompt, then show that Moss returns a neutral unsigned-action preview before the separate Sponsored card appears. Point out the sponsor, destination, match reason, reward split, and dismiss action.

**18-30 seconds**

Click `Visit sponsor`. The controlled redirect opens the landing page once. Return to the agent UI and show the local timeline move from `Click recorded` to `Reward finalized`.

**30-40 seconds**

Show the `0.0025 MON` claimable fixture balance, then explicitly point to the separate `Monad testnet proof: Verified` band.

**40-48 seconds**

Open the public settlement and claim links from the proof band. Show that the click is consumed, the claimable balance is cleared, and the claim block is behind Monad's finalized block.

**48-56 seconds**

Return to the publisher application and click `Claim reward` to complete the resettable interactive flow. Keep the `Session preview` label visible.

**56-60 seconds**

Open the same signed click URL again and show the one-time redirect rejection. End on the public proof links and the 25% / 60% / 15% split.

## Closing line

Agent recommendations do not need hidden advertising. AdMon makes the advertiser, the click, the payout, and the Monad settlement visible to everyone.

## Reference captures

- [Desktop publisher application with Sponsored card and testnet proof](assets/admon-product-desktop.png)
- [Narrow-screen testnet proof layout](assets/admon-proof-mobile.png)
