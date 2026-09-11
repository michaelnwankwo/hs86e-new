import { timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { STAFF_COOKIE, STAFF_JWT_TTL } from "./constants";
import { getEnvSafe } from "./env";
import type { StaffSession } from "./types";

/**
 * The door-scanner session secret is enforced HERE — at the only boundary that
 * genuinely needs it — instead of inside the global env schema, so a missing
 * SCAN_JWT_SECRET can never take down page rendering. Auth simply fails closed.
 */
export function requireScanSecret(): string {
  const secret = getEnvSafe().SCAN_JWT_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error(
      "SCAN_JWT_SECRET is not configured (24+ characters required). Scanner sign-in is unavailable until it is set.",
    );
  }
  return secret;
}

function secretKey() {
  return new TextEncoder().encode(requireScanSecret());
}

export async function signStaffToken() {
  return new SignJWT({ role: "door_staff" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("hs86e-scanner")
    .setIssuedAt()
    .setExpirationTime(STAFF_JWT_TTL)
    .sign(secretKey());
}

export async function verifyStaffToken(token: string): Promise<StaffSession | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.role !== "door_staff") return null;
    return payload as unknown as StaffSession;
  } catch {
    return null;
  }
}

export async function getStaffSessionFromCookies() {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  if (!token) return null;
  return verifyStaffToken(token);
}

export function staffCookieOptions() {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: 60 * 60 * 8,
  };
}

export async function verifyStaffPin(pin: string) {
  const env = getEnvSafe();
  if (env.SCAN_STAFF_PIN_HASH) {
    return bcrypt.compare(pin, env.SCAN_STAFF_PIN_HASH);
  }
  if (env.SCAN_STAFF_PIN) {
    const a = Buffer.from(pin);
    const b = Buffer.from(env.SCAN_STAFF_PIN);
    if (a.length !== b.length) {
      // still compare to keep timing closer
      await bcrypt.compare(pin, "$2b$10$abcdefghijklmnopqrstuvabcdefghijklmnopqrstuvabcd");
      return false;
    }
        return timingSafeEqual(a, b);
  }
  return false;
}

export async function hashPin(pin: string) {
  return bcrypt.hash(pin, 10);
}
