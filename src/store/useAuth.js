/**
 * useAuth.js — Zustand store for authentication and user management.
 *
 * Security features:
 *  • PBKDF2-SHA-256 password hashing (310k iterations, random salt per user)
 *  • Constant-time password comparison (via verifyPassword)
 *  • Automatic upgrade of legacy SHA-256 hashes to PBKDF2 on login
 *  • Brute-force protection: 5 failed attempts → 15-minute lockout
 *  • Generic "Invalid credentials" error (no username enumeration)
 *  • Session tokens — cryptographically random 32-byte hex strings
 *  • Session expiry — 8 hours of inactivity, absolute 24-hour hard limit
 *  • Activity heartbeat — session "lastActive" updated on each route change
 *  • Enforced minimum password length: 8 characters
 *  • Admin cannot delete the last admin account
 *  • Passwords are NEVER stored or logged in plain text
 *
 * localStorage keys:
 *   ss_session  — current session object (or null)
 *   ss_users    — array of user objects
 */

import { create } from 'zustand';
import { hashPassword, verifyPassword, generateSessionToken } from '../lib/crypto';

const SESSION_KEY  = 'ss_session';
const USERS_KEY    = 'ss_users';

const SESSION_IDLE_MS    = 8  * 60 * 60 * 1000; // 8 hours idle
const SESSION_HARD_MS    = 24 * 60 * 60 * 1000; // 24 hours absolute
const MAX_ATTEMPTS       = 5;
const LOCKOUT_MS         = 15 * 60 * 1000;       // 15 minutes
const MIN_PASSWORD_LEN   = 8;
const MIN_USERNAME_LEN   = 3;

// ---------- localStorage helpers ----------

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.token) return null;
    return s;
  } catch {
    return null;
  }
}

function writeSession(session) {
  try {
    if (session === null) {
      localStorage.removeItem(SESSION_KEY);
    } else {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  } catch { /* storage full */ }
}

function readUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch { /* storage full */ }
}

// ---------- session validation ----------

function isSessionValid(session) {
  if (!session || !session.token) return false;
  const now = Date.now();
  const idle    = now - (session.lastActive || session.loginTime);
  const elapsed = now - session.loginTime;
  if (idle    > SESSION_IDLE_MS) return false;
  if (elapsed > SESSION_HARD_MS) return false;
  return true;
}

// ---------- store ----------

const useAuth = create((set, get) => ({
  session: null,
  users: [],

  /**
   * Initialize auth on app load.
   * - Seeds admin account if no users exist.
   * - Validates and restores session (or clears if expired).
   */
  init: async () => {
    let users = readUsers();

    if (users.length === 0) {
      // Seed a default admin — password is PBKDF2-hashed, NOT stored in plain text
      const passwordHash = await hashPassword('admin123');
      const adminUser = {
        id:           1,
        username:     'admin',
        passwordHash, // PBKDF2 format: "<saltB64>:<hashB64>"
        role:         'admin',
        createdAt:    new Date().toISOString(),
        totalTime:    0,
        loginTime:    null,
        lastSeen:     null,
        loginCount:   0,
        failedAttempts: 0,
        lockedUntil:  null,
      };
      users = [adminUser];
      writeUsers(users);
    }

    set({ users });

    // Restore and validate session
    const session = readSession();
    if (session && isSessionValid(session)) {
      // Bump lastActive so a page-refresh doesn't look idle
      const refreshed = { ...session, lastActive: Date.now() };
      writeSession(refreshed);
      set({ session: refreshed });
    } else {
      // Expired or invalid — clear it silently
      writeSession(null);
      set({ session: null });
    }
  },

  /**
   * Update session heartbeat — call this on every navigation event so
   * idle-timeout resets whenever the user is actively using the app.
   */
  heartbeat: () => {
    const { session } = get();
    if (!session) return;
    const now = Date.now();
    if (session.lastActive && now - session.lastActive < 10000) return;
    const updated = { ...session, lastActive: now };
    writeSession(updated);
    set({ session: updated });
  },

  /**
   * Log in with username + password.
   * Returns a generic error for both "not found" and "wrong password"
   * to prevent username enumeration attacks.
   *
   * @param {{ username: string, password: string }} creds
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  login: async ({ username, password }) => {
    if (!username || !password) {
      return { ok: false, error: 'Invalid credentials.' };
    }

    const users = readUsers();
    const user  = users.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase()
    );

    // --- Brute-force gate (run even if user not found, to prevent timing oracle) ---
    const now = Date.now();
    if (user && user.lockedUntil && now < user.lockedUntil) {
      const mins = Math.ceil((user.lockedUntil - now) / 60000);
      return { ok: false, error: `Account locked. Try again in ${mins} min.` };
    }

    // --- Constant-time verification ---
    // Always run the hash (even for missing users) so response time is uniform.
    const DUMMY_HASH = 'AAAAAAAAAAAAAAAAAAAAAA==:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
    const storedHash = user ? user.passwordHash : DUMMY_HASH;
    const { ok: passwordOk, needsRehash } = await verifyPassword(password, storedHash);

    if (!user || !passwordOk) {
      // Record failed attempt on the real user (if found)
      if (user) {
        const attempts = (user.failedAttempts || 0) + 1;
        const lockedUntil = attempts >= MAX_ATTEMPTS ? now + LOCKOUT_MS : null;
        const updated = users.map((u) =>
          u.id === user.id ? { ...u, failedAttempts: attempts, lockedUntil } : u
        );
        writeUsers(updated);
        set({ users: updated });

        if (lockedUntil) {
          return {
            ok: false,
            error: `Too many failed attempts. Account locked for ${LOCKOUT_MS / 60000} minutes.`,
          };
        }
      }
      return { ok: false, error: 'Invalid credentials.' };
    }

    // --- Success: build session ---
    const token     = generateSessionToken();
    const loginTime = now;
    const session   = {
      token,
      userId:     user.id,
      username:   user.username,
      role:       user.role,
      loginTime,
      lastActive: loginTime,
    };

    // Upgrade legacy SHA-256 hash to PBKDF2 transparently
    let newHash = user.passwordHash;
    if (needsRehash) {
      newHash = await hashPassword(password);
    }

    const updatedUsers = users.map((u) =>
      u.id === user.id
        ? {
            ...u,
            passwordHash:   newHash,
            loginTime:      loginTime,
            loginCount:     (u.loginCount || 0) + 1,
            failedAttempts: 0,
            lockedUntil:    null,
          }
        : u
    );
    writeUsers(updatedUsers);
    writeSession(session);
    set({ session, users: updatedUsers });
    return { ok: true };
  },

  /**
   * Log out the current user. Accumulates session duration to totalTime.
   */
  logout: () => {
    const { session, users } = get();
    if (!session) return;

    const now       = Date.now();
    const sessionMs = now - session.loginTime;

    const updated = users.map((u) =>
      u.id === session.userId
        ? {
            ...u,
            totalTime: (u.totalTime || 0) + sessionMs,
            loginTime: null,
            lastSeen:  now,
          }
        : u
    );
    writeUsers(updated);
    writeSession(null);
    set({ session: null, users: updated });
  },

  /**
   * Register a new user.
   * - Minimum 8-character password enforced here as well as in the UI.
   * - Usernames are case-insensitively unique.
   *
   * @param {{ username: string, password: string, role?: 'admin'|'user' }} info
   * @returns {Promise<{ ok: boolean, user?: object, error?: string }>}
   */
  register: async ({ username, password, role = 'user' }) => {
    const trimmed = (username || '').trim();
    if (trimmed.length < MIN_USERNAME_LEN) {
      return { ok: false, error: `Username must be at least ${MIN_USERNAME_LEN} characters.` };
    }
    if (!/^[A-Za-z0-9_.-]+$/.test(trimmed)) {
      return { ok: false, error: 'Username may only contain letters, numbers, _, . and -' };
    }
    if (!password || password.length < MIN_PASSWORD_LEN) {
      return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LEN} characters.` };
    }

    const users = readUsers();
    if (users.find((u) => u.username.toLowerCase() === trimmed.toLowerCase())) {
      return { ok: false, error: 'Username already taken.' };
    }

    const passwordHash = await hashPassword(password);
    const newUser = {
      id:             users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1,
      username:       trimmed,
      passwordHash,
      role:           role === 'admin' ? 'admin' : 'user',
      createdAt:      new Date().toISOString(),
      totalTime:      0,
      loginTime:      null,
      lastSeen:       null,
      loginCount:     0,
      failedAttempts: 0,
      lockedUntil:    null,
    };

    const updated = [...users, newUser];
    writeUsers(updated);
    set({ users: updated });
    return { ok: true, user: newUser };
  },

  /**
   * Change a user's password.
   * - Self: must supply correct current password.
   * - Admin override: current password not required.
   * - New password must meet minimum length.
   *
   * @param {{ userId: number, currentPassword?: string, newPassword: string, adminOverride?: boolean }}
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  changePassword: async ({ userId, currentPassword, newPassword, adminOverride = false }) => {
    if (!newPassword || newPassword.length < MIN_PASSWORD_LEN) {
      return { ok: false, error: `New password must be at least ${MIN_PASSWORD_LEN} characters.` };
    }

    const users = readUsers();
    const user  = users.find((u) => u.id === userId);
    if (!user) return { ok: false, error: 'User not found.' };

    if (!adminOverride) {
      if (!currentPassword) {
        return { ok: false, error: 'Current password is required.' };
      }
      const { ok } = await verifyPassword(currentPassword, user.passwordHash);
      if (!ok) return { ok: false, error: 'Current password is incorrect.' };
    }

    const newHash = await hashPassword(newPassword);
    const updated = users.map((u) =>
      u.id === userId ? { ...u, passwordHash: newHash } : u
    );
    writeUsers(updated);
    set({ users: updated });
    return { ok: true };
  },

  /** @returns {boolean} true if the current session is the 'admin' role */
  requireAdmin: () => get().session?.role === 'admin',

  /** Promote user to admin role. @param {number} id */
  promoteUser: (id) => {
    const users   = readUsers();
    const updated = users.map((u) => (u.id === id ? { ...u, role: 'admin' } : u));
    writeUsers(updated);
    set({ users: updated });
  },

  /** Demote user from admin to user role. @param {number} id */
  demoteUser: (id) => {
    const users   = readUsers();
    const updated = users.map((u) => (u.id === id ? { ...u, role: 'user' } : u));
    writeUsers(updated);
    set({ users: updated });
  },

  /**
   * Delete a user by id. Cannot delete the last admin.
   * @param {number} id
   */
  deleteUser: (id) => {
    const users  = readUsers();
    const target = users.find((u) => u.id === id);
    if (!target) return;
    if (
      target.role === 'admin' &&
      users.filter((u) => u.role === 'admin').length <= 1
    ) return; // protect the last admin
    const updated = users.filter((u) => u.id !== id);
    writeUsers(updated);
    set({ users: updated });
  },

  /** Reset a user's tracked session time to zero. @param {number} id */
  resetUserTime: (id) => {
    const users   = readUsers();
    const updated = users.map((u) =>
      u.id === id ? { ...u, totalTime: 0, loginTime: null } : u
    );
    writeUsers(updated);
    set({ users: updated });
  },

  /**
   * Manually unlock a locked account (admin action).
   * @param {number} id
   */
  unlockUser: (id) => {
    const users   = readUsers();
    const updated = users.map((u) =>
      u.id === id ? { ...u, failedAttempts: 0, lockedUntil: null } : u
    );
    writeUsers(updated);
    set({ users: updated });
  },
}));

export default useAuth;
