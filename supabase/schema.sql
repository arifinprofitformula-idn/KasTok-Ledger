create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reference_id text,
  dedupe_key text not null,
  type text not null check (type in ('Withdrawal', 'GMV Pay Deduction', 'Earnings')),
  transaction_date date,
  date_raw text not null,
  month_key text,
  amount numeric not null,
  source_file text,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

alter table public.transactions enable row level security;

drop policy if exists "Users can read their own transactions" on public.transactions;
create policy "Users can read their own transactions"
on public.transactions for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own transactions" on public.transactions;
create policy "Users can insert their own transactions"
on public.transactions for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own transactions" on public.transactions;
create policy "Users can update their own transactions"
on public.transactions for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own transactions" on public.transactions;
create policy "Users can delete their own transactions"
on public.transactions for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists transactions_user_date_idx on public.transactions (user_id, transaction_date);
create index if not exists transactions_user_month_idx on public.transactions (user_id, month_key);
