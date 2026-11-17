import React, { useState, useEffect } from 'react';
import { Lock, LogOut, ShieldCheck, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const LockScreen: React.FC = () => {
  const { currentUser, unlockWithPin, logout, factorySettings } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [checking, setChecking] = useState(false);

  const remainingSec = Math.max(0, Math.ceil((cooldownUntil - nowMs) / 1000));

  useEffect(() => {
    if (remainingSec <= 0) return;
    const t = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [remainingSec]);

  const handlePinChange = async (value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 4);
    setPin(clean);
    setError('');
    if (clean.length === 4 && remainingSec <= 0 && !checking) {
      setChecking(true);
      const ok = await unlockWithPin(clean);
      setChecking(false);
      if (!ok) {
        const nextAttempts = attempts + 1;
        setAttempts(nextAttempts);
        setPin('');
        if (nextAttempts >= 5) {
          const until = Date.now() + 30000;
          setCooldownUntil(until);
          setNowMs(Date.now());
          setAttempts(0);
          setError('٥ جار هەڵە کرا — ٣٠ چرکە چاوەڕێ بە');
        } else {
          setError('کۆدی PIN هەڵەیە');
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#F5F5F7]/95 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="apple-card w-full max-w-sm p-6 sm:p-8 text-center space-y-5 shadow-2xl border border-black/[0.08]">
        <div className="w-14 h-14 rounded-2xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7" />
        </div>

        <div className="space-y-1">
          <div className="text-[11px] font-bold text-[#86868B]">{factorySettings.factoryName}</div>
          <h2 className="text-base font-extrabold text-[#1D1D1F]">شاشە قوفڵ کراوە</h2>
          <p className="text-xs text-[#515154]">
            {currentUser.name || 'بەکارهێنەر'} ({currentUser.roleTitleKu || currentUser.role})
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-[11px] font-semibold text-[#515154]">
            کۆدی ٤ ژمارەیی (PIN) بنووسە بۆ کردنەوە
          </label>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            maxLength={4}
            disabled={remainingSec > 0 || checking}
            value={pin}
            onChange={(e) => void handlePinChange(e.target.value)}
            placeholder="••••"
            dir="ltr"
            className="apple-input w-full px-4 py-3 text-center text-2xl font-mono font-black tracking-[0.6em]"
          />
        </div>

        {error && (
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#DC2626] bg-[#FEF2F2] px-3 py-2 rounded-xl">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{remainingSec > 0 ? `٣٠ چرکە چاوەڕێ بە (${remainingSec}s)` : error}</span>
          </div>
        )}

        <div className="pt-2 border-t border-black/[0.06] flex items-center justify-between gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 text-[#059669] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            داتا پارێزراوە
          </span>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FEE2E2] font-bold transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            چوونەدەرەوە
          </button>
        </div>
      </div>
    </div>
  );
};
