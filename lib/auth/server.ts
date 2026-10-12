import crypto from "node:crypto";
import { createNeonAuth } from "@neondatabase/auth/next/server";

function cookieSecret() {
  const explicit = process.env.NEON_AUTH_COOKIE_SECRET;
  if (explicit && explicit.length >= 32) return explicit;

  const seed = process.env.DATABASE_URL;
  if (!seed) throw new Error("DATABASE_URL is required to initialize authentication.");

  return crypto.createHash("sha256").update(`leetsolve-auth-cookie:${seed}`).digest("hex");
}

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: cookieSecret(),
    sessionDataTtl: 300,
  },
});
