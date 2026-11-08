/**
 * Server-only wallet store. Never import from client components.
 * All access goes through Supabase service-role key + SECURITY DEFINER RPCs.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv, hasSupabase } from "@/lib/env";

export type WalletRow = {
  id: string;
  user_id: number;
  currency: string;
  available_minor: number;
  pending_out_minor: number;
  status: "active" | "frozen" | "closed";
  created_at: string;
  updated_at: string;
};

export type LedgerRow = {
  public_id: string;
  direction: "credit" | "debit";
  kind: string;
  amount_minor: number;
  balance_after_minor: number | null;
  status: string;
  ref: string;
  gateway_ref: string | null;
  note: string | null;
  created_at: string;
};

let cached: SupabaseClient | null = null;
export function supabaseAdmin(): SupabaseClient | null {
  if (!hasSupabase()) return null;
  if (cached) return cached;
  const env = getEnv();
  cached = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** RPC wrapper — returns parsed JSON body cast to `T`. Throws on rpc errors. */
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const db = supabaseAdmin();
  if (!db) throw new Error("supabase_not_configured");
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(`${fn} failed: ${error.message}`);
  return data as T;
}

export async function getOrCreateWallet(userId: number): Promise<WalletRow> {
  return rpc<WalletRow>("hs86e_get_or_create_wallet", { p_user_id: userId });
}

export async function createDepositIntent(userId: number, amountMinor: number, ref: string, ttlSeconds = 1800) {
  return rpc<{ ok: boolean; error?: string; intentId?: string; ref?: string; amountMinor?: number; expiresAt?: string }>(
    "hs86e_create_deposit_intent",
    { p_user_id: userId, p_amount_minor: amountMinor, p_ref: ref, p_ttl_seconds: ttlSeconds },
  );
}

export async function settleDeposit(intentId: string, gatewayRef: string) {
  return rpc<{ ok: boolean; duplicate?: boolean; error?: string; ref?: string; availableMinor?: number; status?: string }>(
    "hs86e_settle_deposit",
    { p_intent_id: intentId, p_gateway_ref: gatewayRef },
  );
}

export async function reserveWithdrawal(input: {
  userId: number;
  amountMinor: number;
  feeMinor: number;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  ref: string;
}) {
  return rpc<{ ok: boolean; error?: string; ref?: string; netMinor?: number; feeMinor?: number; availableMinor?: number }>(
    "hs86e_reserve_withdrawal",
    {
      p_user_id: input.userId,
      p_amount_minor: input.amountMinor,
      p_fee_minor: input.feeMinor,
      p_bank_code: input.bankCode,
      p_bank_name: input.bankName,
      p_account_number: input.accountNumber,
      p_account_name: input.accountName,
      p_ref: input.ref,
    },
  );
}

export async function settleWithdrawal(ref: string, outcome: "paid" | "reversed") {
  return rpc<{ ok: boolean; duplicate?: boolean; error?: string; status?: string; availableMinor?: number }>(
    "hs86e_settle_withdrawal",
    { p_ref: ref, p_outcome: outcome },
  );
}

/** Recent ledger rows for a user's liability account (customer-visible history). */
export async function listLedger(userId: number, limit = 50, beforeIso?: string) {
  const db = supabaseAdmin();
  if (!db) throw new Error("supabase_not_configured");
  let query = db
    .from("ledger_entries")
    .select("public_id, direction, kind, amount_minor, balance_after_minor, status, ref, gateway_ref, note, created_at")
    .eq("user_id", userId)
    .eq("account", "customer-liability")
    .in("status", ["completed", "pending", "failed", "reversed", "disputed"])
    .order("created_at", { ascending: false })
    .order("public_id", { ascending: false })
    .limit(limit);
  if (beforeIso) query = query.lt("created_at", beforeIso);
  const { data, error } = await query;
  if (error) throw new Error(`ledger_list failed: ${error.message}`);
  return (data ?? []) as LedgerRow[];
}

export async function findDepositIntentByRef(ref: string) {
  const db = supabaseAdmin();
  if (!db) throw new Error("supabase_not_configured");
  const { data, error } = await db
    .from("deposit_intents")
    .select("id, wallet_id, amount_minor, ref, status, expires_at, gateway_ref")
    .eq("ref", ref)
    .maybeSingle();
  if (error) throw new Error(`intent_lookup failed: ${error.message}`);
  return data;
}

export async function recordProviderEvent(input: { provider: string; eventId: string; signatureOk: boolean; payload: unknown }) {
  const db = supabaseAdmin();
  if (!db) throw new Error("supabase_not_configured");
  const { data, error } = await db
    .from("provider_events")
    .upsert(
      {
        provider: input.provider,
        event_id: input.eventId,
        signature_ok: input.signatureOk,
        payload: input.payload as Record<string, unknown>,
        status: "received",
      },
      { onConflict: "provider,event_id", ignoreDuplicates: true },
    )
    .select("id, status")
    .maybeSingle();
  if (error) throw new Error(`provider_event insert failed: ${error.message}`);
  // data is null when the event already existed (duplicate delivery) — that's fine.
  return data;
}

export async function markProviderEvent(eventId: string, provider: string, status: "processed" | "ignored" | "failed", lastError?: string) {
  const db = supabaseAdmin();
  if (!db) throw new Error("supabase_not_configured");
  const { error } = await db
    .from("provider_events")
    .update({ status, last_error: lastError ?? null, processed_at: new Date().toISOString(), attempts: 1 })
    .eq("provider", provider)
    .eq("event_id", eventId);
  if (error) throw new Error(`provider_event update failed: ${error.message}`);
}

export async function findCompletedDepositByRef(ref: string) {
  const db = supabaseAdmin();
  if (!db) throw new Error("supabase_not_configured");
  const { data, error } = await db
    .from("ledger_entries")
    .select("public_id, amount_minor, balance_after_minor, created_at")
    .eq("ref", ref)
    .eq("kind", "deposit")
    .eq("account", "customer-liability")
    .eq("status", "completed")
    .maybeSingle();
  if (error) throw new Error(`deposit_receipt failed: ${error.message}`);
  return data;
}
