-- AdMon shared application state. Campaign creative data remains off-chain;
-- click settlement itself is verified by the Monad contract.
create table if not exists public.admon_campaigns (
  id text primary key,
  campaign_id bigint not null,
  advertiser text not null,
  title text not null,
  description text not null,
  keywords jsonb not null,
  topic_id text not null,
  destination_url text not null,
  domain text not null,
  click_reward_mon text not null,
  budget_mon text not null,
  status text not null,
  clicks integer not null default 0,
  updated_at timestamptz not null
);

create index if not exists admon_campaigns_status_idx
  on public.admon_campaigns (status);

create table if not exists public.admon_publisher (
  id boolean primary key default true,
  name text not null,
  wallet text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.admon_clicks (
  click_id text primary key,
  state text not null,
  recorded_at timestamptz not null,
  paid_mon text not null default '0',
  mode text not null,
  campaign_id bigint,
  user_address text,
  publisher_address text,
  transaction_hash text,
  block_number integer,
  chain_error text
);

create index if not exists admon_clicks_recorded_at_idx
  on public.admon_clicks (recorded_at);

-- The application creates the initial publisher row and imports local seed
-- campaigns on its first request when admon_campaigns is empty.
