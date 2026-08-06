# AdMon Deployment

AdMon can run with a local JSON store for development or PostgreSQL for a shared deployment. Set `DATABASE_URL` to enable PostgreSQL. The first application request creates the schema and imports the local seed campaigns when the database is empty.

Supabase can be used without running a separate migration: paste [supabase/schema.sql](../supabase/schema.sql) into the SQL Editor, or let the application create the same tables automatically on its first request.

## Required server variables

```text
DATABASE_URL=postgresql://...
DATABASE_SSL=true
BASE_URL=https://your-public-domain.example
AUTH_TOKEN=...
MODEL=deepseek-v4-flash
ADMON_CONTRACT_ADDRESS=0x2501155A34E0af59a21751045abB6A9056b7e1Ab
# Use the encrypted keystore JSON pair, a mounted keystore file pair, or the relayer private key.
ADMON_RELAYER_KEYSTORE_JSON={...encrypted keystore JSON...}
ADMON_RELAYER_PRIVATE_KEY=0x...
ADMON_RELAYER_KEYSTORE_PATH=/run/secrets/admon-relayer.json
ADMON_RELAYER_KEYSTORE_PASSWORD=...
ADMON_CHAIN_SETTLEMENT_REQUIRED=true
```

`ADMON_CONTRACT_ADDRESS` is public and should be set to the deployed contract
`0x2501155A34E0af59a21751045abB6A9056b7e1Ab`. The deployment transaction hash
`0x678ce4b6afcb383a6fbf40a9953859e52b1d85af523ae85304fb7e2b85e50049` is not
the contract address.

`ADMON_RELAYER_PRIVATE_KEY` must belong to the contract's authorized relayer
`0x52d1C1b8BE94150B282276c493C21E20017E38Cb`. It is a dedicated backend signer
that submits silent settlement transactions and pays gas; it is not an end
user’s or Safe owner’s private key. Never put a personal wallet or Safe key in
Vercel. For Vercel, prefer copying the encrypted keystore file contents into
`ADMON_RELAYER_KEYSTORE_JSON` and putting its password in
`ADMON_RELAYER_KEYSTORE_PASSWORD`; a filesystem path from your Mac does not
exist inside Vercel. A raw private key is supported but is less desirable.

The current testnet deployment was later updated to this relayer through the
Safe transaction `0xa930ec126af82eabd95a4f7aa4c83ec2b460a227da276ec4663f21e438cacc52`.
The two public test wallets in the local `.env` are not the current relayer.
If the dedicated key is unavailable, the Safe owner must call `setRelayer` for
a new dedicated wallet before deploying the backend.

`DATABASE_URL` stores campaigns, publisher profiles, and click settlement state. The MCP configuration shown in Manage must use the public application URL as `ADMON_API_URL`; it must not use the MCP host's own `localhost`.

## Vercel and Supabase

For Vercel, keep the repository root as the project root so workspace dependencies resolve. Use `npm ci` for installation and `npm run build:web` for the build command. This builds the contract artifact, Moss dependencies, and then the Next.js application in the required order. Do not set a start command; Vercel runs the Next.js routes as serverless functions. For a self-hosted Node process, use `npm run start --workspace @admon/web -- -p 3000` instead.

Use the Supabase PostgreSQL connection string as `DATABASE_URL` and set `DATABASE_SSL=true`. The SQL in `supabase/schema.sql` is optional because the application creates the same schema on first request.

## Container deployment

The repository includes a `Dockerfile` and a `render.yaml` blueprint. The blueprint provisions a PostgreSQL database and a web service. In Render, choose **New > Blueprint**, select the AdMon repository, and apply the blueprint. The repository can also be opened directly through [Render's deploy flow](https://render.com/deploy?repo=https://github.com/XuetaoZhang/AdMon). Set the secret variables before the first deploy, then open `/dashboard` once to confirm the imported campaigns. Render checks `/api/health`; it returns `503` if the shared database cannot be initialized.

After the service has a public URL, set that URL as `ADMON_API_URL` in each publisher's MCP host configuration. The standalone MCP server then calls the same shared campaign database through `POST /api/offers`; it does not read the host's local files.

Keep the relayer keystore outside Git and provide it through the hosting provider's secret or mounted-file mechanism. Do not place it in the Docker image or database.
