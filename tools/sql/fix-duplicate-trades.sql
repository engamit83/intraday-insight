-- fix-duplicate-trades.sql (20 Oct 2026). Run ONCE in the Lovable SQL editor (free). Nothing is deleted.
-- 1) Mark the extra copies of the same signal as 'v4-dup' (kept for the record, left out of results).
update public.simulated_trades t set rules = 'v4-dup'
from (select id, row_number() over (partition by signal_id order by id) as rn
      from public.simulated_trades where rules = 'v4' and signal_id is not null) d
where t.id = d.id and d.rn > 1;
-- 2) Lock: one paper trade per signal from now on (a second copy is refused; the app just logs "open failed").
create unique index if not exists simulated_trades_one_per_signal on public.simulated_trades (signal_id) where rules = 'v4';
