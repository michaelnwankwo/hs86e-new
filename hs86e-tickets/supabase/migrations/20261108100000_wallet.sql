-- HS86E Wallet — Phase 2 (v1). NGN, integer minor units, double-entry ledger.
-- Apply with: npx supabase db push   (or paste into Supabase SQL editor).
-- Access model: server-only via service-role key. RLS enabled, NO policies for
-- anon/authenticated clients — the app never queries these tables from the browser.

create extension if not exists pgcrypto;

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null unique,               -- WP customer id
  currency char(3) not null default 'NGN',
  available_minor bigint not null default 0 check (available_minor >= 0),
  pending_out_minor bigint not null default 0 check (pending_out_minor >= 0),
  status text not null default 'active' check (status in ('active','frozen','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,               -- receipt id, e.g. WLT-XXXX... (ULID-style)
  journal_id uuid not null,                     -- two rows share a journal_id
  user_id bigint not null,
  account text not null check (account in ('customer-liability','clearing','fees','settlement','revenue')),
  direction text not null check (direction in ('credit','debit')),
  kind text not null check (kind in ('deposit','withdrawal','ticket_purchase','refund','fee','adjustment','reversal','transfer')),
  amount_minor bigint not null check (amount_minor > 0),
  balance_after_minor bigint,                   -- liability legs only
  status text not null check (status in ('pending','completed','failed','reversed','disputed')),
  ref text not null,                            -- idempotency key
  gateway_ref text,
  ticket_id text,
  note text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ledger_ref_account_key unique (ref, account)
);
create index if not exists ledger_user_created_idx on public.ledger_entries (user_id, created_at desc, public_id desc);
create index if not exists ledger_journal_idx on public.ledger_entries (journal_id);
create index if not exists ledger_ref_idx on public.ledger_entries (ref);

create table if not exists public.deposit_intents (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id),
  amount_minor bigint not null check (amount_minor >= 10000),
  ref text not null unique,
  status text not null default 'pending' check (status in ('pending','completed','failed','expired','disputed')),
  gateway text not null default 'flutterwave',
  gateway_ref text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,               -- WLT-WD-...
  wallet_id uuid not null references public.wallets(id),
  amount_minor bigint not null check (amount_minor >= 50000),
  fee_minor bigint not null default 0,
  net_minor bigint not null,
  bank_code text not null,
  bank_name text not null,
  account_number text not null,
  account_name text not null,
  status text not null default 'reserved' check (status in ('requested','reserved','processing','paid','failed','reversed')),
  payout_ref text unique,
  reviewer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  signature_ok boolean not null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received','processed','ignored','failed')),
  attempts int not null default 0,
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint provider_events_key unique (provider, event_id)
);

alter table public.wallets enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.deposit_intents enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.provider_events enable row level security;

-- ============ RPCs (SECURITY DEFINER, server-called only) ============

create or replace function public.hs86e_get_or_create_wallet(p_user_id bigint)
returns public.wallets language plpgsql security definer set search_path = public as $$
declare w public.wallets;
begin
  insert into public.wallets(user_id) values (p_user_id) on conflict (user_id) do nothing;
  select * into w from public.wallets where user_id = p_user_id;
  return w;
end $$;

create or replace function public.hs86e_create_deposit_intent(p_user_id bigint, p_amount_minor bigint, p_ref text, p_ttl_seconds int default 1800)
returns jsonb language plpgsql security definer set search_path = public as $$
declare w public.wallets; i public.deposit_intents;
begin
  if p_amount_minor < 10000 then
    return jsonb_build_object('ok', false, 'error', 'amount_too_small');
  end if;
  select * into w from public.wallets where user_id = p_user_id for update;
  if not found then
    insert into public.wallets(user_id) values (p_user_id) returning * into w;
  end if;
  if w.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'wallet_not_active');
  end if;
  insert into public.deposit_intents(wallet_id, amount_minor, ref, expires_at)
  values (w.id, p_amount_minor, p_ref, now() + make_interval(secs => p_ttl_seconds))
  returning * into i;
  return jsonb_build_object('ok', true, 'intentId', i.id, 'ref', i.ref, 'amountMinor', i.amount_minor, 'expiresAt', i.expires_at);
end $$;

create or replace function public.hs86e_settle_deposit(p_intent_id uuid, p_gateway_ref text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  i public.deposit_intents%rowtype; w public.wallets%rowtype;
  jid uuid := gen_random_uuid(); new_available bigint;
begin
  select * into i from public.deposit_intents where id = p_intent_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'intent_not_found'); end if;
  if i.status = 'completed' then
    return jsonb_build_object('ok', true, 'duplicate', true, 'ref', i.ref);
  end if;
  if i.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'intent_not_pending', 'status', i.status);
  end if;
  if i.expires_at < now() then
    update public.deposit_intents set status = 'expired' where id = i.id;
    return jsonb_build_object('ok', false, 'error', 'intent_expired');
  end if;
  select * into w from public.wallets where id = i.wallet_id for update;
  new_available := w.available_minor + i.amount_minor;
  insert into public.ledger_entries
    (public_id, journal_id, user_id, account, direction, kind, amount_minor, balance_after_minor, status, ref, gateway_ref)
  values
    ('WLT-'||upper(replace(gen_random_uuid()::text,'-','')) , jid, w.user_id, 'customer-liability', 'credit', 'deposit', i.amount_minor, new_available, 'completed', i.ref, p_gateway_ref),
    ('WLT-'||upper(replace(gen_random_uuid()::text,'-','')) , jid, w.user_id, 'clearing', 'debit', 'deposit', i.amount_minor, null, 'completed', i.ref, p_gateway_ref);
  update public.wallets set available_minor = new_available, updated_at = now() where id = w.id;
  update public.deposit_intents set status = 'completed', gateway_ref = p_gateway_ref where id = i.id;
  return jsonb_build_object('ok', true, 'ref', i.ref, 'availableMinor', new_available);
end $$;

create or replace function public.hs86e_reserve_withdrawal(p_user_id bigint, p_amount_minor bigint, p_fee_minor bigint, p_bank_code text, p_bank_name text, p_account_number text, p_account_name text, p_ref text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare w public.wallets%rowtype; req public.withdrawal_requests%rowtype; jid uuid := gen_random_uuid(); new_pending bigint;
begin
  if p_amount_minor < 50000 then return jsonb_build_object('ok', false, 'error', 'amount_too_small'); end if;
  select * into w from public.wallets where user_id = p_user_id for update;
  if not found then insert into public.wallets(user_id) values (p_user_id) returning * into w; end if;
  if w.status <> 'active' then return jsonb_build_object('ok', false, 'error', 'wallet_frozen'); end if;
  if w.available_minor - w.pending_out_minor < p_amount_minor then
    return jsonb_build_object('ok', false, 'error', 'insufficient_funds', 'availableMinor', w.available_minor - w.pending_out_minor);
  end if;
  new_pending := w.pending_out_minor + p_amount_minor;
  insert into public.withdrawal_requests
    (public_id, wallet_id, amount_minor, fee_minor, net_minor, bank_code, bank_name, account_number, account_name, status)
  values (p_ref, w.id, p_amount_minor, p_fee_minor, p_amount_minor - p_fee_minor, p_bank_code, p_bank_name, p_account_number, p_account_name, 'reserved')
  returning * into req;
  insert into public.ledger_entries
    (public_id, journal_id, user_id, account, direction, kind, amount_minor, balance_after_minor, status, ref, note)
  values
    ('WLT-'||upper(replace(gen_random_uuid()::text,'-','')), jid, w.user_id, 'customer-liability', 'debit', 'withdrawal', p_amount_minor, w.available_minor, 'pending', p_ref, 'withdrawal hold'),
    ('WLT-'||upper(replace(gen_random_uuid()::text,'-','')), jid, w.user_id, 'clearing', 'credit', 'withdrawal', p_amount_minor, null, 'pending', p_ref, 'withdrawal hold');
  update public.wallets set pending_out_minor = new_pending, updated_at = now() where id = w.id;
  return jsonb_build_object('ok', true, 'ref', p_ref, 'netMinor', req.net_minor, 'feeMinor', p_fee_minor);
end $$;

create or replace function public.hs86e_settle_withdrawal(p_ref text, p_outcome text)  -- 'paid' | 'reversed'
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.withdrawal_requests%rowtype; w public.wallets%rowtype; jid uuid := gen_random_uuid(); new_avail bigint; new_pending bigint;
begin
  if p_outcome not in ('paid','reversed') then return jsonb_build_object('ok', false, 'error', 'bad_outcome'); end if;
  select * into r from public.withdrawal_requests where public_id = p_ref for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'request_not_found'); end if;
  if r.status in ('paid','reversed') then
    return jsonb_build_object('ok', true, 'duplicate', true, 'status', r.status);
  end if;
  select * into w from public.wallets where id = r.wallet_id for update;
  new_pending := w.pending_out_minor - r.amount_minor;

  if p_outcome = 'paid' then
    new_avail := w.available_minor - r.amount_minor;
    update public.ledger_entries set status = 'completed' where ref = p_ref;
    update public.wallets set available_minor = new_avail, pending_out_minor = new_pending, updated_at = now() where id = w.id;
    update public.withdrawal_requests set status = 'paid', updated_at = now() where id = r.id;
    return jsonb_build_object('ok', true, 'status', 'paid', 'availableMinor', new_avail);
  end if;

  -- reversed: void the hold, post compensating credit
  new_avail := w.available_minor;
  update public.ledger_entries set status = 'reversed' where ref = p_ref;
  insert into public.ledger_entries
    (public_id, journal_id, user_id, account, direction, kind, amount_minor, balance_after_minor, status, ref, note)
  values
    ('WLT-'||upper(replace(gen_random_uuid()::text,'-','')), jid, w.user_id, 'customer-liability', 'credit', 'reversal', r.amount_minor, new_avail, 'completed', p_ref || '-REV', 'withdrawal reversal'),
    ('WLT-'||upper(replace(gen_random_uuid()::text,'-','')), jid, w.user_id, 'clearing', 'debit', 'reversal', r.amount_minor, null, 'completed', p_ref || '-REV', 'withdrawal reversal');
  update public.wallets set pending_out_minor = new_pending, updated_at = now() where id = w.id;
  update public.withdrawal_requests set status = 'reversed', updated_at = now() where id = r.id;
  return jsonb_build_object('ok', true, 'status', 'reversed', 'availableMinor', new_avail);
end $$;
