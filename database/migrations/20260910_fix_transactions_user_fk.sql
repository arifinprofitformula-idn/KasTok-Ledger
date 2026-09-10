begin;

-- This app authenticates against public.users, not Supabase Auth's auth.users.
-- Remove the legacy Supabase Auth FK before reassigning legacy rows.
alter table public.transactions
  drop constraint if exists transactions_user_id_fkey;

-- Preserve the existing ledger by assigning legacy rows to the current KasTok superadmin.
update public.transactions
set user_id = (
  select id
  from public.users
  where lower(email) = lower('admin@kastok.arvadigital.my.id')
  limit 1
)
where user_id = 'edc10ff4-53e5-4ad8-85ba-ae00a3ec0cf5';

alter table public.transactions
  add constraint transactions_user_id_fkey
  foreign key (user_id) references public.users(id) on delete cascade;

commit;
