import React, { useState } from 'react';
import { sound } from '../services/audio';
import { storage } from '../services/storage';
import { admobService } from '../services/admob';
import { AdMobConfig } from '../types/game';
import { Volume2, VolumeX, Smartphone, Trash2, Info, CheckCircle2 } from 'lucide-react';

interface Props {
  onDataReset: () => void;
}

export const SettingsView: React.FC<Props> = ({ onDataReset }) => {
  const [isMuted, setIsMuted] = useState(sound.isMuted);
  const [haptics, setHaptics] = useState(true);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const [admobForm, setAdmobForm] = useState<AdMobConfig>(() => storage.getAdMobConfig());
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const toggleSound = () => {
    const next = sound.toggleMute();
    setIsMuted(next);
  };

  const handleReset = () => {
    storage.resetAllData();
    setShowConfirmReset(false);
    sound.playGameOver();
    onDataReset();
  };

  const handleSaveAdMob = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: AdMobConfig = {
      appId: admobForm.appId.trim(),
      interstitialId: admobForm.interstitialId.trim(),
      bannerId: admobForm.bannerId.trim(),
      rewardedId: admobForm.rewardedId.trim(),
      rewardedInterstitialId: admobForm.rewardedInterstitialId.trim(),
      nativeAdvancedId: admobForm.nativeAdvancedId.trim(),
      appOpenId: admobForm.appOpenId.trim(),
      interstitialCooldownSec: Math.max(30, Math.min(300, Number(admobForm.interstitialCooldownSec) || 90)),
    };
    storage.saveAdMobConfig(cleaned);
    setAdmobForm(cleaned);
    sound.playScore();
    await admobService.initialize();
    await admobService.refreshBanner();
    setSavedMsg('AdMob IDs saved.');
  };

  return (
    <div className="space-y-6 pb-20 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">App Settings</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Configure arcade audio, device vibration feedback, AdMob unit IDs, and local progress storage.
        </p>
      </div>

      {/* Settings List */}
      <div className="bg-[#0e111a] border border-white/10 rounded-2xl divide-y divide-white/5 overflow-hidden">
        {/* Sound FX */}
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </div>
            <div>
              <div className="text-sm font-bold text-white">Synthesized Web Audio SFX</div>
              <div className="text-xs text-slate-400">Zero-latency arcade sounds for jumps, coins, and hits</div>
            </div>
          </div>

          <button
            onClick={toggleSound}
            className={`w-12 h-7 rounded-full p-1 transition-colors flex items-center ${
              !isMuted ? 'bg-cyan-500 justify-end' : 'bg-slate-700 justify-start'
            }`}
          >
            <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
          </button>
        </div>

        {/* Haptics */}
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
              <Smartphone size={20} />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Haptic Vibration Feedback</div>
              <div className="text-xs text-slate-400">Tactile vibration on mobile screen taps and impacts</div>
            </div>
          </div>

          <button
            onClick={() => {
              const next = !haptics;
              setHaptics(next);
              sound.playClick();
              if (next && 'vibrate' in navigator) navigator.vibrate(30);
            }}
            className={`w-12 h-7 rounded-full p-1 transition-colors flex items-center ${
              haptics ? 'bg-purple-500 justify-end' : 'bg-slate-700 justify-start'
            }`}
          >
            <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
          </button>
        </div>

        {/* Reset Data */}
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
              <Trash2 size={20} />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Clear Local Game Progress</div>
              <div className="text-xs text-slate-400">Reset coins, high scores, and redeemed items to defaults</div>
            </div>
          </div>

          <button
            onClick={() => setShowConfirmReset(true)}
            className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 font-bold text-xs rounded-xl transition-all"
          >
            Reset Data
          </button>
        </div>
      </div>

      {/* AdMob Unit IDs (Android WebView / Capacitor Bridge) */}
      <form
        onSubmit={handleSaveAdMob}
        className="bg-[#0e111a] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-3.5"
      >
        <div>
          <div className="text-sm font-bold text-white">Google AdMob IDs (Android Bridge)</div>
          <div className="text-xs text-slate-400 mt-0.5">
            Active on Android APK wrappers (Capacitor, Cordova, or Android WebView JavascriptInterface).
          </div>
        </div>

        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-300">AdMob App ID</span>
            <input
              type="text"
              value={admobForm.appId}
              onChange={(e) => {
                setSavedMsg(null);
                setAdmobForm({ ...admobForm, appId: e.target.value });
              }}
              placeholder="ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX"
              className="w-full bg-slate-900 border border-white/10 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-300">Interstitial Ad Unit ID</span>
            <input
              type="text"
              value={admobForm.interstitialId}
              onChange={(e) => {
                setSavedMsg(null);
                setAdmobForm({ ...admobForm, interstitialId: e.target.value });
              }}
              placeholder="ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX"
              className="w-full bg-slate-900 border border-white/10 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-300">Banner Ad Unit ID</span>
            <input
              type="text"
              value={admobForm.bannerId}
              onChange={(e) => {
                setSavedMsg(null);
                setAdmobForm({ ...admobForm, bannerId: e.target.value });
              }}
              placeholder="ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX"
              className="w-full bg-slate-900 border border-white/10 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-300">Rewarded Ad Unit ID</span>
            <input
              type="text"
              value={admobForm.rewardedId}
              onChange={(e) => {
                setSavedMsg(null);
                setAdmobForm({ ...admobForm, rewardedId: e.target.value });
              }}
              placeholder="ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX"
              className="w-full bg-slate-900 border border-white/10 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-300">Rewarded Interstitial Ad Unit ID</span>
            <input
              type="text"
              value={admobForm.rewardedInterstitialId}
              onChange={(e) => {
                setSavedMsg(null);
                setAdmobForm({ ...admobForm, rewardedInterstitialId: e.target.value });
              }}
              placeholder="ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX"
              className="w-full bg-slate-900 border border-white/10 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-300">Native Advanced Ad Unit ID</span>
            <input
              type="text"
              value={admobForm.nativeAdvancedId}
              onChange={(e) => {
                setSavedMsg(null);
                setAdmobForm({ ...admobForm, nativeAdvancedId: e.target.value });
              }}
              placeholder="ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX"
              className="w-full bg-slate-900 border border-white/10 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-300">App Open Ad Unit ID</span>
            <input
              type="text"
              value={admobForm.appOpenId}
              onChange={(e) => {
                setSavedMsg(null);
                setAdmobForm({ ...admobForm, appOpenId: e.target.value });
              }}
              placeholder="ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX"
              className="w-full bg-slate-900 border border-white/10 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
            />
          </label>
        </div>

        {savedMsg && (
          <div className="px-3 py-2 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
            <span>{savedMsg}</span>
          </div>
        )}

        <button
          type="submit"
          className="min-h-[40px] px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-black font-extrabold text-xs transition-all"
        >
          Save AdMob IDs
        </button>
      </form>

      {/* About Box */}
      <div className="p-5 bg-gradient-to-br from-slate-900 via-[#10131f] to-cyan-950/20 border border-white/10 rounded-2xl space-y-3">
        <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
          <Info size={16} /> About RewardX
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          RewardX features 66 standalone Three.js 3D WebGL games (16 Board &amp; Party, 12 Racing &amp; Flight, 12 Sports &amp; Precision, 12 Action &amp; Combat, and 14 Arcade &amp; Puzzle games) running locally inside the client without third-party embeds, redirects, or paid APIs.
        </p>
        <div className="pt-2 flex flex-wrap gap-4 text-[11px] text-slate-400 border-t border-white/5 font-mono">
          <span>Games: 66 3D WebGL</span>
          <span>Engine: Three.js WebGL</span>
          <span>Storage: Cloud Firestore</span>
          <span>Platform: Web &amp; Android</span>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showConfirmReset && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0e121d] border border-rose-500/30 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-rose-400 font-bold">
              <Trash2 size={18} /> Confirm Reset
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to erase all coins, transactions, and high scores? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirmReset(false)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 hover:text-white font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/30"
              >
                Yes, Reset All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
