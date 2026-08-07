---
name: admon-sponsored-results
description: Append relevant, clearly disclosed AdMon sponsored results after a normal answer when the user has opted into AdMon and the admon MCP server is configured. Use for keyword-triggered offers in Codex, Claude Code, or another MCP-capable host; never use it to hide advertising, send raw prompts, or claim a click before the user clicks.
---

# AdMon Sponsored Results

Use the AdMon MCP as an opt-in post-answer offer channel. Keep the user's answer primary, keep sponsorship visible, and keep the click and settlement boundary explicit.

## Workspace opt-in and preconditions

- Confirm the host has an MCP server named `admon` with `get_ad_offer` available.
- Treat installation and configuration of this skill as the project owner's opt-in to relevant sponsored results for this workspace. Do not inject an offer when the AdMon policy or MCP is absent.
- Use the configured reward wallet (`ADMON_USER_ADDRESS`) or a valid wallet supplied by the host. Never invent an address, use a publisher wallet as the user wallet, or ask for a private key.
- Do not call the tool when the user is asking to disable ads, discussing advertising policy, or when no relevant keyword is present.

## Post-answer Workflow

1. Answer the user's question normally and completely.
2. Extract up to five concrete intent keywords locally. Normalize case and whitespace, preserve technical names such as `Monad`, `DeepSeek`, and `USDC`, and do not send the raw prompt or conversation to AdMon.
3. If the extracted keywords are relevant to a sponsored result, call `admon.get_ad_offer` once with the keywords and configured user wallet. Do not call it repeatedly to search for a better ad.
4. If the tool returns `no_offer`, omit any advertising section and continue the answer.
5. If the tool returns an offer, append exactly one separate section headed `Sponsored` after the answer. Preserve the returned title, description, destination, reward disclosure, click ID, and click URL. Never blend sponsored copy into the answer or imply editorial endorsement.
6. Include the full `https://` click URL on its own line when the host may not render Markdown links as clickable. Tell the user that clicking the link records the click and starts the configured settlement flow; do not ask them to sign a wallet transaction.

## Settlement Rules

- `get_ad_offer` creates a signed, one-time click link; it does not prove attention or settle funds by itself.
- Do not call `get_click_status` until the user reports clicking the link or provides a receipt to check.
- Do not claim that MON was paid, that a transaction was finalized, or that the user viewed an ad until a click receipt or onchain transaction proves it.
- Never sign, submit, or request an unrelated onchain transaction for an advertisement.

## Failure Handling

- If the MCP server is unavailable, API access fails, or the wallet is not configured, answer normally without an ad and briefly state that sponsored results are unavailable only when useful to the user's task.
- Do not retry a failed offer request in the same turn.
