import React from 'react';
import { GameDefinition } from '../types/game';
import { GAMES_CATALOG } from '../data/gamesList';
import { sound } from '../services/audio';
import { storage } from '../services/storage';
import { GameThumbnail } from '../components/GameThumbnail';
import { Play, Sparkles, Trophy, Flame, ChevronRight, Zap, Dices, Box, Car, Crosshair, Gamepad2 } from 'lucide-react';

type FilterMode = 'all' | 'board' | 'racing' | 'sports' | 'action' | 'arcade';

interface Props {
  onLaunchGame: (game: GameDefinition) => void;
  onViewAllGames: (mode?: FilterMode) => void;
  onOpenDailyBonus: () => void;
  canClaimBonus: boolean;
}

export const HomeView: React.FC<Props> = ({
  onLaunchGame,
  onViewAllGames,
  onOpenDailyBonus,
  canClaimBonus
}) => {
  const highScores = storage.getHighScores();
  const recentGameIds = storage.getRecentGames();
  const featuredGame = GAMES_CATALOG.find(g => g.id === '3d-ludo') || GAMES_CATALOG[0];

  const recentGames = recentGameIds
    .map(id => GAMES_CATALOG.find(g => g.id === id))
    .filter((g): g is GameDefinition => g !== undefined);

  const boardGames = GAMES_CATALOG.filter((g) => g.category === 'board');
  const racingGames = GAMES_CATALOG.filter((g) => g.category === 'racing');
  const sportsGames = GAMES_CATALOG.filter((g) => g.category === 'sports');
  const actionArcadeGames = GAMES_CATALOG.filter((g) => g.category === 'action' || g.category === 'arcade');
  const actionCount = GAMES_CATALOG.filter((g) => g.category === 'action').length;
  const arcadeCount = GAMES_CATALOG.filter((g) => g.category === 'arcade').length;

  return (
    <div className="space-y-6 pb-20">
      {/* Hero Banner: Game of the Day */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-rose-950/70 via-[#121422] to-purple-950/60 border border-rose-500/25 p-5 md:p-8 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="max-w-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-400">
              <Flame size={15} className="text-orange-400" />
              <span>Featured 3D Game</span>
              <span>·</span>
              <span>{GAMES_CATALOG.length} WebGL Games</span>
            </div>

            <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight">
              {featuredGame.title}
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md">
              {featuredGame.description}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={() => { sound.playClick(); onLaunchGame(featuredGame); }}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-black font-extrabold text-sm rounded-xl shadow-lg shadow-rose-500/30 active:scale-95 transition-all"
              >
                <Play size={18} fill="currentColor" /> Play 3D Now
              </button>

              {canClaimBonus && (
                <button
                  onClick={() => { sound.playClick(); onOpenDailyBonus(); }}
                  className="flex items-center gap-2 px-4 py-3 bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 text-purple-200 font-bold text-xs rounded-xl transition-all animate-pulse"
                >
                  <Sparkles size={16} className="text-yellow-400" /> Claim Daily Bonus
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => { sound.playClick(); onLaunchGame(featuredGame); }}
            className="hidden sm:block w-52 md:w-64 aspect-[4/3] rounded-2xl overflow-hidden border-2 border-rose-400/40 shadow-2xl shadow-rose-500/20 shrink-0 group hover:scale-[1.03] transition-transform"
          >
            <GameThumbnail game={featuredGame} variant="hero" />
          </button>
        </div>

        <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-20 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-rose-400 via-purple-500 to-transparent" />
      </div>

      {/* Quick Category Jump Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { mode: 'all' as const, name: 'All 3D', count: GAMES_CATALOG.length, icon: Box, color: 'text-cyan-400 border-cyan-500/30' },
          { mode: 'board' as const, name: 'Board', count: boardGames.length, icon: Dices, color: 'text-rose-400 border-rose-500/30' },
          { mode: 'racing' as const, name: 'Racing', count: racingGames.length, icon: Car, color: 'text-sky-400 border-sky-500/30' },
          { mode: 'sports' as const, name: 'Sports', count: sportsGames.length, icon: Trophy, color: 'text-emerald-400 border-emerald-500/30' },
          { mode: 'action' as const, name: 'Action', count: actionCount, icon: Crosshair, color: 'text-orange-400 border-orange-500/30' },
          { mode: 'arcade' as const, name: 'Arcade', count: arcadeCount, icon: Gamepad2, color: 'text-purple-400 border-purple-500/30' },
        ].map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.mode}
              onClick={() => { sound.playClick(); onViewAllGames(cat.mode); }}
              className={`p-2.5 sm:p-3 rounded-2xl bg-slate-900/70 border ${cat.color} hover:bg-slate-800/80 flex flex-col items-start gap-1 transition-all text-left active:scale-[0.98]`}
            >
              <Icon size={17} className={cat.color.split(' ')[0]} />
              <div className="text-xs font-bold text-white mt-0.5 truncate w-full">{cat.name}</div>
              <div className="text-[10px] text-slate-400">{cat.count} games</div>
            </button>
          );
        })}
      </div>

      {/* Continue Playing / Recent Games */}
      {recentGames.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Zap size={17} className="text-yellow-400" /> Jump Back In
          </h2>

          <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
            {recentGames.slice(0, 3).map((game) => {
              const best = highScores[game.id] || 0;
              return (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => { sound.playClick(); onLaunchGame(game); }}
                  className="text-left rounded-xl sm:rounded-2xl overflow-hidden bg-[#101422] border border-white/10 hover:border-cyan-500/50 active:scale-[0.97] transition-all flex flex-col justify-between group"
                >
                  <GameThumbnail game={game} />

                  <div className="p-2 sm:p-3 w-full">
                    <h3 className="text-[11px] sm:text-sm font-extrabold text-white group-hover:text-cyan-400 transition-colors truncate">
                      {game.title}
                    </h3>
                    <div className="flex items-center justify-between text-[9px] sm:text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
                      <span>Best: <strong className="text-amber-400">{best}</strong></span>
                      <Play size={11} className="text-cyan-400 shrink-0" fill="currentColor" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3D Board & Party Showcase (3 in one row) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Dices size={17} className="text-rose-400" /> 3D Board &amp; Party ({boardGames.length})
          </h2>
          <button
            onClick={() => { sound.playClick(); onViewAllGames('board'); }}
            className="text-xs text-rose-400 hover:underline flex items-center gap-0.5 font-medium"
          >
            See All {boardGames.length} <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
          {boardGames.slice(0, 6).map((game) => {
            const best = highScores[game.id] || 0;
            return (
              <button
                key={game.id}
                type="button"
                onClick={() => { sound.playClick(); onLaunchGame(game); }}
                className="text-left rounded-xl sm:rounded-2xl overflow-hidden bg-[#0f121d] border border-rose-500/20 hover:border-rose-400/60 active:scale-[0.97] transition-all flex flex-col justify-between group"
              >
                <GameThumbnail game={game} />

                <div className="p-2 sm:p-3 w-full space-y-1.5">
                  <div>
                    <h3 className="text-[11px] sm:text-sm font-extrabold text-white group-hover:text-rose-400 transition-colors truncate leading-tight">
                      {game.title}
                    </h3>
                    <div className="text-[9px] sm:text-[11px] text-slate-400 mt-0.5 flex items-center justify-between gap-1 font-mono tabular-nums">
                      <span className="text-rose-400 font-bold">3D Board</span>
                      {best > 0 && (
                        <span className="text-amber-400 flex items-center gap-0.5 shrink-0">
                          <Trophy size={10} />
                          {best}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="w-full py-1 sm:py-1.5 bg-slate-800/90 group-hover:bg-rose-500 group-hover:text-white text-rose-300 font-bold text-[10px] sm:text-xs rounded-lg transition-colors flex items-center justify-center gap-1">
                    <Play size={11} fill="currentColor" />
                    <span>Play 3D</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3D Racing & Sports Showcase (3 in one row) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Car size={17} className="text-sky-400" /> 3D Racing &amp; Sports ({racingGames.length + sportsGames.length})
          </h2>
          <button
            onClick={() => { sound.playClick(); onViewAllGames('racing'); }}
            className="text-xs text-sky-400 hover:underline flex items-center gap-0.5 font-medium"
          >
            See Racing &amp; Sports <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
          {[...racingGames.slice(0, 3), ...sportsGames.slice(0, 3)].map((game) => {
            const best = highScores[game.id] || 0;
            const isRacing = game.category === 'racing';
            return (
              <button
                key={game.id}
                type="button"
                onClick={() => { sound.playClick(); onLaunchGame(game); }}
                className="text-left rounded-xl sm:rounded-2xl overflow-hidden bg-[#0f121d] border border-sky-500/20 hover:border-sky-400/60 active:scale-[0.97] transition-all flex flex-col justify-between group"
              >
                <GameThumbnail game={game} />

                <div className="p-2 sm:p-3 w-full space-y-1.5">
                  <div>
                    <h3 className="text-[11px] sm:text-sm font-extrabold text-white group-hover:text-sky-400 transition-colors truncate leading-tight">
                      {game.title}
                    </h3>
                    <div className="text-[9px] sm:text-[11px] text-slate-400 mt-0.5 flex items-center justify-between gap-1 font-mono tabular-nums">
                      <span className={isRacing ? 'text-sky-400 font-bold' : 'text-emerald-400 font-bold'}>
                        {isRacing ? '3D Racing' : '3D Sports'}
                      </span>
                      {best > 0 && (
                        <span className="text-amber-400 flex items-center gap-0.5 shrink-0">
                          <Trophy size={10} />
                          {best}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="w-full py-1 sm:py-1.5 bg-slate-800/90 group-hover:bg-sky-500 group-hover:text-black text-sky-300 font-bold text-[10px] sm:text-xs rounded-lg transition-colors flex items-center justify-center gap-1">
                    <Play size={11} fill="currentColor" />
                    <span>Play 3D</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3D Action & Arcade Showcase (3 in one row) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Trophy size={17} className="text-cyan-400" /> 3D Action &amp; Arcade ({actionArcadeGames.length})
          </h2>
          <button
            onClick={() => { sound.playClick(); onViewAllGames('all'); }}
            className="text-xs text-cyan-400 hover:underline flex items-center gap-0.5 font-medium"
          >
            See All {GAMES_CATALOG.length} <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
          {actionArcadeGames.slice(0, 6).map((game) => {
            const best = highScores[game.id] || 0;
            return (
              <button
                key={game.id}
                type="button"
                onClick={() => { sound.playClick(); onLaunchGame(game); }}
                className="text-left rounded-xl sm:rounded-2xl overflow-hidden bg-[#0f121d] border border-cyan-500/20 hover:border-cyan-400/60 active:scale-[0.97] transition-all flex flex-col justify-between group"
              >
                <GameThumbnail game={game} />

                <div className="p-2 sm:p-3 w-full space-y-1.5">
                  <div>
                    <h3 className="text-[11px] sm:text-sm font-extrabold text-white group-hover:text-cyan-400 transition-colors truncate leading-tight">
                      {game.title}
                    </h3>
                    <div className="text-[9px] sm:text-[11px] text-slate-400 mt-0.5 flex items-center justify-between gap-1 font-mono tabular-nums">
                      <span className={game.category === 'action' ? 'text-orange-400 font-bold' : 'text-purple-400 font-bold'}>
                        {game.category === 'action' ? '3D Action' : '3D Arcade'}
                      </span>
                      {best > 0 && (
                        <span className="text-amber-400 flex items-center gap-0.5 shrink-0">
                          <Trophy size={10} />
                          {best}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="w-full py-1 sm:py-1.5 bg-slate-800/90 group-hover:bg-cyan-500 group-hover:text-black text-cyan-300 font-bold text-[10px] sm:text-xs rounded-lg transition-colors flex items-center justify-center gap-1">
                    <Play size={11} fill="currentColor" />
                    <span>Play 3D</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
