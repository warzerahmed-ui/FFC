import {
  Env,
  hashPassword,
  jsonResponse,
  requireSession,
  verifyPassword,
} from '../_lib/auth';

const MAX_ATTEMPTS = 8;
const WINDOW_SECONDS = 10 * 60;

interface StoredUser {
  id?: string;
  role?: string;
  isSuperAdmin?: boolean;
  isActive?: boolean;
  password?: unknown;
  [k: string]: unknown;
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const auth = await requireSession(request, env);
  if ('error' in auth) return auth.error;

  if (auth.session.role === 'SUPER_ADMIN') {
    return jsonResponse(
      { ok: false, error: 'وشەی نهێنی سوپەر ئەدمین تەنها لە Cloudflare Secrets دەگۆڕدرێت' },
      403
    );
  }

  const db = env.DB;
  if (!db) return jsonResponse({ ok: false, error: 'D1 binding missing' }, 503);

  try {
    await db.batch([
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

    let body: { currentPassword?: unknown; newPassword?: unknown } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return jsonResponse({ ok: false, error: 'Invalid request' }, 400);
    }

    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword.trim() : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword.trim() : '';
    if (!currentPassword || newPassword.length < 4 || newPassword.length > 100) {
      return jsonResponse({ ok: false, error: 'وشەی نهێنی نوێ دەبێت لانیکەم ٤ پیت بێت' }, 400);
    }

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

    const targetIndex = users.findIndex(
      u => u && u.id === auth.session.uid && !u.isSuperAdmin && u.isActive !== false
    );
    if (targetIndex === -1) {
      return jsonResponse({ ok: false, error: 'ئەکاونت نەدۆزرایەوە' }, 404);
    }

    const target = users[targetIndex];
    const valid = await verifyPassword(currentPassword, target.password);
    if (!valid) {
      await db.prepare('INSERT INTO login_attempts (ip, ts) VALUES (?, ?)').bind(ip, now).run();
      await db.prepare('DELETE FROM login_attempts WHERE ts < ?').bind(now - WINDOW_SECONDS * 6).run();
      return jsonResponse({ ok: false, error: 'وشەی نهێنی ئێستا هەڵەیە' }, 401);
    }

    const updatedUsers = [...users];
    updatedUsers[targetIndex] = {
      ...target,
      password: await hashPassword(newPassword),
    };

    const nowIso = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO app_state (state_key, payload, updated_at)
         VALUES ('users', ?, ?)
         ON CONFLICT(state_key) DO UPDATE SET
           payload = excluded.payload,
           updated_at = excluded.updated_at`
      )
      .bind(JSON.stringify(updatedUsers), nowIso)
      .run();

    return jsonResponse({ ok: true, updatedAt: nowIso });
  } catch {
    return jsonResponse({ ok: false, error: 'Failed to update password' }, 500);
  }
};
