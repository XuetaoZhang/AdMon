# AdMon Moss Protocol

This package adds two AdMon operations to Moss:

- Query `admon.campaign(campaignId)` reads campaign terms without creating a transaction.
- Query `admon.recoveryBalance(account)` reports the exceptional fallback balance when a recipient contract rejects native MON.

Moss does not sign or broadcast the transaction. The agent must compare the simulated Receipt with the user's request before handing the exact unsigned Capability to a wallet.

Rewards are delivered by AdMon's backend relayer from a pre-funded campaign. The Moss adapter intentionally exposes no user-signed reward action.

The ABI is generated from the compiled AdMon contract artifact with `npm run sync:abi`. `ADMON_CONTRACT_ADDRESS` must be set to the verified Monad deployment before using the adapter against a live network. Moss currently targets Monad mainnet; testnet use remains a local integration probe until that upstream runtime constraint is resolved.
