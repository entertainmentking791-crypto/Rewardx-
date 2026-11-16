import React, { useState, useEffect } from 'react';
import { storage, AdTasksState } from '../services/storage';
import { admobService } from '../services/admob';
import { sound } from '../services/audio';
import {
  Coins,
  PlayCircle,
  CheckCircle2,
  Tv,
  Zap,
  Flame,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface Props {
  coins: number;
  onCoinsUpdated: () => void;
  onNavigateToWallet: () => void;
  onNavigateToRewards: () => void;
}

interface AdTaskDef {
  id: string;
  title: string;
  subtitle: string;
  rewardCoins: number;
  dailyLimit: number;
  adType: 'rewarded' | 'rewardedInterstitial';
  iconColor: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const AD_TASKS: AdTaskDef[] = [
  {
    id: 'watch-quick-boost',
    title: 'Watch 1 Ad = 25 Coins',
    subtitle: 'Rewarded Ad · Instant Wallet credit',
    rewardCoins: 25,
    dailyLimit: 15,
    adType: 'rewarded',
    iconColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
    icon: PlayCircle,
  },
  {
    id: 'watch-rewarded-interstitial',
    title: 'Watch 1 Interstitial Ad = 35 Coins',
    subtitle: 'Rewarded Interstitial · Instant Wallet credit',
    rewardCoins: 35,
    dailyLimit: 10,
    adType: 'rewardedInterstitial',
    iconColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25',
    icon: Zap,
  },
  {
    id: 'watch-rewarded-video',
    title: 'Watch 1 Video Ad = 50 Coins',
    subtitle: 'Rewarded Video · Instant Wallet credit',
    rewardCoins: 50,
    dailyLimit: 10,
    adType: 'rewarded',
    iconColor: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
    icon: Tv,
  },
  {
    id: 'watch-mega-jackpot',
    title: 'Watch 1 Bonus Ad = 75 Coins',
    subtitle: 'Premium Video Ad · Instant Wallet credit',
    rewardCoins: 75,
    dailyLimit: 5,
    adType: 'rewarded',
    iconColor: 'text-purple-400 bg-purple-500/10 border-purple-500/25',
    icon: Flame,
  },
];

export const TasksView: React.FC<Props> = ({
  coins,
  onCoinsUpdated,
  onNavigateToWallet,
}) => {
  const [taskState, setTaskState] = useState<AdTasksState>(() => storage.getAdTasksState());
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  useEffect(() => {
    void admobService.showNativeAd('tasks');
    return () => {
      void admobService.hideNativeAd();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const handleStartAdTask = async (task: AdTaskDef) => {
    const watchedCount = taskState.watchesByTask[task.id] || 0;
    if (watchedCount >= task.dailyLimit || loadingTaskId) return;

    sound.playClick();
    setLoadingTaskId(task.id);

    const res =
      task.adType === 'rewardedInterstitial'
        ? await admobService.showRewardedInterstitial()
        : await admobService.showRewardedAd();

    setLoadingTaskId(null);

    if (res.rewarded) {
      const nextState = storage.recordAdTaskWatch(task.id, task.rewardCoins, task.title);
      setTaskState(nextState);
      sound.playCoin();
      onCoinsUpdated();
      setToast({
        text: `+${task.rewardCoins} Coins added to your Wallet!`,
        type: 'success',
      });
    } else if (res.status === 'dismissed') {
      sound.playHit();
      setToast({
        text: 'Ad closed early — watch the complete ad to get coins.',
        type: 'info',
      });
    } else {
      sound.playHit();
      setToast({
        text: 'Real Google AdMob ads load inside the Android APK build.',
        type: 'info',
      });
    }
  };

  return (
    <div className="space-y-4 pb-20 max-w-2xl mx-auto">
      {/* Compact Section Heading */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
          Ad Tasks
        </h1>

        <button
          type="button"
          onClick={() => { sound.playClick(); onNavigateToWallet(); }}
          className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold flex items-center gap-1.5"
        >
          <Coins size={14} className="text-amber-400" />
          <span className="tabular-nums">{coins.toLocaleString()}</span>
        </button>
      </div>

      {/* Toast Feedback */}
      {toast && (
        <div
          className={`px-4 py-3 rounded-2xl border text-xs sm:text-sm font-bold flex items-center gap-2.5 ${
            toast.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : 'bg-slate-900 border-amber-500/35 text-amber-300'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle size={18} className="text-amber-400 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Vertical List of Ad Tasks */}
      <div className="flex flex-col gap-3">
        {AD_TASKS.map((task) => {
          const Icon = task.icon;
          const watched = taskState.watchesByTask[task.id] || 0;
          const remaining = Math.max(0, task.dailyLimit - watched);
          const isMaxed = remaining === 0;
          const isLoading = loadingTaskId === task.id;

          return (
            <div
              key={task.id}
              className="rounded-2xl p-3.5 sm:p-4 bg-[#0e111c] border border-white/10 hover:border-amber-500/40 flex items-center justify-between gap-3 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${task.iconColor}`}
                >
                  <Icon size={21} />
                </div>

                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-black text-white leading-tight truncate">
                    {task.title}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                    {task.subtitle}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">
                    Today: {watched}/{task.dailyLimit}
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={isMaxed || isLoading}
                onClick={() => void handleStartAdTask(task)}
                className={`min-h-[42px] px-3.5 sm:px-4 py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shrink-0 transition-all active:scale-95 ${
                  isMaxed
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black shadow-md shadow-amber-500/20'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Loading…</span>
                  </>
                ) : isMaxed ? (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Done</span>
                  </>
                ) : (
                  <>
                    <PlayCircle size={15} />
                    <span>+{task.rewardCoins}</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
