# AdMon Risk Probe

## Contract settlement

1. Deploy the direct-payout `AdMon` contract with the Safe as owner and treasury and the backend signer as relayer.
2. Create a campaign funded with native MON at `0.01 MON` per click.
3. Record the user and publisher balances.
4. Call `settleClick` with a fresh click ID.
5. Confirm the same transaction increases the user balance by `0.0025 MON` and the publisher balance by `0.006 MON`.
6. Replay the click ID and confirm `ClickAlreadyUsed(bytes32)`.

Pass condition: one backend transaction produces three direct payouts and no recipient signature.

The local probe currently passes with a direct-settlement gas use of approximately `94,753`. Monad bills from the submitted gas limit, so production submission uses simulation, estimation, and a maximum 10% buffer.

The direct-payout contract is verified at `0x2501155A34E0af59a21751045abB6A9056b7e1Ab`. Campaign `1` was funded with `0.16 MON` in transaction `0x1d20e3bbf27442f9dfac12840aa9ba1f63b3d2c1da272bd4775c58f084123556`; it pays `0.01 MON` per accepted click through 16 independent budget shards.

The reference host completed a live one-click settlement in transaction `0x5574189851ad497fbfe76e610e28287fb080e1e5141996b0f15147fb76e72b4a`. The finalized receipt contains direct payouts of `0.0025 MON` to the user, `0.006 MON` to the publisher, and `0.0015 MON` to the protocol. The contract balance fell by exactly `0.01 MON`, and no wallet signature or follow-up withdrawal was used.

## Rejecting recipient

1. Set a recipient to a contract that rejects native MON.
2. Settle the click and confirm publisher and protocol payouts still complete.
3. Confirm only the failed share enters `pendingPayout`.
4. Have the rejecting contract redirect the recovery payout to an accepting address.

Pass condition: an unusual recipient cannot block the entire settlement, while normal EOA recipients require no recovery action.

## Redirect and relayer

1. Generate an expiry-bound signed redirect containing only campaign, click, user, and publisher identifiers.
2. Open it once and confirm the advertiser destination loads.
3. Confirm the backend submits settlement without exposing a wallet prompt.
4. Open the link again and confirm no second settlement is submitted.
5. Disable the relayer and confirm the redirect fails closed instead of displaying a false reward.

Pass condition: one valid redirect maps to at most one onchain payout.

## UI

1. Confirm the host renders ad content as a separate, labeled card.
2. Confirm no wallet connect, settlement timeline, claim control, or transaction-debug panel appears in the consumer view.
3. Confirm the card reports `+0.0025 MON sent` only after the settlement transaction is finalized and contains a direct user `RewardPaid` event.
4. Confirm mobile and desktop layouts have no overlap or horizontal overflow.

Pass condition: the consumer experiences a normal outbound ad click and a passive reward confirmation.

## Evidence to retain

- Verified contract address and source link.
- Campaign funding transaction.
- Direct settlement transaction and decoded payout events.
- User and publisher balance deltas.
- Replay rejection result.
- Desktop and mobile captures of the sponsored card and paid confirmation.
