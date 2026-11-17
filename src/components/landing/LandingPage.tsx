import React, { useEffect, useMemo, useState } from 'react';
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  Trash2,
  MessageCircle,
  MapPin,
  Phone,
  LogIn,
  ArrowRight,
  X,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { roundTo250 } from '../../types';
import { FactoryLogo } from '../layout/FactoryLogo';

interface PublicProduct {
  id: string;
  nameKu: string;
  category: string;
  pricePerKg: number;
  unit: 'KG' | 'PIECE';
}

interface PublicFactoryInfo {
  factoryName: string;
  shortCode: string;
  tagline: string;
  showroomName: string;
  phone1: string;
  phone2: string;
  address: string;
  currency: string;
  logoUrl?: string;
  orderWhatsapp: string;
}

interface CartItem {
  product: PublicProduct;
  qty: number;
}

interface LandingPageProps {
  onOpenLogin: () => void;
  isAuthenticated?: boolean;
  onBackToSystem?: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  ALL: 'هەموو بەرهەمەکان',
  WHOLE_CHICKEN: 'مریشکی تەواو',
  BREAST: 'سنگی مریشک',
  THIGH: 'ڕان و دەسکە ڕان',
  WINGS: 'باڵ و مل',
  GIBLET: 'جگەر و دڵ و قەسیل',
  BONES_SCRAP: 'ئێسک و شلمک',
  OTHER: 'بەش و پارچەی تر',
};

function normalizeWhatsappNumber(raw: string): string {
  const digits = (raw || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return `964${digits.slice(1)}`;
  return digits;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenLogin,
  isAuthenticated = false,
  onBackToSystem,
}) => {
  const { factorySettings, products: contextProducts } = useApp();

  const [loading, setLoading] = useState(true);
  const [factory, setFactory] = useState<PublicFactoryInfo>(() => ({
    factoryName: factorySettings.factoryName,
    shortCode: factorySettings.shortCode,
    tagline: factorySettings.tagline,
    showroomName: factorySettings.showroomName,
    phone1: factorySettings.phone1,
    phone2: factorySettings.phone2,
    address: factorySettings.address,
    currency: factorySettings.currency || 'د.ع',
    logoUrl: factorySettings.logoUrl,
    orderWhatsapp: factorySettings.orderWhatsapp || factorySettings.phone1 || '',
  }));
  const [catalog, setCatalog] = useState<PublicProduct[]>(() =>
    contextProducts.map(p => ({
      id: p.id,
      nameKu: p.nameKu,
      category: p.category,
      pricePerKg: p.pricePerKg,
      unit: p.unit,
    }))
  );

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCartModal, setShowCartModal] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderSent, setOrderSent] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch('/api/public-catalog');
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok?: boolean;
          factory?: PublicFactoryInfo;
          products?: PublicProduct[];
        };
        if (active && data.ok) {
          if (data.factory) setFactory(data.factory);
          if (Array.isArray(data.products)) setCatalog(data.products);
        }
      } catch {
        // fallback to default/context state
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const availableCategories = useMemo(() => {
    const cats = new Set<string>(['ALL']);
    catalog.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [catalog]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return catalog.filter(p => {
      const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
      const matchSearch = !q || p.nameKu.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [catalog, selectedCategory, searchQuery]);

  const addToCart = (product: PublicProduct) => {
    const step = product.unit === 'PIECE' ? 1 : 1;
    setCart(prev => {
      const idx = prev.findIndex(c => c.product.id === product.id);
      if (idx > -1) {
        return prev.map((c, i) =>
          i === idx ? { ...c, qty: Number((c.qty + step).toFixed(2)) } : c
        );
      }
      return [...prev, { product, qty: step }];
    });
    setOrderSent(false);
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart(prev =>
      prev
        .map(c =>
          c.product.id === productId
            ? { ...c, qty: Number(Math.max(0, c.qty + delta).toFixed(2)) }
            : c
        )
        .filter(c => c.qty > 0)
    );
  };

  const setCartQtyExact = (productId: string, val: number) => {
    if (!Number.isFinite(val) || val <= 0) {
      setCart(prev => prev.filter(c => c.product.id !== productId));
      return;
    }
    setCart(prev =>
      prev.map(c => (c.product.id === productId ? { ...c, qty: Number(val.toFixed(2)) } : c))
    );
  };

  const cartTotal = useMemo(
    () =>
      roundTo250(
        cart.reduce((sum, c) => sum + c.qty * c.product.pricePerKg, 0)
      ),
    [cart]
  );

  const totalCartItems = cart.length;
  const whatsappDigits = normalizeWhatsappNumber(factory.orderWhatsapp || factory.phone1);

  const handleSendWhatsAppOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    if (!whatsappDigits) {
      alert('ژمارەی واتسئەپی ئۆردەر لە سیتینی کارگە دیاری نەکراوە.');
      return;
    }

    const lines = cart.map((c, idx) => {
      const unitLabel = c.product.unit === 'PIECE' ? 'دانە' : 'کگم';
      const lineTotal = roundTo250(c.qty * c.product.pricePerKg);
      return `${idx + 1}. ${c.product.nameKu} — ${c.qty} ${unitLabel} × ${c.product.pricePerKg.toLocaleString()} = ${lineTotal.toLocaleString()} ${factory.currency}`;
    });

    const message = [
      `سڵاو، ئۆردەرێکی نوێم هەیە لە ${factory.factoryName} (${factory.shortCode}) 🍗`,
      '',
      '📦 *بەرهەمە داواکراوەکان:*',
      ...lines,
      '',
      `💰 *کۆی گشتی خەمڵێنراو:* ${cartTotal.toLocaleString()} ${factory.currency}`,
      '',
      '👤 *زانیاری کڕیار:*',
      `• ناو: ${customerName.trim()}`,
      `• مۆبایل: ${customerPhone.trim()}`,
      `• ناونیشان: ${customerAddress.trim()}`,
      ...(orderNotes.trim() ? [`• تێبینی: ${orderNotes.trim()}`] : []),
    ].join('\n');

    window.open(`https://wa.me/${whatsappDigits}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    setOrderSent(true);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col">
      {/* Sticky Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-black/[0.06] px-4 sm:px-8 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <FactoryLogo
              size="md"
              logoUrlOverride={factory.logoUrl}
              altOverride={factory.factoryName}
            />
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-black text-[#1D1D1F] truncate">
                {factory.factoryName}
              </div>
              <div className="text-[11px] font-bold text-[#0071E3] truncate">
                {factory.shortCode} • {factory.showroomName}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowCartModal(true)}
              className="relative px-3.5 py-2 rounded-full bg-[#25D366] hover:bg-[#20BD5A] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>سەبەتە</span>
              {totalCartItems > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-white text-[#1B7A34] text-[10px] font-black tabular-nums">
                  {totalCartItems}
                </span>
              )}
            </button>

            {isAuthenticated && onBackToSystem ? (
              <button
                type="button"
                onClick={onBackToSystem}
                className="px-3.5 py-2 rounded-full bg-[#1D1D1F] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>گەڕانەوە بۆ سیستەم</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenLogin}
                className="px-3.5 py-2 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] border border-black/[0.08] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-[#0071E3]" />
                <span className="hidden sm:inline">چوونەژوورەوەی کارمەندان</span>
                <span className="sm:hidden">سیستەم</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Showcase */}
      <section className="px-4 sm:px-8 pt-6 pb-4">
        <div className="max-w-6xl mx-auto rounded-[32px] overflow-hidden bg-gradient-to-br from-[#0061DF] via-[#0047B3] to-[#0B192C] text-white p-6 sm:p-10 shadow-xl relative">
          <div className="pointer-events-none absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-16 w-72 h-72 rounded-full bg-[#25D366]/20 blur-3xl" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-[11px] font-bold">
                <Sparkles className="w-3.5 h-3.5 text-[#30D158]" />
                <span>فرێش • تەندروست • گەیاندنی خێرا</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-snug">
                {factory.factoryName} — داواکردنی ڕاستەوخۆی مریشکی فرێش
              </h1>

              <p className="text-xs sm:text-sm text-white/85 max-w-2xl leading-relaxed">
                {factory.tagline}. بەرهەمە دڵخوازەکانت هەڵبژێرە و تەنها بە یەک کلیک ئۆردەرەکەت ڕاستەوخۆ بە واتسئەپ بنێرە!
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <a
                  href="#catalog"
                  className="px-5 py-2.5 rounded-full bg-white text-[#0047B3] font-extrabold text-xs sm:text-sm shadow-sm hover:bg-slate-100 transition-all"
                >
                  بینینی بەرهەمەکان
                </a>
                {whatsappDigits && (
                  <a
                    href={`https://wa.me/${whatsappDigits}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 rounded-full bg-[#25D366] hover:bg-[#20BD5A] text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>پەیوەندی ڕاستەوخۆ بە واتسئەپ</span>
                  </a>
                )}
              </div>
            </div>

            <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2.5 text-xs">
              <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-[#30D158] shrink-0" />
                <div>
                  <div className="font-extrabold">کوالێتی ١٠٠٪ فرێش</div>
                  <div className="text-[11px] text-white/75">سەربڕینی ڕۆژانە و پاکژ</div>
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md flex items-center gap-3">
                <Truck className="w-5 h-5 text-sky-300 shrink-0" />
                <div>
                  <div className="font-extrabold">ئۆردەری خێرای واتسئەپ</div>
                  <div className="text-[11px] text-white/75">ئامادەکردن و گەیاندنی خێرا</div>
                </div>
              </div>
              {factory.address && (
                <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-amber-300 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-extrabold">ناونیشان</div>
                    <div className="text-[11px] text-white/75 truncate">{factory.address}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Catalog Section */}
      <main id="catalog" className="flex-1 px-4 sm:px-8 py-5">
        <div className="max-w-6xl mx-auto space-y-5">
          {/* Search + Category Pills */}
          <div className="apple-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#86868B] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="گەڕان لە ناوی بەرهەمەکان..."
                className="apple-input w-full pr-10 pl-4 py-2 text-xs font-semibold"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
              {availableCategories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-[#0071E3] text-white shadow-xs'
                      : 'bg-[#F5F5F7] text-[#515154] hover:bg-[#E8E8ED]'
                  }`}
                >
                  {CATEGORY_LABELS[cat] || cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          {loading && catalog.length === 0 ? (
            <div className="apple-card p-12 text-center text-xs font-bold text-[#86868B]">
              بارکردنی لیستی بەرهەمەکان...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="apple-card p-12 text-center space-y-2">
              <div className="text-sm font-extrabold text-[#1D1D1F]">هیچ بەرهەمێک بەردەست نییە</div>
              <p className="text-xs text-[#86868B]">
                تکایە دواتر سەردانمان بکەرەوە یان ڕاستەوخۆ پەیوەندیمان پێوە بکە.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map(prod => {
                const inCart = cart.find(c => c.product.id === prod.id);
                const unitText = prod.unit === 'PIECE' ? 'دانە' : 'کیلۆ';
                return (
                  <div
                    key={prod.id}
                    className="apple-card apple-card-hover p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] text-[10px] font-bold">
                          {CATEGORY_LABELS[prod.category] || prod.category}
                        </span>
                        <span className="text-[11px] font-semibold text-[#86868B]">
                          بە {unitText}
                        </span>
                      </div>

                      <h3 className="text-base font-extrabold text-[#1D1D1F]">
                        {prod.nameKu}
                      </h3>

                      <div className="text-xl font-black text-[#0071E3] tabular-nums">
                        {prod.pricePerKg.toLocaleString()}{' '}
                        <span className="text-xs font-bold text-[#515154]">
                          {factory.currency} / {unitText}
                        </span>
                      </div>
                    </div>

                    {inCart ? (
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/[0.05]">
                        <div className="flex items-center gap-1.5 bg-[#F5F5F7] rounded-full p-1">
                          <button
                            type="button"
                            onClick={() => updateCartQty(prod.id, prod.unit === 'PIECE' ? 1 : 0.5)}
                            className="w-7 h-7 rounded-full bg-white text-[#1D1D1F] font-bold flex items-center justify-center shadow-2xs cursor-pointer"
                            aria-label="زیادکردن"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2 text-xs font-black tabular-nums">
                            {inCart.qty} {prod.unit === 'PIECE' ? 'دانە' : 'کگم'}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(prod.id, prod.unit === 'PIECE' ? -1 : -0.5)}
                            className="w-7 h-7 rounded-full bg-white text-[#FF3B30] font-bold flex items-center justify-center shadow-2xs cursor-pointer"
                            aria-label="کەمکردنەوە"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowCartModal(true)}
                          className="px-3.5 py-2 rounded-full bg-[#25D366] text-white text-xs font-extrabold cursor-pointer"
                        >
                          تەواوکردن
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addToCart(prod)}
                        className="w-full py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>زیادکردن بۆ سەبەتە</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Sticky Bottom Cart Bar (when items in cart) */}
      {totalCartItems > 0 && (
        <div className="sticky bottom-3 z-30 px-4 pointer-events-none">
          <div className="max-w-xl mx-auto pointer-events-auto">
            <button
              type="button"
              onClick={() => setShowCartModal(true)}
              className="w-full py-3.5 px-5 rounded-full bg-[#1D1D1F] hover:bg-black text-white shadow-2xl flex items-center justify-between gap-3 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-0.5 rounded-full bg-[#25D366] text-white text-xs font-black tabular-nums">
                  {totalCartItems}
                </span>
                <span className="text-xs font-extrabold">بینین و ناردنی ئۆردەر بە واتسئەپ</span>
              </div>
              <span className="text-sm font-black text-[#30D158] tabular-nums">
                {cartTotal.toLocaleString()} {factory.currency}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-black/[0.06] bg-white px-4 sm:px-8 py-6 mt-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#515154]">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4">
            <span className="font-extrabold text-[#1D1D1F]">{factory.factoryName}</span>
            {factory.address && (
              <span className="inline-flex items-center gap-1 text-[#86868B]">
                <MapPin className="w-3.5 h-3.5 text-[#0071E3]" />
                {factory.address}
              </span>
            )}
            {(factory.orderWhatsapp || factory.phone1) && (
              <span dir="ltr" className="inline-flex items-center gap-1 font-mono font-bold">
                <Phone className="w-3.5 h-3.5 text-[#25D366]" />
                {factory.orderWhatsapp || factory.phone1}
              </span>
            )}
          </div>
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-[#86868B]">
            <span>دروستکراوە لەلایەن</span>
            <span dir="ltr" className="px-2.5 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] font-black">
              RAND SUITE
            </span>
          </div>
        </div>
      </footer>

      {/* Order Cart & WhatsApp Checkout Modal */}
      {showCartModal && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl border border-black/[0.08] apple-sheet">
            <div className="p-5 bg-[#FBFBFD] border-b border-black/[0.06] flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#25D366] text-white flex items-center justify-center">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#1D1D1F]">سەبەتەی کڕین و ناردن بە واتسئەپ</h3>
                  <p className="text-[11px] text-[#86868B]">ئۆردەرەکەت ڕاستەوخۆ دەچێتە سەر واتسئەپی فرۆشگا</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCartModal(false)}
                aria-label="داخستن"
                className="w-8 h-8 rounded-full bg-[#F5F5F7] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-[#86868B] font-semibold">
                  سەبەتەکەت بەتاڵە! تکایە لە لیستەکە بەرهەم هەڵبژێرە.
                </div>
              ) : (
                <>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {cart.map(item => {
                      const lineTotal = roundTo250(item.qty * item.product.pricePerKg);
                      return (
                        <div
                          key={item.product.id}
                          className="p-3 rounded-2xl bg-[#F5F5F7] flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="font-extrabold text-[#1D1D1F] truncate">
                              {item.product.nameKu}
                            </div>
                            <div className="text-[11px] text-[#86868B] tabular-nums">
                              {item.product.pricePerKg.toLocaleString()} {factory.currency} • کۆ: {lineTotal.toLocaleString()} {factory.currency}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <input
                              type="number"
                              step={item.product.unit === 'PIECE' ? '1' : '0.5'}
                              min="0.1"
                              value={item.qty}
                              onChange={e => setCartQtyExact(item.product.id, Number(e.target.value))}
                              className="w-16 bg-white rounded-xl px-2 py-1 text-center font-black tabular-nums border border-black/[0.08]"
                            />
                            <span className="text-[11px] font-bold text-[#515154]">
                              {item.product.unit === 'PIECE' ? 'دانە' : 'کگم'}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.product.id, -item.qty)}
                              aria-label="سڕینەوە"
                              className="p-1.5 rounded-lg text-[#FF3B30] hover:bg-[#FF3B30]/10 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#34C759]/10 border border-[#34C759]/25 flex items-center justify-between">
                    <span className="font-extrabold text-[#1D1D1F]">کۆی گشتی خەمڵێنراو:</span>
                    <span className="text-lg font-black text-[#248A3D] tabular-nums">
                      {cartTotal.toLocaleString()} {factory.currency}
                    </span>
                  </div>

                  {orderSent && (
                    <div className="p-3 rounded-2xl bg-[#34C759]/15 border border-[#34C759]/30 text-[#1B7A34] font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>واتسئەپ کرایەوە بۆ ناردنی ئۆردەرەکەت!</span>
                    </div>
                  )}

                  <form onSubmit={handleSendWhatsAppOrder} className="space-y-3 pt-1">
                    <div>
                      <label className="block font-bold text-[#515154] mb-1">ناوی تەواو *</label>
                      <input
                        type="text"
                        required
                        placeholder="نموونە: ئارام ئەحمەد"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        className="apple-input w-full px-3.5 py-2 font-semibold"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-[#515154] mb-1">ژمارەی مۆبایل *</label>
                        <input
                          type="tel"
                          required
                          dir="ltr"
                          placeholder="0770 000 0000"
                          value={customerPhone}
                          onChange={e => setCustomerPhone(e.target.value)}
                          className="apple-input w-full px-3.5 py-2 font-mono text-left"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#515154] mb-1">ناونیشان / گەڕەک *</label>
                        <input
                          type="text"
                          required
                          placeholder="نموونە: ڕزگاری - شەقامی..."
                          value={customerAddress}
                          onChange={e => setCustomerAddress(e.target.value)}
                          className="apple-input w-full px-3.5 py-2 font-semibold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-[#515154] mb-1">تێبینی (ئارەزوومەندانە)</label>
                      <input
                        type="text"
                        placeholder="نموونە: کاتی گەیاندن یان شێوازی بڕین..."
                        value={orderNotes}
                        onChange={e => setOrderNotes(e.target.value)}
                        className="apple-input w-full px-3.5 py-2"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 rounded-full bg-[#25D366] hover:bg-[#20BD5A] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>ناردنی ئۆردەر بە واتسئەپ</span>
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
