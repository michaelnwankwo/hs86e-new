-- HS86E Create-Event flow — Phase 3a. Review queue + wallet-paid publishing fee.
-- Apply with: npx supabase db push   (or paste into Supabase SQL editor).
-- Requires the Phase 2 wallet migration (20261108100000_wallet.sql) applied first.
-- Access model: server-only via service-role key. RLS enabled, NO policies for
-- anon/authenticated — the app never queries these tables from the browser.

create extension if not exists pgcrypto;

-- Submitted events live here until an admin approves them (WooCommerce/FooEvents
-- product creation stays an audited, admin-side step — never public until then).
create table if not exists public.event_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null,                       -- WP customer id (submitter)
  submitter_email text,
  title text not null,
  category text,
  description text not null,
  venue_name text,
  venue_address text,
  city text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  tickets jsonb not null default '[]'::jsonb,    -- [{name, priceMinor, quantity}]
  fee_minor bigint not null default 0 check (fee_minor >= 0),
  fee_ref text,                                  -- WLT-FEE-... ledger idempotency key
  status text not null default 'pending_review' check (status in ('pending_review','approved','rejected','archived')),
  reviewer text,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists event_submissions_user_idx on public.event_submissions (user_id, created_at desc);
create index if not exists event_submissions_status_idx on public.event_submissions (status, created_at);

alter table public.event_submissions enable row level security;

-- Atomically books the publishing fee from the wallet and files the submission.
-- Double-entry: customer-liability 'debit/fee' -> revenue 'credit/fee'.
-- Insufficient balance books nothing; the submission is not created.
create or replace function public.hs86e_create_event_submission(
  p_user_id bigint, p_email text, p_title text, p_category text, p_description text,
  p_venue_name text, p_venue_address text, p_city text,
  p_starts_at timestamptz, p_ends_at timestamptz,
  p_tickets jsonb, p_fee_minor bigint, p_ref text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare w public.wallets%rowtype; jid uuid := gen_random_uuid(); new_available bigint; sub public.event_submissions%rowtype;
begin
  if btrim(coalesce(p_title,'')) is null or length(btrim(coalesce(p_title,''))) < 3 then
    return jsonb_build_object('ok', false, 'error', 'title_too_short');
  end if;
  if btrim(coalesce(p_description,'')) is null or length(btrim(coalesce(p_description,''))) < 20 then
    return jsonb_build_object('ok', false, 'error', 'description_too_short');
  end if;
  if p_starts_at is null or p_starts_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'starts_at_must_be_future');
  end if;
  if p_ends_at is not null and p_ends_at <= p_starts_at then
    return jsonb_build_object('ok', false, 'error', 'ends_at_must_follow_starts_at');
  end if;
  if coalesce(p_fee_minor, 0) < 0 then
    return jsonb_build_object('ok', false, 'error', 'bad_fee');
  end if;

  select * into w from public.wallets where user_id = p_user_id for update;
  if not found then insert into public.wallets(user_id) values (p_user_id) returning * into w; end if;
  if w.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'wallet_not_active');
  end if;
  if w.available_minor - w.pending_out_minor < coalesce(p_fee_minor, 0) then
    return jsonb_build_object('ok', false, 'error', 'insufficient_funds',
      'availableMinor', w.available_minor - w.pending_out_minor);
  end if;

  new_available := w.available_minor - coalesce(p_fee_minor, 0);

  insert into public.event_submissions
    (user_id, submitter_email, title, category, description, venue_name, venue_address, city,
     starts_at, ends_at, tickets, fee_minor, fee_ref, status)
  values
    (p_user_id, p_email, btrim(p_title), nullif(btrim(coalesce(p_category,'')),''), p_description,
     nullif(btrim(coalesce(p_venue_name,'')),''), nullif(btrim(coalesce(p_venue_address,'')),''), nullif(btrim(coalesce(p_city,'')),''),
     p_starts_at, p_ends_at, coalesce(p_tickets, '[]'::jsonb), coalesce(p_fee_minor, 0),
     case when coalesce(p_fee_minor,0) > 0 then p_ref else null end, 'pending_review')
  returning * into sub;

  if coalesce(p_fee_minor, 0) > 0 then
    insert into public.ledger_entries
      (public_id, journal_id, user_id, account, direction, kind, amount_minor, balance_after_minor, status, ref, note, meta)
    values
      ('WLT-'||upper(replace(gen_random_uuid()::text,'-','')), jid, w.user_id, 'customer-liability', 'debit', 'fee', p_fee_minor, new_available, 'completed', p_ref, 'Event publishing fee — ' || btrim(p_title), jsonb_build_object('submission_id', sub.id)),
      ('WLT-'||upper(replace(gen_random_uuid()::text,'-','')), jid, w.user_id, 'revenue', 'credit', 'fee', p_fee_minor, null, 'completed', p_ref, 'Event publishing fee', jsonb_build_object('submission_id', sub.id));
    update public.wallets set available_minor = new_available, updated_at = now() where id = w.id;
  end if;

  return jsonb_build_object('ok', true, 'submissionId', sub.id, 'ref', p_ref,
    'availableMinor', new_available, 'status', sub.status);
end $$;
