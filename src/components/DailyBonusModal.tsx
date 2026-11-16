import React from 'react';
import { storage } from '../services/storage';
import { sound } from '../services/audio';
import { X, Sparkles, Check, Clock, Coins } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onClaimed: () => void;
}

const STREAK_REWARDS = [
  { day: 1, coins: 50 },
  { day: 2, coins: 75 },
  { day: 3, coins: 100 },
  { day: 4, coins: 150 },
  { day: 5, coins: 200 },
  { day: 6, coins: 300 },
  { day: 7, coins: 500, perk: 'Crown Badge' }
];

export const DailyBonusModal: React.FC<Props> = ({ isOpen, onClose, onClaimed }) => {
  if (!isOpen) return null;

  const bonus = storage.getDailyBonus();
  const { canClaim, hoursRemaining } = storage.canClaimDailyBonus();
  const currentStreak = bonus.currentStreak;
  const nextStreak = (currentStreak % 7) + 1;
  const todaysReward = STREAK_REWARDS[nextStreak - 1];

  const handleClaim = () => {
    if (!canClaim) return;
    const result = storage.claimDailyBonus(todaysReward.coins);
    if (result.success) {
      sound.playVictory();
      onClaimed();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-sm bg-[#0d101a] border border-purple-500/30 rounded-2xl p-5 shadow-[0_0_30px_rgba(168,85,247,0.2)]">
        <button
          onClick={() => { sound.playClick(); onClose(); }}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2 text-purple-400 mb-1">
          <Sparkles size={18} />
          <h2 className="text-base font-bold text-white">Daily Login Streak</h2>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Check in every day to claim increasing coin bonuses and rare badges!
        </p>

        {/* 7-Day Streak Grid */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {STREAK_REWARDS.map((item) => {
            const isCompleted = item.day <= currentStreak;
            const isCurrent = item.day === nextStreak && canClaim;

            return (
              <div
                key={item.day}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                  isCurrent
                    ? 'bg-purple-950/80 border-purple-400 scale-105 shadow-md shadow-purple-500/30'
                    : isCompleted
                    ? 'bg-slate-900/60 border-emerald-500/40 text-emerald-400'
                    : 'bg-slate-900/40 border-white/5 opacity-60'
                } ${item.day === 7 ? 'col-span-2' : ''}`}
              >
                <div className="text-[10px] text-slate-400 mb-1 font-semibold">Day {item.day}</div>
                {isCompleted ? (
                  <Check size={18} className="text-emerald-400 my-1" />
                ) : (
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-0.5">
                    <Coins size={12} /> +{item.coins}
                  </div>
                )}
                {item.perk && (
                  <span className="text-[9px] text-purple-300 font-semibold mt-0.5">{item.perk}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        {canClaim ? (
          <button
            onClick={handleClaim}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-purple-600/30 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Sparkles size={16} />
            Claim Day {nextStreak} (+{todaysReward.coins} Coins)
          </button>
        ) : (
          <div className="w-full py-3 bg-slate-800/80 border border-white/5 text-slate-400 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5">
            <Clock size={14} />
            Next bonus available in ~{hoursRemaining}h
          </div>
        )}
      </div>
    </div>
  );
};
