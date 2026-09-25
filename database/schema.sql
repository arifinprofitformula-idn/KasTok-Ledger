create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

create unique index if not exists users_email_lower_idx on public.users (lower(email));

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
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

create index if not exists transactions_user_date_idx on public.transactions (user_id, transaction_date);
create index if not exists transactions_user_month_idx on public.transactions (user_id, month_key);

create table if not exists order_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  file_name text not null,
  file_hash text not null,
  row_count integer not null check (row_count >= 0),
  imported_at timestamptz not null default now(),
  unique (user_id, file_hash)
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  import_id uuid not null references order_imports(id) on delete restrict,
  order_id text not null,
  sku_id text not null,
  seller_sku text not null default '',
  product_name text not null,
  variation text not null default '',
  quantity integer not null check (quantity >= 0),
  returned_quantity integer not null default 0 check (returned_quantity >= 0),
  order_status text not null,
  order_substatus text not null default '',
  order_created_at timestamp not null,
  order_date date not null,
  month_key text not null,
  unit_original_price numeric,
  sku_subtotal_before_discount numeric,
  sku_platform_discount numeric,
  sku_seller_discount numeric,
  sku_subtotal_after_discount numeric,
  source_file text not null,
  source_row integer not null check (source_row > 0),
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists order_items_user_date_idx on order_items (user_id, order_date);
create index if not exists order_items_user_status_idx on order_items (user_id, order_status);
create index if not exists order_items_user_product_idx on order_items (user_id, product_name);
create index if not exists order_imports_user_date_idx on order_imports (user_id, imported_at desc);

alter table order_items add column if not exists sku_subtotal_before_discount numeric;
alter table order_items add column if not exists sku_platform_discount numeric;
alter table order_items add column if not exists sku_seller_discount numeric;

create table if not exists finance_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  file_name text not null,
  file_hash text not null,
  period_start date,
  period_end date,
  currency text not null default 'IDR',
  summary_settlement numeric,
  summary_revenue numeric,
  summary_fees numeric,
  summary_adjustments numeric,
  detail_settlement numeric not null default 0,
  reconciliation_difference numeric,
  row_count integer not null check (row_count >= 0),
  imported_at timestamptz not null default now(),
  unique (user_id, file_hash)
);

create table if not exists finance_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  import_id uuid not null references finance_imports(id) on delete cascade,
  transaction_id text not null,
  transaction_type text not null,
  order_date date,
  payment_date date,
  currency text not null default 'IDR',
  settlement_amount numeric not null default 0,
  total_revenue numeric not null default 0,
  total_fees numeric not null default 0,
  adjustment_amount numeric not null default 0,
  related_order_id text,
  buyer_payment numeric not null default 0,
  platform_discount numeric not null default 0,
  seller_discount numeric not null default 0,
  product_detail text not null default '',
  source_row integer not null,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists finance_entries_user_order_idx on finance_entries (user_id, transaction_id);
create index if not exists finance_entries_user_date_idx on finance_entries (user_id, order_date);

create table if not exists finance_components (
  id uuid primary key default gen_random_uuid(),
  finance_entry_id uuid not null references finance_entries(id) on delete cascade,
  code text not null,
  label text not null,
  column_index integer not null,
  amount numeric not null,
  unique (finance_entry_id, code)
);

create table if not exists sku_cost_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  sku_id text not null,
  variation text not null default '',
  effective_from date not null,
  purchase_cost numeric not null default 0 check (purchase_cost >= 0),
  inbound_freight numeric not null default 0 check (inbound_freight >= 0),
  direct_handling numeric not null default 0 check (direct_handling >= 0),
  packaging_cost numeric not null default 0 check (packaging_cost >= 0),
  other_direct_cost numeric not null default 0 check (other_direct_cost >= 0),
  total_unit_cost numeric not null default 0 check (total_unit_cost >= 0),
  supplier text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sku_id, variation, effective_from)
);

create table if not exists order_item_cost_snapshots (
  order_item_id uuid primary key references order_items(id) on delete cascade,
  cost_history_id uuid not null references sku_cost_history(id) on delete restrict,
  total_unit_cost numeric not null check (total_unit_cost >= 0),
  applied_at timestamptz not null default now()
);

create index if not exists sku_cost_history_lookup_idx on sku_cost_history (user_id, sku_id, variation, effective_from desc);
