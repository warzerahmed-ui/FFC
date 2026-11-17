import type { User, UserRole } from '../types';

export interface OfflineSnapshotPayload {
  state: Record<string, unknown>;
  keyVersions: Record<string, string>;
  lastSyncedJsonByKey: Record<string, string>;
  serverUpdatedAt: string | null;
  callerUser: User;
  savedAt: number;
}

export interface OfflinePendingPayload {
  delta: Record<string, unknown>;
  baseVersions: Record<string, string>;
  updatedAt: number;
}

export interface OfflineUserMeta {
  userId: string;
  role: UserRole;
  offlineEnabled: boolean;
}

const DB_NAME = 'ffc_offline_vault_db';
const DB_VERSION = 1;
const STORE_NAME = 'vault';
const OFFLINE_META_KEY = 'ffc_offline_user_meta_v1';
const OFFLINE_PREF_PREFIX = 'ffc_offline_pref_v1_';
const LOCK_PIN_PREFIX = 'ffc_lock_pin_v1_';

const keyCache = new Map<string, CryptoKey>();

export const isRoleOfflineDefault = (role: UserRole): boolean =>
  role === 'REP' || role === 'CASHIER' || role === 'WAREHOUSE_MANAGER';

export const getOfflinePreference = (userId: string, role: UserRole): boolean => {
  if (!userId) return false;
  try {
    const raw = localStorage.getItem(`${OFFLINE_PREF_PREFIX}${userId}`);
    if (raw === 'on') return true;
    if (raw === 'off') return false;
  } catch {
    // ignore storage errors
  }
  return isRoleOfflineDefault(role);
};

export const setOfflinePreference = (userId: string, enabled: boolean): void => {
  if (!userId) return;
  try {
    localStorage.setItem(`${OFFLINE_PREF_PREFIX}${userId}`, enabled ? 'on' : 'off');
  } catch {
    // ignore storage errors
  }
};

export const saveOfflineUserMeta = (meta: OfflineUserMeta): void => {
  try {
    localStorage.setItem(OFFLINE_META_KEY, JSON.stringify(meta));
  } catch {
    // ignore
  }
};

export const loadOfflineUserMeta = (): OfflineUserMeta | null => {
  try {
    const raw = localStorage.getItem(OFFLINE_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OfflineUserMeta>;
    if (typeof parsed.userId === 'string' && typeof parsed.role === 'string' && typeof parsed.offlineEnabled === 'boolean') {
      return parsed as OfflineUserMeta;
    }
    return null;
  } catch {
    return null;
  }
};

export const clearOfflineUserMeta = (): void => {
  try {
    localStorage.removeItem(OFFLINE_META_KEY);
  } catch {
    // ignore
  }
};

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const fromBase64 = (b64: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(b64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const hasSubtleCrypto = (): boolean =>
  typeof window !== 'undefined' && Boolean(window.crypto?.subtle);

const deriveAesKey = async (token: string, userId: string): Promise<CryptoKey> => {
  const cacheKey = `${userId}:${token.slice(-16)}`;
  const cached = keyCache.get(cacheKey);
  if (cached) return cached;

  const enc = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(token),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const aesKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(`ffc-offline-vault-v1:${userId}`),
      iterations: 50000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  keyCache.set(cacheKey, aesKey);
  return aesKey;
};

interface EncryptedRecord {
  userId: string;
  iv: string;
  ciphertext: string;
  updatedAt: number;
}

const encryptPayload = async (
  token: string,
  userId: string,
  payload: unknown
): Promise<EncryptedRecord | null> => {
  if (!hasSubtleCrypto() || !token || !userId) return null;
  const key = await deriveAesKey(token, userId);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  return {
    userId,
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
    updatedAt: Date.now(),
  };
};

const decryptPayload = async <T>(
  token: string,
  userId: string,
  record: EncryptedRecord | undefined
): Promise<T | null> => {
  if (!record || !hasSubtleCrypto() || !token || !userId) return null;
  if (record.userId !== userId) return null;
  try {
    const key = await deriveAesKey(token, userId);
    const iv = fromBase64(record.iv);
    const ciphertext = fromBase64(record.ciphertext);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    const json = new TextDecoder().decode(decrypted);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
};

const openVaultDb = (): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
};

const idbGet = async <T>(key: string): Promise<T | undefined> => {
  const db = await openVaultDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
};

const idbPut = async (key: string, value: unknown): Promise<void> => {
  const db = await openVaultDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
};

const idbDelete = async (key: string): Promise<void> => {
  const db = await openVaultDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
};

export const saveEncryptedSnapshot = async (
  token: string,
  userId: string,
  snapshot: OfflineSnapshotPayload
): Promise<void> => {
  const encrypted = await encryptPayload(token, userId, snapshot);
  if (!encrypted) return;
  await idbPut(`snapshot:${userId}`, encrypted);
};

export const loadEncryptedSnapshot = async (
  token: string,
  userId: string
): Promise<OfflineSnapshotPayload | null> => {
  const record = await idbGet<EncryptedRecord>(`snapshot:${userId}`);
  return decryptPayload<OfflineSnapshotPayload>(token, userId, record);
};

export const saveOfflinePendingDelta = async (
  token: string,
  userId: string,
  delta: Record<string, unknown>,
  baseVersions: Record<string, string>
): Promise<number> => {
  const existing = await loadOfflinePendingDelta(token, userId);
  const mergedDelta = { ...(existing?.delta || {}), ...delta };
  // Keep earliest known baseVersion for each key so conflict detection stays accurate
  const mergedBaseVersions = { ...baseVersions, ...(existing?.baseVersions || {}) };
  const payload: OfflinePendingPayload = {
    delta: mergedDelta,
    baseVersions: mergedBaseVersions,
    updatedAt: Date.now(),
  };
  const encrypted = await encryptPayload(token, userId, payload);
  if (encrypted) {
    await idbPut(`pending:${userId}`, encrypted);
  }
  return Object.keys(mergedDelta).length;
};

export const loadOfflinePendingDelta = async (
  token: string,
  userId: string
): Promise<OfflinePendingPayload | null> => {
  const record = await idbGet<EncryptedRecord>(`pending:${userId}`);
  return decryptPayload<OfflinePendingPayload>(token, userId, record);
};

export const clearOfflinePendingDelta = async (userId: string): Promise<void> => {
  if (!userId) return;
  await idbDelete(`pending:${userId}`);
};

export const purgeOfflineVault = async (): Promise<void> => {
  keyCache.clear();
  clearOfflineUserMeta();
  const db = await openVaultDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
};

// ==========================================
// QUICK-LOCK PIN (SHA-256 HASHED)
// ==========================================
const hashPin = async (userId: string, pin: string): Promise<string> => {
  const input = `ffc-pin-v1:${userId}:${pin}`;
  if (!hasSubtleCrypto()) {
    return btoa(input);
  }
  const digest = await window.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input)
  );
  return toBase64(new Uint8Array(digest));
};

export const hasLockPin = (userId: string): boolean => {
  if (!userId) return false;
  try {
    return Boolean(localStorage.getItem(`${LOCK_PIN_PREFIX}${userId}`));
  } catch {
    return false;
  }
};

export const setLockPin = async (userId: string, pin: string): Promise<void> => {
  if (!userId || !pin) return;
  const hashed = await hashPin(userId, pin);
  try {
    localStorage.setItem(`${LOCK_PIN_PREFIX}${userId}`, hashed);
  } catch {
    // ignore
  }
};

export const verifyLockPin = async (userId: string, pin: string): Promise<boolean> => {
  if (!userId || !pin) return false;
  try {
    const stored = localStorage.getItem(`${LOCK_PIN_PREFIX}${userId}`);
    if (!stored) return false;
    const hashed = await hashPin(userId, pin);
    return stored === hashed;
  } catch {
    return false;
  }
};

export const clearLockPin = (userId: string): void => {
  if (!userId) return;
  try {
    localStorage.removeItem(`${LOCK_PIN_PREFIX}${userId}`);
  } catch {
    // ignore
  }
};
