-- notify-setup.sql - phone alerts via Telegram (17 Oct). Run ONCE in the Lovable SQL editor (free).
-- The bot token is stored only in this backend table: app users cannot read it (RLS on, no policies).
create table if not exists public.notify_settings (
  id int primary key default 1 check (id = 1),
  telegram_bot_token text,
  telegram_chat_id text,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notify_settings enable row level security;
-- Step 2 (owner): paste YOUR bot token between the quotes and run (Claude never sees it):
-- insert into public.notify_settings (id, telegram_bot_token) values (1, 'PASTE-TOKEN-HERE')
--   on conflict (id) do update set telegram_bot_token = excluded.telegram_bot_token, telegram_chat_id = null, updated_at = now();
