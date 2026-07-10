import { SignJWT, jwtVerify } from "jose";
import { timingSafeEqual, scryptSync } from "node:crypto";

const cookieName = "workout_session";
const encoder = new TextEncoder();

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is required.");
  return encoder.encode(value);
}

export function verifyPasscode(input: string) {
  const encoded = process.env.APP_PASSCODE_HASH;
  if (!encoded) throw new Error("APP_PASSCODE_HASH is required.");
  const [salt, hash] = encoded.split(":");
  if (!salt || !hash || !/^[a-f0-9]{128}$/i.test(hash)) return false;
  const candidate = scryptSync(input, salt, 64).toString("hex");
  return timingSafeEqual(
    Buffer.from(candidate, "hex"),
    Buffer.from(hash, "hex"),
  );
}

export async function createSession() {
  return new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function isAuthenticated(token?: string) {
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

export { cookieName };
