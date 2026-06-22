import { cookies } from "next/headers";

const JWT_SECRET = process.env.AUTH_SECRET || "a-very-secure-random-secret-key-at-least-32-chars-long-12345";

// Helper to convert string to ArrayBuffer
function stringToBuffer(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer;
}

// Helper to convert ArrayBuffer or Uint8Array to base64url
function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Helper to convert base64url to string
function base64UrlToString(base64url: string): string {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return atob(base64);
}

/**
 * Signs a payload and returns a HS256 JWT.
 */
export async function signJWT(payload: any, expiryInSeconds = 86400): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  
  const jwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiryInSeconds,
  };

  const headerB64 = bufferToBase64Url(stringToBuffer(JSON.stringify(header)));
  const payloadB64 = bufferToBase64Url(stringToBuffer(JSON.stringify(jwtPayload)));
  const message = `${headerB64}.${payloadB64}`;

  // Use Web Crypto API to sign (compatible with Next.js Edge middleware)
  const key = await crypto.subtle.importKey(
    "raw",
    stringToBuffer(JWT_SECRET),
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    stringToBuffer(message)
  );

  const signatureB64 = bufferToBase64Url(signature);
  return `${message}.${signatureB64}`;
}

/**
 * Verifies a HS256 JWT and returns the payload if valid, or null if invalid/expired.
 */
export async function verifyJWT(token: string): Promise<any | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const message = `${headerB64}.${payloadB64}`;

    // Re-verify signature
    const key = await crypto.subtle.importKey(
      "raw",
      stringToBuffer(JWT_SECRET),
      { name: "HMAC", hash: { name: "SHA-256" } },
      false,
      ["verify"]
    );

    // Decode signatureB64 to buffer
    const signatureBin = base64UrlToString(signatureB64);
    const signatureBuffer = new Uint8Array(signatureBin.length);
    for (let i = 0; i < signatureBin.length; i++) {
      signatureBuffer[i] = signatureBin.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBuffer,
      stringToBuffer(message)
    );

    if (!isValid) return null;

    const payload = JSON.parse(base64UrlToString(payloadB64));
    
    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) {
      return null; // Expired
    }

    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Gets the current user session from the cookies.
 * Works in Server Components, Server Actions, and Route Handlers.
 */
export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  return verifyJWT(token);
}
