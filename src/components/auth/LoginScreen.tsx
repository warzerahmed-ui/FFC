import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Lock,
  Phone,
  Eye,
  EyeOff,
  ArrowLeft,
  Check,
  ShieldCheck,
  Cloud,
  KeyRound,
  AlertCircle,
} from 'lucide-react';
import { FactoryLogo } from '../layout/FactoryLogo';

const REMEMBER_KEY = 'ffc_remembered_login_v1';

interface RememberedCredentials {
  phone: string;
  password: string;
}

function readRememberedCredentials(): RememberedCredentials {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return { phone: '', password: '' };
    const parsed = JSON.parse(raw) as Partial<RememberedCredentials>;
    return {
      phone: typeof parsed.phone === 'string' ? parsed.phone : '',
      password: typeof parsed.password === 'string' ? parsed.password : '',
    };
  } catch {
    return { phone: '', password: '' };
  }
}

export const LoginScreen: React.FC = () => {
  const { login, factorySettings } = useApp();

  const [savedCredentials] = useState<RememberedCredentials>(() => readRememberedCredentials());
  const [phone, setPhone] = useState(savedCredentials.phone);
  const [password, setPassword] = useState(savedCredentials.password);
  const [rememberPassword, setRememberPassword] = useState(true);
  const [showForgotInfo, setShowForgotInfo] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleToggleRemember = () => {
    setRememberPassword(prev => {
      const next = !prev;
      if (!next) {
        try {
          localStorage.removeItem(REMEMBER_KEY);
        } catch {
          // ignore storage failures
        }
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    const result = await login(phone, password);
    setLoading(false);
    if (result.ok) {
      try {
        if (rememberPassword) {
          localStorage.setItem(
            REMEMBER_KEY,
            JSON.stringify({ phone: phone.trim(), password })
          );
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
      } catch {
        // ignore storage failures
      }
      return;
    }
    setError(result.error || 'ژمارەی مۆبایل یان وشەی نهێنی هەڵەیە');
    setPassword('');
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden flex items-center justify-center p-4 sm:p-6 lg:p-10 bg-gradient-to-br from-[#EEF2FF] via-[#F8FAFC] to-[#E2E8F0]">
      {/* Ambient Background Accents */}
      <div className="pointer-events-none absolute -top-32 -right-28 w-[440px] h-[440px] rounded-full bg-[#0071E3]/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-36 -left-24 w-[420px] h-[420px] rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[560px] rounded-full bg-sky-400/12 blur-3xl" />

      <div className="relative z-10 max-w-[940px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 rounded-[32px] overflow-hidden shadow-[0_25px_80px_-15px_rgba(15,23,42,0.18)] border border-white/90 bg-white/95 backdrop-blur-2xl apple-sheet">
        {/* Brand & Enterprise Showcase Panel (Right side in RTL) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#0061DF] via-[#0047B3] to-[#0B192C] text-white p-7 sm:p-9 flex flex-col justify-between relative overflow-hidden">
          <div className="pointer-events-none absolute -top-16 -left-16 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-14 w-56 h-56 rounded-full bg-sky-400/20 blur-2xl" />

          <div className="relative z-10">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <FactoryLogo size="lg" className="shadow-2xl ring-4 ring-white/15" />
                <div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-white/15 text-sky-100 border border-white/20">
                    ENTERPRISE ERP
                  </span>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-white">
                    {factorySettings.shortCode}
                  </h2>
                </div>
              </div>
            </div>

            <p className="mt-4 text-sm font-bold text-white/95">
              {factorySettings.factoryName}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-sky-100/80">
              سیستەمی یەکگرتووی بەڕێوەبردنی کارگە، بەرهەمهێنان، فرۆشتنی مەندوب، خاڵی فرۆشتن (POS) و ژمێریاریی گشتی
            </p>
          </div>

          <div className="relative z-10 hidden lg:flex flex-col gap-3 my-7">
            <div className="bg-white/[0.08] border border-white/[0.12] rounded-2xl p-3.5 backdrop-blur-md flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <Cloud className="w-4 h-4 text-sky-200" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">هاوکاتکردنی ڕاستەوخۆ (Cloud D1)</h3>
                <p className="mt-0.5 text-[11px] text-sky-100/75 leading-relaxed">
                  پاشەکەوتکردن و نوێکردنەوەی دەستبەجێی داتاکان لەسەر کلاودفلێر
                </p>
              </div>
            </div>

            <div className="bg-white/[0.08] border border-white/[0.12] rounded-2xl p-3.5 backdrop-blur-md flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <KeyRound className="w-4 h-4 text-sky-200" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">دەسەڵاتداریی ورد (RBAC)</h3>
                <p className="mt-0.5 text-[11px] text-sky-100/75 leading-relaxed">
                  جیاکردنەوەی تەواوی دەسەڵاتی بەڕێوەبەر، ژمێریار، کاشێر و مەندوب
                </p>
              </div>
            </div>

            <div className="bg-white/[0.08] border border-white/[0.12] rounded-2xl p-3.5 backdrop-blur-md flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">ئاسایش و پارێزگاریی بەرز</h3>
                <p className="mt-0.5 text-[11px] text-sky-100/75 leading-relaxed">
                  کۆدکردنی وشەی نهێنی و پاراستنی تەواوی زانیارییە داراییەکان
                </p>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-6 lg:mt-0 pt-4 border-t border-white/15 flex items-center justify-between text-[11px] text-sky-100/85">
            <span className="inline-flex items-center gap-2 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              پەیوەندیی پارێزراو • Cloudflare Edge SSL
            </span>
          </div>
        </div>

        {/* Executive Login Form Panel (Left side in RTL) */}
        <div className="lg:col-span-7 p-7 sm:p-10 lg:p-12 flex flex-col justify-center bg-white">
          <div className="w-full max-w-md mx-auto">
            <div className="text-center mb-7">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0071E3]/[0.08] border border-[#0071E3]/15 text-[#0071E3] text-[11px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>دەروازەی چوونەژوورەوەی پارێزراو</span>
              </div>
              <h1 className="mt-3.5 text-2xl sm:text-[26px] font-black text-[#0F172A] tracking-tight">
                چوونەژوورەوە بۆ سیستەم
              </h1>
              <p className="mt-1.5 text-xs sm:text-[13px] text-slate-500">
                تکایە ژمارەی مۆبایل و وشەی نهێنیی ئەکاونتەکەت بنووسە
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-center text-xs font-bold text-slate-600 mb-1.5">
                  ژمارەی مۆبایل
                </label>
                <div className="relative group">
                  <span className="w-8 h-8 rounded-xl bg-slate-200/70 group-focus-within:bg-[#0071E3]/12 text-slate-500 group-focus-within:text-[#0071E3] flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    name="username"
                    inputMode="tel"
                    autoComplete="username"
                    required
                    autoFocus
                    placeholder="ژمارەی مۆبایل"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full px-14 py-3.5 rounded-2xl bg-[#F8FAFC] hover:bg-[#F1F5F9] focus:bg-white border border-slate-200/90 focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/12 text-[#0F172A] text-sm sm:text-base font-bold text-center placeholder:text-center placeholder:text-slate-400 placeholder:font-medium transition-all outline-none"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-center text-xs font-bold text-slate-600 mb-1.5">
                  وشەی نهێنی
                </label>
                <div className="relative group">
                  <span className="w-8 h-8 rounded-xl bg-slate-200/70 group-focus-within:bg-[#0071E3]/12 text-slate-500 group-focus-within:text-[#0071E3] flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    required
                    placeholder="وشەی نهێنی"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-14 py-3.5 rounded-2xl bg-[#F8FAFC] hover:bg-[#F1F5F9] focus:bg-white border border-slate-200/90 focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/12 text-[#0F172A] text-sm sm:text-base font-bold text-center placeholder:text-center placeholder:text-slate-400 placeholder:font-medium transition-all outline-none"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="w-8 h-8 rounded-xl hover:bg-slate-200/70 flex items-center justify-center absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                <button
                  type="button"
                  onClick={handleToggleRemember}
                  aria-pressed={rememberPassword}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all font-semibold ${
                    rememberPassword
                      ? 'bg-[#0071E3]/[0.07] border-[#0071E3]/25 text-[#0F172A]'
                      : 'bg-slate-50 border-slate-200/80 text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                      rememberPassword
                        ? 'bg-[#0071E3] border-[#0071E3] text-white shadow-xs'
                        : 'bg-white border-slate-300 text-transparent'
                    }`}
                  >
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                  <span>بیرهاتنەوەی پاسۆرد</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowForgotInfo(v => !v)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-[#0071E3] hover:bg-[#0071E3]/[0.06] font-semibold transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>پاسۆردت بیرچووە؟</span>
                </button>
              </div>

              {showForgotInfo && (
                <div className="p-3.5 rounded-2xl bg-[#0071E3]/[0.07] border border-[#0071E3]/20 text-slate-700 text-xs leading-relaxed text-center font-medium">
                  بۆ گۆڕین یان نوێکردنەوەی وشەی نهێنی، تکایە پەیوەندی بە{' '}
                  <span className="font-bold text-[#0071E3]">بەڕێوەبەری کارگە</span>ەوە بکە تا لە بەشی{' '}
                  <span className="font-bold text-[#0F172A]">سیتین ← ئەکاونتەکان</span> وشەی نهێنییەکی نوێت بۆ دابنێت.
                </div>
              )}

              {error && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200/80 text-[#D70015] text-xs font-bold flex items-center justify-center gap-2 text-center">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-gradient-to-l from-[#0071E3] via-[#0062CC] to-[#0051B3] hover:from-[#0077ED] hover:to-[#0059C4] disabled:opacity-60 text-white font-extrabold text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-[#0071E3]/25 transition-all active:scale-[0.985]"
              >
                <span>{loading ? 'تکایە چاوەڕێ بە...' : 'چوونەژوورەوە'}</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-7 pt-5 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-400 font-medium">
                دەسەڵاتەکان و بەشە کراوەکان بەپێی ڕۆڵی ئەکاونتەکەت خۆکارانە دیاری دەکرێن
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
