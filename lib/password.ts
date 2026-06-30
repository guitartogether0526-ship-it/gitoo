import "server-only";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * 비밀번호 해시 (scrypt + 솔트). 서버 전용 — 평문 비밀번호는 저장/노출하지 않는다.
 * 저장 형식: "<salt>:<hash>" (둘 다 hex)
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, 64);
  const original = Buffer.from(hash, "hex");
  return original.length === derived.length && timingSafeEqual(original, derived);
}
