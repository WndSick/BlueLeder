import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret-key-change-in-production";

function base64UrlToBytes(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function verifyHmacSha256(data: string, signatureBase64Url: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const signatureBin = base64UrlToBytes(signatureBase64Url);
    return await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBin as any,
      encoder.encode(data)
    );
  } catch {
    return false;
  }
}

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  exp: number;
}

async function verifyToken(token: string): Promise<JWTPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const data = `${header}.${payload}`;

  const isValid = await verifyHmacSha256(data, signature, JWT_SECRET);
  if (!isValid) return null;

  try {
    const decodedPayload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(payload))
    );
    // Check expiration
    if (decodedPayload.exp && Date.now() >= decodedPayload.exp * 1000) {
      return null;
    }
    return decodedPayload as JWTPayload;
  } catch {
    return null;
  }
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip assets, public files, and Next.js internal endpoints
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/public") ||
    pathname.includes(".") // skip files with extensions (e.g. .png, .ico, .css)
  ) {
    return NextResponse.next();
  }

  // 2. Auth Endpoints: Allow anonymous access
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // 3. Retrieve JWT Token from Cookies or Authorization Header
  const cookieToken = request.cookies.get("token")?.value;
  const authHeader = request.headers.get("Authorization");
  const headerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
  const token = cookieToken || headerToken;

  const payload = token ? await verifyToken(token) : null;

  // 4. Route Protection and Header Injection
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (pathname.startsWith("/api")) {
    if (!payload) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }
  } else {
    if (!payload && !isAuthPage) {
      // If not authenticated and trying to access app pages, redirect to /login
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }

    if (payload && isAuthPage) {
      // If authenticated and trying to access /login or /register, redirect to dashboard /
      const dashboardUrl = new URL("/", request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Inject authentication headers if user payload is present
  if (payload) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", payload.userId);
    requestHeaders.set("x-user-email", payload.email);
    requestHeaders.set("x-user-role", payload.role);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}
