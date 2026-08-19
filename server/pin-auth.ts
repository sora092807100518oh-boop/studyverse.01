import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 32;

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function hashPin(pin: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(pin, salt, KEY_LENGTH) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPin(pin: string, storedHash: string) {
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex) return false;
  const actual = await scrypt(pin, salt, KEY_LENGTH) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function getPinLookupHash(classroomId: number, pin: string, pepper: string) {
  return digest(`studyverse:pin-lookup:v1:${classroomId}:${pin}:${pepper}`);
}

export function getAttemptKeyHash(classroomCode: string, clientFingerprint: string, pepper: string) {
  return digest(`studyverse:login-attempt:v1:${classroomCode}:${clientFingerprint}:${pepper}`);
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function getSessionTokenHash(token: string, pepper: string) {
  return digest(`studyverse:pin-session:v1:${token}:${pepper}`);
}
