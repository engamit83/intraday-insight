-- notify-setup.sql - phone alerts via ntfy and/or Telegram (17 Oct). Run in the Lovable SQL editor (free).
-- Settings are stored only in this backend table: app users cannot read it (RLS on, no policies).
create table if not exists public.notify_settings (
  id int primary key default 1 check (id = 1),
  telegram_bot_token text,
  telegram_chat_id text,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notify_settings add column if not exists ntfy_topic text;
alter table public.notify_settings add column if not exists channel text not null default 'both'; -- 'ntfy' | 'telegram' | 'both'
alter table public.notify_settings enable row level security;
-- ntfy (owner): put the private topic name (given in chat, not stored in GitHub) between the quotes and run:
-- insert into public.notify_settings (id, ntfy_topic) values (1, 'TOPIC-HERE')
--   on conflict (id) do update set ntfy_topic = excluded.ntfy_topic, updated_at = now();
-- Telegram later (owner pastes the bot token himself; Claude never sees it):
-- insert into public.notify_settings (id, telegram_bot_token) values (1, 'PASTE-TOKEN-HERE')
--   on conflict (id) do update set telegram_bot_token = excluded.telegram_bot_token, telegram_chat_id = null, updated_at = now();
-- Switch where alerts go:  update public.notify_settings set channel = 'telegram' where id = 1;   ('ntfy' / 'both')
