import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Lock, Phone, Eye, EyeOff, ArrowLeft, Check } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center p-5 bg-gradient-to-b from-[#FBFBFD] via-[#F5F5F7] to-[#E8E8ED]">
      <div className="w-full max-w-sm mx-auto apple-sheet">
        <div className="text-center mb-8">
          <FactoryLogo size="xl" className="mx-auto shadow-xl shadow-black/15" />
          <h1 className="mt-5 text-2xl font-extrabold text-[#1D1D1F] tracking-tight">
            {factorySettings.shortCode}
          </h1>
          <p className="mt-1 text-xs text-[#86868B]">
            {factorySettings.factoryName} • چوونەژوورەوە بۆ سیستەم
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="apple-glass rounded-[28px] border border-black/[0.06] shadow-xl shadow-black/[0.06] p-6 space-y-4"
        >
          <div className="relative">
            <Phone className="w-4 h-4 text-[#86868B] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
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
              className="apple-input w-full px-11 py-3.5 text-sm font-semibold text-center placeholder:text-center"
              dir="ltr"
            />
          </div>

          <div className="relative">
            <Lock className="w-4 h-4 text-[#86868B] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              required
              placeholder="وشەی نهێنی"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="apple-input w-full px-11 py-3.5 text-sm font-semibold text-center placeholder:text-center"
              dir="ltr"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F]"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center justify-between px-1 pt-0.5 text-xs">
            <button
              type="button"
              onClick={handleToggleRemember}
              aria-pressed={rememberPassword}
              className="inline-flex items-center gap-2 text-[#1D1D1F] font-semibold hover:text-[#0071E3] transition-colors"
            >
              <span
                className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                  rememberPassword
                    ? 'bg-[#0071E3] border-[#0071E3] text-white'
                    : 'bg-white border-black/20 text-transparent'
                }`}
              >
                <Check className="w-3 h-3 stroke-[3]" />
              </span>
              <span>بیرهاتنەوەی پاسۆرد</span>
            </button>

            <button
              type="button"
              onClick={() => setShowForgotInfo(v => !v)}
              className="text-[#86868B] hover:text-[#0071E3] font-medium transition-colors"
            >
              پاسۆردت بیرچووە؟
            </button>
          </div>

          {showForgotInfo && (
            <div className="p-3 rounded-2xl bg-[#0071E3]/[0.08] border border-[#0071E3]/15 text-[#1D1D1F] text-[11px] leading-relaxed text-center font-medium">
              بۆ گۆڕین یان نوێکردنەوەی وشەی نهێنی، تکایە پەیوەندی بە{' '}
              <span className="font-bold text-[#0071E3]">بەڕێوەبەری کارگە</span>ەوە بکە تا لە بەشی{' '}
              <span className="font-bold">سیتین ← ئەکاونتەکان</span> وشەی نهێنییەکی نوێت بۆ دابنێت.
            </div>
          )}

          {error && (
            <div className="p-3 rounded-2xl bg-[#FF3B30]/10 text-[#D70015] text-xs font-bold text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-[#0071E3] hover:bg-[#0077ED] disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm shadow-[#0071E3]/30 transition-all active:scale-[0.985]"
          >
            {loading ? 'تکایە چاوەڕێ بە...' : 'چوونەژوورەوە'}
            <ArrowLeft className="w-4 h-4" />
          </button>
        </form>

        <p className="text-center text-[11px] text-[#86868B] mt-6">
          دەسەڵاتەکان بەپێی ڕۆڵی ئەکاونتەکەت دیاری دەکرێن
        </p>
      </div>
    </div>
  );
};
