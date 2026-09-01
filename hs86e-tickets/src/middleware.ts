import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { STAFF_COOKIE } from "@/lib/constants";

const PROTECTED_API = [/^\/api\/scan\/validate/, /^\/api\/scan\/attendees/];

function secret() {
  const value = process.env.SCAN_JWT_SECRET;
  if (!value) return null;
  return new TextEncoder().encode(value);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED_API.some((re) => re.test(pathname));
  if (!needsAuth) return NextResponse.next();

  const token = request.cookies.get(STAFF_COOKIE)?.value;
  const key = secret();
  if (!token || !key) {
    return NextResponse.json({ error: "Staff session required" }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, key);
    if (payload.role !== "door_staff") {
      return NextResponse.json({ error: "Staff session required" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Staff session expired" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/scan/:path*", "/scan/:path*"],
};
