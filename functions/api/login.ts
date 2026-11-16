import {
  Env,
  SESSION_TTL_SECONDS,
  hashPassword,
  jsonResponse,
  signToken,
  timingSafeEqual,
  verifyPassword,
} from '../_lib/auth';

const MAX_ATTEMPTS = 8;
const WINDOW_SECONDS = 10 * 60;

interface StoredUser {
  id: string;
  name: string;
  phone: string;
  password?: string;
  role: string;
  roleTitleKu?: string;
  isSuperAdmin?: boolean;
  isActive?: boolean;
  avatarEmoji?: string;
  allowedTabs?: string[];
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const db = env.DB;
  if (!db || !env.AUTH_SECRET) {
    return jsonResponse({ ok: false, error: 'Server auth not configured' }, 503);
  }

  try {
    await db.batch([
      db.prepare(
        `CREATE TABLE IF NOT EXISTS app_state (
          state_key TEXT PRIMARY KEY,
          payload TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      ),
      db.prepare(
        `CREATE TABLE IF NOT EXISTS login_attempts (
          ip TEXT NOT NULL,
          ts INTEGER NOT NULL
        )`
      ),
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_ts ON login_attempts(ip, ts)`
      ),
    ]);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const now = Math.floor(Date.now() / 1000);

    const recent = await db
      .prepare('SELECT COUNT(*) AS c FROM login_attempts WHERE ip = ? AND ts > ?')
      .bind(ip, now - WINDOW_SECONDS)
      .all<{ c: number }>();
    if ((recent.results?.[0]?.c || 0) >= MAX_ATTEMPTS) {
      return jsonResponse({ ok: false, error: 'TOO_MANY_ATTEMPTS' }, 429);
    }

    let body: { phone?: unknown; password?: unknown } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return jsonResponse({ ok: false, error: 'Invalid request' }, 400);
    }
    if (typeof body.phone !== 'string' || typeof body.password !== 'string') {
      return jsonResponse({ ok: false, error: 'Invalid request' }, 400);
    }
    const phone = body.phone.trim().toLowerCase();
    const password = body.password.trim();
    if (!phone || !password || phone.length > 40 || password.length > 100) {
      return jsonResponse({ ok: false, error: 'Invalid credentials' }, 401);
    }

    let matched: StoredUser | null = null;

    // Super Admin lives ONLY in Cloudflare secrets (never in code or D1).
    if (
      env.SUPER_ADMIN_PHONE &&
      env.SUPER_ADMIN_PASSWORD &&
      timingSafeEqual(phone, env.SUPER_ADMIN_PHONE.trim().toLowerCase()) &&
      timingSafeEqual(password, env.SUPER_ADMIN_PASSWORD.trim())
    ) {
      matched = {
        id: 'user-super-admin',
        name: 'سوپەر ئەدمین',
        phone: env.SUPER_ADMIN_PHONE,
        role: 'SUPER_ADMIN',
        roleTitleKu: 'سوپەر ئەدمین (دەسەڵاتی گشتی)',
        isSuperAdmin: true,
        avatarEmoji: '👑',
      };
    } else {
      const rows = await db
        .prepare("SELECT payload FROM app_state WHERE state_key = 'users'")
        .all<{ payload: string }>();
      let users: StoredUser[] = [];
      try {
        const parsed = JSON.parse(rows.results?.[0]?.payload || '[]');
        if (Array.isArray(parsed)) users = parsed as StoredUser[];
      } catch {
        users = [];
      }
      let needsMigration = false;
      for (const u of users) {
        if (!u) continue;
        if (u.isSuperAdmin || u.role === 'SUPER_ADMIN') {
          needsMigration = true;
          continue;
        }
        if (typeof u.password === 'string' && u.password.length > 0 && !u.password.startsWith('pbkdf2$')) {
          needsMigration = true;
        }
        if (u.isActive === false) continue;
        if ((u.phone || '').trim().toLowerCase() !== phone) continue;

        const isLegacyPlain = typeof u.password === 'string' && !u.password.startsWith('pbkdf2$');
        const passwordValid = isLegacyPlain
          ? timingSafeEqual(password, u.password as string)
          : await verifyPassword(password, u.password);
        if (passwordValid && !matched) {
          matched = u;
        }
      }

      if (needsMigration) {
        const migratedUsers: StoredUser[] = [];
        for (const u of users) {
          if (!u || u.isSuperAdmin || u.role === 'SUPER_ADMIN') continue;
          if (typeof u.password === 'string' && u.password.length > 0 && !u.password.startsWith('pbkdf2$')) {
            migratedUsers.push({ ...u, password: await hashPassword(u.password.trim()) });
          } else {
            migratedUsers.push(u);
          }
        }
        await db
          .prepare(
            `INSERT INTO app_state (state_key, payload, updated_at)
             VALUES ('users', ?, ?)
             ON CONFLICT(state_key) DO UPDATE SET
               payload = excluded.payload,
               updated_at = excluded.updated_at`
          )
          .bind(JSON.stringify(migratedUsers), new Date().toISOString())
          .run();
      }
    }

    if (!matched) {
      await db.prepare('INSERT INTO login_attempts (ip, ts) VALUES (?, ?)').bind(ip, now).run();
      await db.prepare('DELETE FROM login_attempts WHERE ts < ?').bind(now - WINDOW_SECONDS * 6).run();
      return jsonResponse({ ok: false, error: 'Invalid credentials' }, 401);
    }

    await db.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();

    const token = await signToken(
      { uid: matched.id, role: matched.role, exp: now + SESSION_TTL_SECONDS },
      env.AUTH_SECRET
    );
    const safeUser = { ...matched } as Partial<StoredUser>;
    delete safeUser.password;
    return jsonResponse({ ok: true, token, user: safeUser });
  } catch {
    return jsonResponse({ ok: false, error: 'Login failed' }, 500);
  }
};
