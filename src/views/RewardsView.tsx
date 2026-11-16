import React, { useState } from 'react';
import { RewardItem } from '../types/game';
import { REWARDS_CATALOG } from '../data/rewardsList';
import { storage } from '../services/storage';
import { sound } from '../services/audio';
import { RewardThumbnail } from '../components/RewardThumbnail';
import { Gift, Coins, Lock, Check, AlertCircle, Clock } from 'lucide-react';

interface Props {
  coins: number;
  userLevel: number;
  onRewardClaimed: () => void;
}

const FILTER_TABS: { id: 'ALL' | 'VOUCHER' | 'BOOSTER' | 'COSMETIC' | 'VIP'; label: string }[] = [
  { id: 'ALL', label: 'All Rewards' },
  { id: 'VOUCHER', label: 'Vouchers' },
  { id: 'BOOSTER', label: 'Boosters' },
  { id: 'COSMETIC', label: 'Cosmetics' },
  { id: 'VIP', label: 'VIP' },
];

export const RewardsView: React.FC<Props> = ({ coins, userLevel, onRewardClaimed }) => {
  const [selectedReward, setSelectedReward] = useState<RewardItem | null>(null);
  const [payoutTarget, setPayoutTarget] = useState('');
  const [claimStatus, setClaimStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'VOUCHER' | 'BOOSTER' | 'COSMETIC' | 'VIP'>('ALL');

  const profile = storage.getProfile();
  const transactions = storage.getTransactions();
  const claimedIds = profile.claimedRewardIds || [];

  const filteredRewards = REWARDS_CATALOG.filter((item) => {
    if (categoryFilter === 'ALL') return true;
    return item.category === categoryFilter;
  });

  const handleRedeem = (item: RewardItem) => {
    setSelectedReward(item);
    setPayoutTarget('');
    setClaimStatus(null);
  };

  const confirmRedeem = () => {
    if (!selectedReward) return;

    if (coins < selectedReward.coinCost) {
      setClaimStatus({ success: false, message: 'Insufficient coins in your wallet.' });
      sound.playHit();
      return;
    }

    if (userLevel < selectedReward.minLevel) {
      setClaimStatus({ success: false, message: `Requires Player Level ${selectedReward.minLevel}.` });
      sound.playHit();
      return;
    }

    if (selectedReward.id === 'voucher-upi-1' && !payoutTarget.trim()) {
      setClaimStatus({ success: false, message: 'Please enter your UPI ID (e.g. name@upi).' });
      sound.playHit();
      return;
    }

    if (selectedReward.id === 'voucher-ff-100' && !payoutTarget.trim()) {
      setClaimStatus({ success: false, message: 'Please enter your Free Fire Player UID.' });
      sound.playHit();
      return;
    }

    const isVoucher = selectedReward.category === 'VOUCHER';
    const fullTitle = payoutTarget.trim()
      ? `${selectedReward.title} (${payoutTarget.trim()})`
      : selectedReward.title;
    const result = storage.redeemReward(selectedReward.id, selectedReward.coinCost, fullTitle, isVoucher);

    if (result.success) {
      sound.playVictory();
      setClaimStatus({
        success: true,
        message: isVoucher
          ? 'Voucher request submitted to Pending Review.'
          : 'Reward unlocked on your profile!'
      });
      onRewardClaimed();
    } else {
      setClaimStatus({ success: false, message: result.error || 'Failed to redeem.' });
    }
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Gift size={22} className="text-pink-400" /> Rewards Store
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Redeem your earned coins for digital vouchers, boosters, and profile upgrades.
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 font-mono text-xs font-bold text-amber-400 tabular-nums shrink-0">
          <Coins size={14} />
          <span>{coins.toLocaleString()}</span>
        </div>
      </div>

      {/* Filter Tabs (Vouchers First) */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 pb-3">
        {FILTER_TABS.map((cat) => (
          <button
            key={cat.id}
            onClick={() => { sound.playClick(); setCategoryFilter(cat.id); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              categoryFilter === cat.id
                ? 'bg-pink-500 text-white shadow-sm shadow-pink-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Rewards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
        {filteredRewards.map((item) => {
          const isClaimed = claimedIds.includes(item.id);
          const isPendingVoucher =
            item.category === 'VOUCHER' &&
            transactions.some(
              (tx) => tx.status === 'PENDING' && tx.title.includes(item.title)
            );
          const canAfford = coins >= item.coinCost;
          const meetsLevel = userLevel >= item.minLevel;
          const isLocked = !meetsLevel;

          return (
            <div
              key={item.id}
              className={`rounded-2xl overflow-hidden bg-[#0f121d] border flex flex-col justify-between transition-all group ${
                isPendingVoucher
                  ? 'border-amber-500/40'
                  : isClaimed
                  ? 'border-emerald-500/30 bg-emerald-950/10'
                  : isLocked
                  ? 'border-white/5 opacity-80'
                  : 'border-white/10 hover:border-pink-500/45'
              }`}
            >
              <div>
                <RewardThumbnail item={item} />

                <div className="p-2.5 sm:p-3.5 space-y-1.5">
                  <h3 className="text-xs sm:text-sm font-extrabold text-white leading-tight line-clamp-1">
                    {item.title}
                  </h3>

                  <div className="flex items-center justify-between text-[11px] sm:text-xs font-mono tabular-nums">
                    <span className="flex items-center gap-1 font-bold text-amber-400">
                      <Coins size={12} /> {item.coinCost.toLocaleString()}
                    </span>
                    <span className={meetsLevel ? 'text-slate-400' : 'text-amber-400 font-semibold'}>
                      Lvl {item.minLevel}+
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>

              <div className="px-2.5 pb-2.5 sm:px-3.5 sm:pb-3.5 pt-2 border-t border-white/5">
                {isPendingVoucher ? (
                  <div className="w-full py-2 bg-amber-950/40 border border-amber-500/40 text-amber-300 font-bold text-[11px] sm:text-xs rounded-xl flex items-center justify-center gap-1.5">
                    <Clock size={13} /> Pending Review
                  </div>
                ) : isClaimed ? (
                  <div className="w-full py-2 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 font-bold text-[11px] sm:text-xs rounded-xl flex items-center justify-center gap-1.5">
                    <Check size={13} /> Unlocked
                  </div>
                ) : isLocked ? (
                  <button
                    disabled
                    className="w-full py-2 bg-slate-800 text-slate-500 font-bold text-[11px] sm:text-xs rounded-xl flex items-center justify-center gap-1 cursor-not-allowed"
                  >
                    <Lock size={12} /> Level {item.minLevel}
                  </button>
                ) : (
                  <button
                    onClick={() => { sound.playClick(); handleRedeem(item); }}
                    className={`w-full py-2 font-bold text-[11px] sm:text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                      canAfford
                        ? 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white shadow-md shadow-pink-500/20 active:scale-95'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {canAfford ? 'Redeem' : `Need ${(item.coinCost - coins).toLocaleString()}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      {selectedReward && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0e121d] border border-pink-500/30 rounded-2xl overflow-hidden">
            <RewardThumbnail item={selectedReward} />

            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Gift size={18} className="text-pink-400" /> Confirm Redemption
                </h2>
                <div className="text-sm font-bold text-white">{selectedReward.title}</div>
                <div className="text-xs text-slate-400">{selectedReward.description}</div>
              </div>

              <div className="p-3 bg-slate-900 rounded-xl flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-slate-400">Coin Cost</span>
                <span className="text-amber-400 font-bold text-sm">
                  {selectedReward.coinCost.toLocaleString()} Coins
                </span>
              </div>

              {(selectedReward.id === 'voucher-upi-1' || selectedReward.id === 'voucher-ff-100') && !claimStatus?.success && (
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-300">
                    {selectedReward.id === 'voucher-upi-1' ? 'Your UPI ID' : 'Free Fire Player UID'}
                  </span>
                  <input
                    type="text"
                    value={payoutTarget}
                    onChange={(e) => setPayoutTarget(e.target.value)}
                    placeholder={selectedReward.id === 'voucher-upi-1' ? 'e.g. yourname@upi' : 'e.g. 1234567890'}
                    className="w-full bg-slate-900 border border-white/15 focus:border-pink-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
                  />
                </label>
              )}

              <div className="text-[11px] text-slate-400 space-y-1">
                <strong className="text-slate-300">Terms:</strong>
                <p>{selectedReward.terms}</p>
              </div>

              {claimStatus && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-medium flex items-start gap-2 ${
                    claimStatus.success
                      ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-950/60 border border-rose-500/30 text-rose-300'
                  }`}
                >
                  {claimStatus.success ? (
                    <Check size={16} className="shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  )}
                  <span>{claimStatus.message}</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedReward(null)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 hover:text-white font-bold text-xs rounded-xl"
                >
                  Close
                </button>
                {!claimStatus?.success && (
                  <button
                    onClick={confirmRedeem}
                    className="flex-1 py-2.5 bg-pink-500 hover:bg-pink-400 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-pink-500/30"
                  >
                    Confirm
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
