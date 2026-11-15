import {
  D1PreparedStatementLike,
  Env,
  hashPassword,
  jsonResponse,
  requireSession,
  timingSafeEqual,
} from '../_lib/auth';

const ALLOWED_KEYS = new Set([
  'products',
  'intakes',
  'yields',
  'customers',
  'suppliers',
  'dispatches',
  'returns',
  'expenses',
  'vouchers',
  'posSales',
  'branchStock',
  'branchDeliveries',
  'branchExpenses',
  'custodyTransfers',
  'settlements',
  'users',
  'factorySettings',
  'trashItems',
  'activityLogs',
]);

// Only Admin / Super Admin may overwrite sensitive system configuration or trash.
const ADMIN_ONLY_WRITE_KEYS = new Set(['users', 'factorySettings', 'trashItems']);
const ADMIN_ONLY_READ_KEYS = new Set(['trashItems', 'activityLogs']);
const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN']);
const MAX_BODY_CHARS = 4_000_000;

const ALL_TABS = [
  'dashboard',
  'intake',
  'production',
  'ready-for-sale',
  'custody',
  'rep-sales',
  'pos',
  'gifts',
  'accounting',
  'reports',
  'settings',
];

const getDefaultTabsForRole = (role: string): string[] => {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return ALL_TABS;
    case 'ACCOUNTANT':
      return ['dashboard', 'accounting', 'reports'];
    case 'REP':
      return ['dashboard', 'custody', 'rep-sales', 'gifts'];
    case 'CASHIER':
      return ['dashboard', 'pos'];
    default:
      return ['dashboard'];
  }
};

// State key -> tabs permitted to write it for non-admin staff
const WRITE_KEY_TABS: Record<string, string[]> = {
  intakes: ['intake', 'production', 'accounting'],
  suppliers: ['intake', 'production', 'accounting'],
  yields: ['production'],
  products: ['production', 'ready-for-sale', 'custody', 'rep-sales', 'gifts'],
  custodyTransfers: ['ready-for-sale', 'custody', 'rep-sales', 'gifts'],
  dispatches: ['ready-for-sale', 'custody', 'rep-sales', 'gifts', 'pos'],
  returns: ['ready-for-sale', 'custody', 'rep-sales', 'gifts', 'pos'],
  customers: ['rep-sales', 'pos', 'accounting'],
  posSales: ['pos', 'ready-for-sale'],
  branchStock: ['pos', 'ready-for-sale'],
  branchDeliveries: ['pos', 'ready-for-sale'],
  branchExpenses: ['pos', 'ready-for-sale'],
  expenses: ['reports', 'accounting'],
  settlements: ['reports', 'accounting'],
  vouchers: ['accounting'],
};

interface UserRecord {
  id?: string;
  name?: string;
  phone?: string;
  role?: string;
  roleTitleKu?: string;
  isSuperAdmin?: boolean;
  isActive?: boolean;
  allowedTabs?: string[];
  password?: unknown;
  hasPassword?: boolean;
  [k: string]: unknown;
}

const ensureTable = async (db: NonNullable<Env['DB']>) => {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS app_state (
        state_key TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`
    ),
  ]);
};

const isSuper = (u: UserRecord) => u.isSuperAdmin === true || u.role === 'SUPER_ADMIN';

const sanitizeUserForAdmin = (u: UserRecord): UserRecord => {
  const { password, ...rest } = u;
  return { ...rest, hasPassword: typeof password === 'string' && password.length > 0 };
};

const sanitizeUserForStaff = (u: UserRecord): UserRecord => ({
  id: u.id,
  name: u.name,
  role: u.role,
  roleTitleKu: u.roleTitleKu,
  isActive: u.isActive,
});

interface CallerAccess {
  ok: true;
  isAdmin: boolean;
  canReadSettings: boolean;
  allowedTabs: Set<string>;
}

const resolveCallerAccess = (
  session: { uid: string; role: string },
  usersPayload?: string
): CallerAccess | { ok: false } => {
  if (session.role === 'SUPER_ADMIN') {
    return {
      ok: true,
      isAdmin: true,
      canReadSettings: true,
      allowedTabs: new Set(ALL_TABS),
    };
  }

  if (usersPayload) {
    try {
      const parsedUsers = JSON.parse(usersPayload) as UserRecord[];
      if (Array.isArray(parsedUsers)) {
        const me = parsedUsers.find(u => u && u.id === session.uid);
        if (!me || me.isActive === false) {
          return { ok: false };
        }
        const effectiveRole = me.role || session.role;
        const isAdmin = ADMIN_ROLES.has(effectiveRole);
        const tabsList = Array.isArray(me.allowedTabs)
          ? me.allowedTabs
          : getDefaultTabsForRole(effectiveRole);
        const allowedTabs = new Set(tabsList);
        return {
          ok: true,
          isAdmin,
          canReadSettings: isAdmin || allowedTabs.has('settings'),
          allowedTabs,
        };
      }
    } catch {
      // Ignore parse error and fall back to token role
    }
  }

  const isAdmin = ADMIN_ROLES.has(session.role);
  const allowedTabs = new Set(getDefaultTabsForRole(session.role));
  return {
    ok: true,
    isAdmin,
    canReadSettings: isAdmin || allowedTabs.has('settings'),
    allowedTabs,
  };
};

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const auth = await requireSession(request, env);
  if ('error' in auth) return auth.error;

  const db = env.DB;
  if (!db) return jsonResponse({ ok: false, error: 'D1 binding missing' }, 503);

  try {
    await ensureTable(db);
    const { results } = await db
      .prepare('SELECT state_key, payload, updated_at FROM app_state')
      .all<{ state_key: string; payload: string; updated_at: string }>();

    const usersRow = (results || []).find(r => r.state_key === 'users');
    const caller = resolveCallerAccess(auth.session, usersRow?.payload);
    if (!caller.ok) {
      return jsonResponse({ ok: false, error: 'Account disabled' }, 401);
    }
    const { canReadSettings } = caller;

    const state: Record<string, unknown> = {};
    const keyVersions: Record<string, string> = {};
    let latestUpdatedAt = '';

    for (const row of results || []) {
      if (!ALLOWED_KEYS.has(row.state_key)) continue;
      if (ADMIN_ONLY_READ_KEYS.has(row.state_key) && !canReadSettings) continue;

      try {
        let value: unknown = JSON.parse(row.payload);
        if (row.state_key === 'users' && Array.isArray(value)) {
          // Strip super admin + never send password hashes; staff only see minimal directory fields for others.
          value = (value as UserRecord[])
            .filter(u => u && !isSuper(u))
            .map(u =>
              canReadSettings || u.id === auth.session.uid
                ? sanitizeUserForAdmin(u)
                : sanitizeUserForStaff(u)
            );
        }
        state[row.state_key] = value;
        if (row.updated_at) {
          keyVersions[row.state_key] = row.updated_at;
          if (row.updated_at > latestUpdatedAt) {
            latestUpdatedAt = row.updated_at;
          }
        }
      } catch {
        // Ignore corrupted JSON row
      }
    }

    return jsonResponse({
      ok: true,
      empty: Object.keys(state).length === 0,
      serverUpdatedAt: latestUpdatedAt || null,
      keyVersions,
      state,
    });
  } catch {
    return jsonResponse({ ok: false, error: 'Failed to read state' }, 500);
  }
};

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const auth = await requireSession(request, env);
  if ('error' in auth) return auth.error;

  const db = env.DB;
  if (!db) return jsonResponse({ ok: false, error: 'D1 binding missing' }, 503);

  try {
    await ensureTable(db);

    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) {
      return jsonResponse({ ok: false, error: 'Payload too large' }, 413);
    }
    let body: { state?: Record<string, unknown>; baseVersions?: Record<string, string> };
    try {
      body = JSON.parse(text);
    } catch {
      return jsonResponse({ ok: false, error: 'Invalid payload' }, 400);
    }
    const incoming = body?.state;
    const baseVersions =
      body?.baseVersions && typeof body.baseVersions === 'object' ? body.baseVersions : {};
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      return jsonResponse({ ok: false, error: 'Invalid payload' }, 400);
    }

    const existingAll = await db
      .prepare('SELECT state_key, payload, updated_at FROM app_state')
      .all<{ state_key: string; payload: string; updated_at: string }>();
    const existingByKey = new Map(
      (existingAll.results || []).map(r => [r.state_key, r])
    );

    const caller = resolveCallerAccess(auth.session, existingByKey.get('users')?.payload);
    if (!caller.ok) {
      return jsonResponse({ ok: false, error: 'Account disabled' }, 401);
    }
    const { isAdmin, allowedTabs } = caller;

    const nowIso = new Date().toISOString();
    const statements: D1PreparedStatementLike[] = [];
    const nextKeyVersions: Record<string, string> = {};
    const conflicts: string[] = [];
    const conflictState: Record<string, unknown> = {};
    const reservedSuperPhone = env.SUPER_ADMIN_PHONE?.trim().toLowerCase() || '';

    for (const [key, rawValue] of Object.entries(incoming)) {
      if (!ALLOWED_KEYS.has(key) || rawValue === undefined) continue;
      if (ADMIN_ONLY_WRITE_KEYS.has(key) && !isAdmin) continue;
      if (!isAdmin && key !== 'activityLogs') {
        const permittedTabs = WRITE_KEY_TABS[key];
        if (!permittedTabs || !permittedTabs.some(t => allowedTabs.has(t))) {
          continue;
        }
      }

      const existingRow = existingByKey.get(key);
      const clientBaseVersion = baseVersions[key];
      if (
        existingRow &&
        typeof clientBaseVersion === 'string' &&
        clientBaseVersion.length > 0 &&
        existingRow.updated_at &&
        existingRow.updated_at !== clientBaseVersion
      ) {
        conflicts.push(key);
        nextKeyVersions[key] = existingRow.updated_at;
        try {
          let parsed = JSON.parse(existingRow.payload);
          if (key === 'users' && Array.isArray(parsed)) {
            parsed = (parsed as UserRecord[])
              .filter(u => u && !isSuper(u))
              .map(sanitizeUserForAdmin);
          }
          conflictState[key] = parsed;
        } catch {
          // ignore corrupted row
        }
        continue;
      }

      let value: unknown = rawValue;

      if (key === 'users') {
        if (!Array.isArray(rawValue)) continue;
        let existing: UserRecord[] = [];
        if (existingRow) {
          try {
            const parsed = JSON.parse(existingRow.payload);
            if (Array.isArray(parsed)) existing = parsed as UserRecord[];
          } catch {
            existing = [];
          }
        }
        const prevById = new Map(existing.filter(u => u && u.id).map(u => [u.id as string, u]));

        const next: UserRecord[] = [];
        for (const raw of rawValue as UserRecord[]) {
          if (!raw || typeof raw !== 'object' || !raw.id) continue;
          if (isSuper(raw)) continue;
          const cleanPhone = typeof raw.phone === 'string' ? raw.phone.trim().toLowerCase() : '';
          if (reservedSuperPhone && cleanPhone && timingSafeEqual(cleanPhone, reservedSuperPhone)) {
            continue;
          }
          const prev = prevById.get(raw.id);
          if (prev && isSuper(prev)) continue;

          const { password, hasPassword: _hp, ...rest } = raw;
          void _hp;
          const plain = typeof password === 'string' ? password.trim() : '';
          let stored: unknown = prev?.password;
          if (plain) stored = await hashPassword(plain);
          next.push(stored ? { ...rest, password: stored } : { ...rest });
        }
        value = next;
      }

      if (key === 'activityLogs') {
        if (!Array.isArray(rawValue)) continue;
        if (!isAdmin && existingRow) {
          let existingLogs: { id?: string }[] = [];
          try {
            const parsed = JSON.parse(existingRow.payload);
            if (Array.isArray(parsed)) existingLogs = parsed;
          } catch {
            existingLogs = [];
          }
          const existingIds = new Set(
            existingLogs.map(l => (l && typeof l.id === 'string' ? l.id : '')).filter(Boolean)
          );
          const newLogs = (rawValue as { id?: string }[]).filter(
            l => l && typeof l.id === 'string' && !existingIds.has(l.id)
          );
          value = [...newLogs, ...existingLogs].slice(0, 500);
        }
      }

      nextKeyVersions[key] = nowIso;
      statements.push(
        db
          .prepare(
            `INSERT INTO app_state (state_key, payload, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(state_key) DO UPDATE SET
               payload = excluded.payload,
               updated_at = excluded.updated_at`
          )
          .bind(key, JSON.stringify(value), nowIso)
      );
    }

    if (statements.length > 0) {
      await db.batch(statements);
    }

    return jsonResponse({
      ok: true,
      savedKeys: statements.length,
      serverUpdatedAt: nowIso,
      keyVersions: nextKeyVersions,
      conflicts,
      conflictState,
    });
  } catch {
    return jsonResponse({ ok: false, error: 'Failed to write state' }, 500);
  }
};
