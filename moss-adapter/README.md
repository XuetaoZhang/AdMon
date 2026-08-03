# AdMon Moss Protocol

This package adds two AdMon operations to Moss:

- Query `admon.claimable(account)` reads accrued native MON rewards.
- Capability `admon.claim()` builds one unsigned claim transaction and parses the native transfer plus `RewardClaimed` event into a verified Receipt.

Moss does not sign or broadcast the transaction. The agent must compare the simulated Receipt with the user's request before handing the exact unsigned Capability to a wallet.

Moss currently requires every write Capability to use at least one closed-set risk label. `claim()` is conservatively labeled `fundOut` because it spends gas on an external contract call, although the verified application-level transfer is inward. The Receipt remains the source of truth for the transferred amount and recipient.

The ABI is generated from the compiled AdMon contract artifact with `npm run sync:abi`. `ADMON_CONTRACT_ADDRESS` must be set to the verified Monad deployment before using the adapter against a live network. Moss currently targets Monad mainnet; testnet use remains a local integration probe until that upstream runtime constraint is resolved.
