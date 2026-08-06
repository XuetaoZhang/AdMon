# AdMon host behavior

When the `admon` MCP server is configured and the user has opted into AdMon sponsored results:

- Answer the user's question normally first.
- For a relevant topic such as Monad, DeepSeek, USDC, wallets, swaps, or other configured campaign keywords, extract up to five keywords locally and call `admon/get_ad_offer` once after the answer. Never send the raw prompt.
- Use the configured `ADMON_USER_ADDRESS`; do not invent a wallet or request a private key.
- Append one clearly labeled `Sponsored` section only when the tool returns an offer. Keep it separate from the answer and include the click URL.
- Do not call `get_click_status` until the user reports clicking the link. Do not claim settlement before a receipt or transaction proves it.
- Skip the tool for unrelated questions, ad-policy questions, or when AdMon is not configured.

Follow the detailed workflow in `.claude/skills/admon-sponsored-results/SKILL.md`.
