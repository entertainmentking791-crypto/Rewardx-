import React, { useState } from 'react';
import { storage } from '../services/storage';
import { sound } from '../services/audio';
import { GAMES_CATALOG } from '../data/gamesList';
import { Coins, ArrowDownLeft, ArrowUpRight, Clock, CheckCircle2, Wallet, PlayCircle } from 'lucide-react';

interface Props {
  coins: number;
  onNavigateToRewards: () => void;
  onNavigateToTasks?: () => void;
}

const GAME_TITLE_MAP = new Map(GAMES_CATALOG.map((g) => [g.id, g.title]));

export const WalletView: React.FC<Props> = ({ coins, onNavigateToRewards, onNavigateToTasks }) => {
  const [filterType, setFilterType] = useState<'ALL' | 'EARN' | 'REDEEM'>('ALL');
  const transactions = storage.getTransactions();

  const filteredTransactions = transactions.filter((tx) => {
    if (filterType === 'EARN') return tx.amount > 0;
    if (filterType === 'REDEEM') return tx.amount < 0;
    return true;
  });

  const totalEarned = transactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSpent = transactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const formatTxTitle = (title: string, gameId?: string) => {
    if (gameId && GAME_TITLE_MAP.has(gameId)) {
      return `Played ${GAME_TITLE_MAP.get(gameId)}`;
    }
    return title;
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Clean Wallet Balance Card */}
      <div className="rounded-3xl p-5 sm:p-7 bg-gradient-to-br from-amber-950/45 via-[#131520] to-[#0b0e17] border border-amber-500/25 shadow-[0_12px_30px_rgba(0,0,0,0.45)] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
            <Wallet size={16} />
            <span>Coins Wallet</span>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToTasks && (
              <button
                onClick={() => { sound.playClick(); onNavigateToTasks(); }}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 active:scale-95 text-cyan-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
              >
                <PlayCircle size={14} />
                <span>Ad Tasks</span>
              </button>
            )}
            <button
              onClick={() => { sound.playClick(); onNavigateToRewards(); }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-extrabold text-xs rounded-xl transition-all shadow-md shadow-amber-500/20"
            >
              Redeem Rewards
            </button>
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-400 font-medium">Available Coins</div>
          <div className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight flex items-center gap-2.5 mt-1">
            <Coins size={34} className="text-amber-400 shrink-0" />
            <span className="tabular-nums">{coins.toLocaleString()}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
          <div className="rounded-2xl bg-black/25 border border-white/5 px-3.5 py-2.5">
            <div className="text-[11px] text-slate-400">Total Earned</div>
            <div className="text-base font-bold text-emerald-400 font-mono tabular-nums mt-0.5">
              +{totalEarned.toLocaleString()}
            </div>
          </div>
          <div className="rounded-2xl bg-black/25 border border-white/5 px-3.5 py-2.5">
            <div className="text-[11px] text-slate-400">Total Spent</div>
            <div className="text-base font-bold text-rose-400 font-mono tabular-nums mt-0.5">
              -{totalSpent.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Clock size={16} className="text-cyan-400" /> History
          </h2>

          <div className="flex items-center gap-1 p-1 bg-slate-900/90 rounded-xl border border-white/10">
            <button
              onClick={() => { sound.playClick(); setFilterType('ALL'); }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                filterType === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => { sound.playClick(); setFilterType('EARN'); }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                filterType === 'EARN' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-white'
              }`}
            >
              Earned
            </button>
            <button
              onClick={() => { sound.playClick(); setFilterType('REDEEM'); }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                filterType === 'REDEEM' ? 'bg-slate-800 text-rose-400' : 'text-slate-400 hover:text-white'
              }`}
            >
              Spent
            </button>
          </div>
        </div>

        <div className="divide-y divide-white/5 bg-[#0e111a] border border-white/10 rounded-2xl overflow-hidden">
          {filteredTransactions.length > 0 ? (
            filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      tx.amount > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                    }`}
                  >
                    {tx.amount > 0 ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white leading-tight truncate">
                      {formatTxTitle(tx.title, tx.gameId)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{tx.date}</div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div
                    className={`text-xs font-bold font-mono tabular-nums ${
                      tx.amount > 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                  </div>
                  <div className="text-[10px] mt-0.5">
                    {tx.status === 'COMPLETED' ? (
                      <span className="text-emerald-400 font-semibold flex items-center justify-end gap-0.5">
                        <CheckCircle2 size={10} /> Done
                      </span>
                    ) : (
                      <span className="text-amber-400 font-semibold flex items-center justify-end gap-0.5">
                        <Clock size={10} /> Pending
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              No transactions yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
