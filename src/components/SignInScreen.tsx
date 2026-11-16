import React, { useState } from 'react';
import { signInWithGooglePopup } from '../services/firebase';
import { sound } from '../services/audio';
import { Gamepad2, Coins, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';

interface Props {
  externalError?: string | null;
}

export const SignInScreen: React.FC<Props> = ({ externalError }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    if (loading) return;
    sound.playClick();
    setError(null);
    setLoading(true);
    try {
      await signInWithGooglePopup();
      sound.playVictory();
    } catch (err: unknown) {
      sound.playHit();
      const msg =
        err instanceof Error ? err.message : 'Sign-in could not be completed.';
      if (msg.includes('popup-closed-by-user')) {
        setError('Sign-in popup was closed. Please try again.');
      } else if (msg.includes('popup-blocked')) {
        setError('Popup was blocked by your browser. Allow popups and try again.');
      } else {
        setError('Could not sign in with Google. Please try again.');
      }
      setLoading(false);
    }
  };

  const activeError = error || externalError;

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle atmospheric glow */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 right-1/4 w-[420px] h-[420px] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md rounded-3xl bg-[#0e111b]/95 border border-white/10 p-6 sm:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.65)] space-y-6">
        {/* Wordmark & Tagline */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-[11px] font-bold text-cyan-300 uppercase tracking-wider">
            <span>100% 3D WebGL Arcade</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            <span className="text-cyan-400">Reward</span>
            <span className="text-purple-500">X</span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">
            Sign in to save your profile, coins wallet, high scores, and voucher redemptions safely to your account.
          </p>
        </div>

        {/* Key Benefits */}
        <div className="space-y-2.5">
          <div className="p-3 rounded-2xl bg-slate-900/70 border border-white/5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
              <Gamepad2 size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-white">66 Playable 3D Games</div>
              <div className="text-[11px] text-slate-400">Board, Racing, Sports, Action &amp; Arcade</div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/70 border border-white/5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Coins size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-white">250 Welcome Coins + Vouchers</div>
              <div className="text-[11px] text-slate-400">Redeem for ₹1 UPI, Free Fire Diamonds &amp; Play vouchers</div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/70 border border-white/5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Cloud Account Sync</div>
              <div className="text-[11px] text-slate-400">Your coins, level, and scores stay saved automatically</div>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {activeError && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/35 text-rose-200 text-xs font-medium flex items-start gap-2">
            <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
            <span>{activeError}</span>
          </div>
        )}

        {/* Primary Sign In CTA */}
        <button
          type="button"
          disabled={loading}
          onClick={() => void handleGoogleSignIn()}
          className="w-full min-h-[50px] py-3 px-4 rounded-2xl bg-white hover:bg-slate-100 active:scale-[0.98] disabled:opacity-70 text-slate-900 font-extrabold text-sm flex items-center justify-center gap-3 shadow-xl shadow-cyan-500/10 transition-all"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin text-slate-800" />
              <span>Signing in…</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        <p className="text-[11px] text-center text-slate-500">
          Your account stays signed in on this device until you sign out from Profile.
        </p>
      </div>
    </div>
  );
};
