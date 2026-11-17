import { Env, jsonResponse } from '../_lib/auth';

interface PublicProduct {
  id: string;
  nameKu: string;
  category: string;
  pricePerKg: number;
  unit: 'KG' | 'PIECE';
}

export const onRequestGet = async (context: { env: Env }) => {
  const { env } = context;
  const db = env.DB;
  if (!db) {
    return jsonResponse({ ok: false, error: 'Database unavailable' }, 503);
  }

  try {
    const { results } = await db
      .prepare("SELECT state_key, payload FROM app_state WHERE state_key IN ('factorySettings', 'products', 'branchStock')")
      .all<{ state_key: string; payload: string }>();

    const byKey = new Map((results || []).map(r => [r.state_key, r.payload]));

    let rawSettings: Record<string, unknown> = {};
    try {
      rawSettings = JSON.parse(byKey.get('factorySettings') || '{}') as Record<string, unknown>;
    } catch {
      rawSettings = {};
    }

    const factory = {
      factoryName: typeof rawSettings.factoryName === 'string' ? rawSettings.factoryName : 'فروج فریش چیکن',
      shortCode: typeof rawSettings.shortCode === 'string' ? rawSettings.shortCode : 'FFC',
      tagline:
        typeof rawSettings.tagline === 'string'
          ? rawSettings.tagline
          : 'مریشکی فرێش و پاکژ بە شێوەی ڕۆژانە',
      showroomName:
        typeof rawSettings.showroomName === 'string' ? rawSettings.showroomName : 'فرۆشگای تایبەت',
      phone1: typeof rawSettings.phone1 === 'string' ? rawSettings.phone1 : '',
      phone2: typeof rawSettings.phone2 === 'string' ? rawSettings.phone2 : '',
      address: typeof rawSettings.address === 'string' ? rawSettings.address : '',
      currency: typeof rawSettings.currency === 'string' ? rawSettings.currency : 'د.ع',
      logoUrl: typeof rawSettings.logoUrl === 'string' ? rawSettings.logoUrl : undefined,
      orderWhatsapp:
        typeof rawSettings.orderWhatsapp === 'string' && rawSettings.orderWhatsapp.trim()
          ? rawSettings.orderWhatsapp.trim()
          : typeof rawSettings.phone1 === 'string'
          ? rawSettings.phone1.trim()
          : '',
    };

    const productMap = new Map<string, PublicProduct>();

    try {
      const parsedProducts = JSON.parse(byKey.get('products') || '[]');
      if (Array.isArray(parsedProducts)) {
        for (const p of parsedProducts) {
          if (!p || typeof p !== 'object' || !p.id || !p.nameKu) continue;
          productMap.set(String(p.id), {
            id: String(p.id),
            nameKu: String(p.nameKu),
            category: typeof p.category === 'string' ? p.category : 'OTHER',
            pricePerKg: Number(p.pricePerKg) || 0,
            unit: p.unit === 'PIECE' ? 'PIECE' : 'KG',
          });
        }
      }
    } catch {
      // ignore invalid products json
    }

    try {
      const parsedBranch = JSON.parse(byKey.get('branchStock') || '[]');
      if (Array.isArray(parsedBranch)) {
        for (const b of parsedBranch) {
          if (!b || typeof b !== 'object' || !b.productId || !b.productName) continue;
          const id = String(b.productId);
          const existing = productMap.get(id);
          const retail = Number(b.retailPricePerKg) || 0;
          if (!existing) {
            productMap.set(id, {
              id,
              nameKu: String(b.productName),
              category: typeof b.category === 'string' ? b.category : 'OTHER',
              pricePerKg: retail,
              unit: b.unit === 'PIECE' ? 'PIECE' : 'KG',
            });
          } else if (retail > 0) {
            existing.pricePerKg = retail;
          }
        }
      }
    } catch {
      // ignore invalid branchStock json
    }

    return jsonResponse({
      ok: true,
      factory,
      products: Array.from(productMap.values()),
    });
  } catch {
    return jsonResponse({ ok: false, error: 'Failed to load catalog' }, 500);
  }
};
