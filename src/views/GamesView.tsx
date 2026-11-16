import React, { useState, useMemo, useEffect } from 'react';
import { GameDefinition } from '../types/game';
import { GAMES_CATALOG } from '../data/gamesList';
import { sound } from '../services/audio';
import { storage } from '../services/storage';
import { GameThumbnail } from '../components/GameThumbnail';
import { Search, Play, Trophy, SlidersHorizontal, X, Box, Dices, Car, Crosshair, Gamepad2 } from 'lucide-react';

type FilterMode = 'all' | 'board' | 'racing' | 'sports' | 'action' | 'arcade';

interface Props {
  onLaunchGame: (game: GameDefinition) => void;
  initialMode?: FilterMode;
}

const CATEGORY_LABEL: Record<string, { label: string; colorClass: string }> = {
  board: { label: '3D Board', colorClass: 'text-rose-400 font-bold' },
  racing: { label: '3D Racing', colorClass: 'text-cyan-400 font-bold' },
  sports: { label: '3D Sports', colorClass: 'text-emerald-400 font-bold' },
  action: { label: '3D Action', colorClass: 'text-amber-400 font-bold' },
  arcade: { label: '3D Arcade', colorClass: 'text-purple-400 font-bold' },
};

export const GamesView: React.FC<Props> = ({ onLaunchGame, initialMode = 'all' }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<FilterMode>(initialMode);
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'score'>('default');

  useEffect(() => {
    setCategoryFilter(initialMode);
  }, [initialMode]);

  const highScores = storage.getHighScores();

  const counts = useMemo(() => ({
    all: GAMES_CATALOG.length,
    board: GAMES_CATALOG.filter((g) => g.category === 'board').length,
    racing: GAMES_CATALOG.filter((g) => g.category === 'racing').length,
    sports: GAMES_CATALOG.filter((g) => g.category === 'sports').length,
    action: GAMES_CATALOG.filter((g) => g.category === 'action').length,
    arcade: GAMES_CATALOG.filter((g) => g.category === 'arcade').length,
  }), []);

  const filteredGames = useMemo(() => {
    return GAMES_CATALOG.filter((game) => {
      const matchesCat = categoryFilter === 'all' ? true : game.category === categoryFilter;
      const matchesSearch =
        game.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        game.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    }).sort((a, b) => {
      if (sortBy === 'name') return a.title.localeCompare(b.title);
      if (sortBy === 'score') {
        const scoreA = highScores[a.id] || 0;
        const scoreB = highScores[b.id] || 0;
        return scoreB - scoreA;
      }
      return 0;
    });
  }, [searchQuery, categoryFilter, sortBy, highScores]);

  const tabs: { id: FilterMode; label: string; count: number; icon: React.ComponentType<{ size?: number; className?: string }>; activeCls: string; iconCls: string }[] = [
    { id: 'all', label: 'All 3D', count: counts.all, icon: Box, activeCls: 'bg-gradient-to-r from-cyan-500 to-blue-600 border-cyan-300 text-black shadow-lg shadow-cyan-500/25', iconCls: 'text-cyan-400' },
    { id: 'board', label: 'Board', count: counts.board, icon: Dices, activeCls: 'bg-gradient-to-r from-rose-500 to-amber-500 border-rose-300 text-black shadow-lg shadow-rose-500/25', iconCls: 'text-rose-400' },
    { id: 'racing', label: 'Racing', count: counts.racing, icon: Car, activeCls: 'bg-gradient-to-r from-sky-500 to-cyan-400 border-sky-300 text-black shadow-lg shadow-sky-500/25', iconCls: 'text-sky-400' },
    { id: 'sports', label: 'Sports', count: counts.sports, icon: Trophy, activeCls: 'bg-gradient-to-r from-emerald-500 to-teal-400 border-emerald-300 text-black shadow-lg shadow-emerald-500/25', iconCls: 'text-emerald-400' },
    { id: 'action', label: 'Action', count: counts.action, icon: Crosshair, activeCls: 'bg-gradient-to-r from-orange-500 to-red-500 border-orange-300 text-black shadow-lg shadow-orange-500/25', iconCls: 'text-orange-400' },
    { id: 'arcade', label: 'Arcade', count: counts.arcade, icon: Gamepad2, activeCls: 'bg-gradient-to-r from-purple-500 to-indigo-600 border-purple-300 text-white shadow-lg shadow-purple-500/30', iconCls: 'text-purple-400' },
  ];

  return (
    <div className="space-y-5 pb-20">
      {/* Header and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
            3D Game Vault <span className="text-cyan-400">· {counts.all} Games</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            100% 3D WebGL library across Board, Racing, Sports, Action &amp; Arcade.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search 3D games..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#111420] border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
            <SlidersHorizontal size={13} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'default' | 'name' | 'score')}
              aria-label="Sort games"
              className="bg-slate-900 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-slate-300 focus:outline-none"
            >
              <option value="default">Default</option>
              <option value="name">A–Z</option>
              <option value="score">Top Score</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3D Category Tabs */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = categoryFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => { sound.playClick(); setCategoryFilter(tab.id); }}
              className={`rounded-2xl p-2.5 border-2 transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${
                active
                  ? tab.activeCls
                  : 'bg-[#0f1320] border-white/10 text-slate-300 hover:border-cyan-500/40 hover:text-white'
              }`}
            >
              <Icon size={16} className={active ? (tab.id === 'arcade' ? 'text-white' : 'text-black') : tab.iconCls} />
              <div className="text-left min-w-0">
                <div className="text-xs font-black leading-none truncate">{tab.label}</div>
                <div className={`text-[10px] font-bold mt-0.5 ${active ? (tab.id === 'arcade' ? 'text-purple-100' : 'text-slate-900') : 'text-slate-400'}`}>
                  {tab.count}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Games Grid (3 games in one row across mobile & desktop) */}
      {filteredGames.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
          {filteredGames.map((game) => {
            const best = highScores[game.id] || 0;
            const catMeta = CATEGORY_LABEL[game.category] || { label: '3D WebGL', colorClass: 'text-cyan-400 font-bold' };
            return (
              <button
                key={game.id}
                type="button"
                onClick={() => { sound.playClick(); onLaunchGame(game); }}
                className="text-left rounded-xl sm:rounded-2xl overflow-hidden bg-[#0e111c] border border-white/10 hover:border-cyan-500/50 active:scale-[0.97] transition-all flex flex-col justify-between group shadow-sm hover:shadow-cyan-500/10"
              >
                <GameThumbnail game={game} />

                <div className="p-2 sm:p-3 w-full space-y-1.5">
                  <div>
                    <h3 className="text-[11px] sm:text-sm font-extrabold text-white group-hover:text-cyan-400 transition-colors truncate leading-tight">
                      {game.title}
                    </h3>
                    <div className="flex items-center justify-between gap-1 mt-0.5 text-[9px] sm:text-[11px] text-slate-400 font-mono tabular-nums">
                      <span className={catMeta.colorClass}>
                        {catMeta.label}
                      </span>
                      {best > 0 && (
                        <span className="text-amber-400 flex items-center gap-0.5 shrink-0">
                          <Trophy size={10} className="shrink-0" />
                          {best}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="w-full py-1 sm:py-1.5 bg-slate-800/90 group-hover:bg-cyan-500 group-hover:text-black text-cyan-300 font-bold text-[10px] sm:text-xs rounded-lg transition-colors flex items-center justify-center gap-1">
                    <Play size={11} fill="currentColor" />
                    <span>Play</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="py-16 text-center space-y-2">
          <p className="text-sm text-slate-400">
            No 3D games matched "{searchQuery}"
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs text-cyan-400 underline font-semibold"
          >
            Clear search
          </button>
        </div>
      )}
    </div>
  );
};
