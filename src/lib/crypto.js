/**
 * crypto.js — Client-side cryptography helpers using the Web Crypto API.
 *
 * Password hashing uses PBKDF2-SHA-256 with a random 16-byte salt and
 * 310,000 iterations (OWASP 2023 recommendation for PBKDF2-SHA-256).
 * The result is stored as a single base64 string: "<salt_b64>:<hash_b64>"
 *
 * This runs entirely in the browser — no server, no network.
 * PBKDF2 is deliberately slow, making brute-force attacks expensive.
 */

const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32; // SHA-256 = 32 bytes

// ---------- internal helpers ----------

function bufToB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b64ToBuf(b64) {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function importKey(password) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
}

async function deriveHash(key, saltBuf) {
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: saltBuf,
      iterations: PBKDF2_ITERATIONS,
    },
    key,
    HASH_BYTES * 8
  );
  return bits;
}

// ---------- public API ----------

/**
 * Hash a plaintext password with a fresh random salt using PBKDF2-SHA-256.
 * Returns a "<saltB64>:<hashB64>" string suitable for storage.
 *
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  const saltBuf = crypto.getRandomValues(new Uint8Array(SALT_BYTES)).buffer;
  const key = await importKey(password);
  const hashBuf = await deriveHash(key, saltBuf);
  return `${bufToB64(saltBuf)}:${bufToB64(hashBuf)}`;
}

/**
 * Verify a plaintext password against a stored PBKDF2 hash string.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * Also handles legacy SHA-256 hashes (no ":" separator) for backward
 * compatibility during first-run migration — those are immediately
 * re-hashed with PBKDF2 on successful verification.
 *
 * @param {string} password
 * @param {string} storedHash  — "<saltB64>:<hashB64>" or legacy hex SHA-256
 * @returns {Promise<{ ok: boolean, needsRehash: boolean }>}
 */
export async function verifyPassword(password, storedHash) {
  // ---- Legacy SHA-256 fallback ----
  if (!storedHash.includes(':')) {
    const legacyBuf = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(password)
    );
    const legacyHex = Array.from(new Uint8Array(legacyBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const match = legacyHex === storedHash;
    return { ok: match, needsRehash: match };
  }

  // ---- PBKDF2 path ----
  const parts = storedHash.split(':');
  if (parts.length !== 2) return { ok: false, needsRehash: false };
  const [saltB64, hashB64] = parts;

  const saltBuf = b64ToBuf(saltB64);
  const expectedBuf = b64ToBuf(hashB64);
  const key = await importKey(password);
  const actualBuf = await deriveHash(key, saltBuf);

  // Constant-time byte comparison
  const actual = new Uint8Array(actualBuf);
  const expected = new Uint8Array(expectedBuf);
  if (actual.length !== expected.length) return { ok: false, needsRehash: false };
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return { ok: diff === 0, needsRehash: false };
}

/**
 * Assess password strength. Returns a score 0–4 and a label.
 * Used by the signup form to give real-time feedback.
 *
 * @param {string} pw
 * @returns {{ score: number, label: string, color: string }}
 */
export function passwordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: 'transparent' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { label: 'Too weak',    color: '#ef4444' },
    { label: 'Weak',        color: '#f97316' },
    { label: 'Fair',        color: '#eab308' },
    { label: 'Strong',      color: '#22c55e' },
    { label: 'Very strong', color: '#10b981' },
  ];
  const level = levels[Math.min(score, 4)];
  return { score, ...level };
}

/**
 * Generate a cryptographically random session token (32 bytes → 64 hex chars).
 * @returns {string}
 */
export function generateSessionToken() {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('');
}
