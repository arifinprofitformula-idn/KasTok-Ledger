create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

create unique index if not exists users_email_lower_idx on users (lower(email));

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
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

create index if not exists transactions_user_date_idx on transactions (user_id, transaction_date);
create index if not exists transactions_user_month_idx on transactions (user_id, month_key);
