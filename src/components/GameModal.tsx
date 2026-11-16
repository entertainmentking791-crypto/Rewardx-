import React, { useState, useCallback } from 'react';
import { GameDefinition } from '../types/game';
import { sound } from '../services/audio';
import { storage } from '../services/storage';
import { admobService } from '../services/admob';
import { X, Volume2, VolumeX, HelpCircle, Trophy, Coins, PlayCircle, Loader2 } from 'lucide-react';

// Import 16 core Three.js 3D mini-games + 8 packs covering 50 more 3D games (66 total)
import { ThreeLudo } from '../games/three/ThreeLudo';
import { ThreeTicTacToe } from '../games/three/ThreeTicTacToe';
import { ThreeSnakesLadders } from '../games/three/ThreeSnakesLadders';
import { ThreeConnectFour } from '../games/three/ThreeConnectFour';
import { ThreeMemoryCards } from '../games/three/ThreeMemoryCards';
import { ThreeCheckers } from '../games/three/ThreeCheckers';
import { ThreeCarDrift } from '../games/three/ThreeCarDrift';
import { ThreeTunnelRush } from '../games/three/ThreeTunnelRush';
import { ThreeCubeRunner } from '../games/three/ThreeCubeRunner';
import { ThreeSpaceDogfight } from '../games/three/ThreeSpaceDogfight';
import { ThreeBowling } from '../games/three/ThreeBowling';
import { ThreeHoops } from '../games/three/ThreeHoops';
import { ThreeTowerStack } from '../games/three/ThreeTowerStack';
import { ThreeSnake } from '../games/three/ThreeSnake';
import { ThreeMazeBall } from '../games/three/ThreeMazeBall';
import { ThreeBrickSmash } from '../games/three/ThreeBrickSmash';

import { ThreeReversi3D } from '../games/three/packs/ThreeReversi3D';
import { ThreeGomoku3D } from '../games/three/packs/ThreeGomoku3D';
import { ThreeMinesweeper3D } from '../games/three/packs/ThreeMinesweeper3D';
import { ThreeSimon3D } from '../games/three/packs/ThreeSimon3D';
import { ThreePuzzleBoardPack } from '../games/three/packs/ThreePuzzleBoardPack';
import { ThreeLaneRacerPack } from '../games/three/packs/ThreeLaneRacerPack';
import { ThreeTargetSportsPack } from '../games/three/packs/ThreeTargetSportsPack';
import { ThreePaddleSportsPack } from '../games/three/packs/ThreePaddleSportsPack';
import { ThreeCombatPack } from '../games/three/packs/ThreeCombatPack';
import { ThreeTapActionPack } from '../games/three/packs/ThreeTapActionPack';
import { ThreeReflexPack } from '../games/three/packs/ThreeReflexPack';
import { ThreeArcadeMixPack } from '../games/three/packs/ThreeArcadeMixPack';

interface Props {
  game: GameDefinition;
  onClose: () => void;
  onScoreEarned: () => void;
}

export const GameModal: React.FC<Props> = ({ game, onClose, onScoreEarned }) => {
  const [showInstructions, setShowInstructions] = useState(false);
  const [isMuted, setIsMuted] = useState(sound.isMuted);
  const [sessionResults, setSessionResults] = useState<{
    score: number;
    coins: number;
    isNewHigh: boolean;
    doubled?: boolean;
  } | null>(null);
  const [rewardAdLoading, setRewardAdLoading] = useState(false);

  const highScores = storage.getHighScores();
  const bestScore = highScores[game.id] || 0;
  const admobConfig = storage.getAdMobConfig();
  const canWatchNativeReward =
    admobService.isNativeBridgeAvailable() &&
    Boolean(admobConfig.rewardedId || admobConfig.rewardedInterstitialId);

  const handleMuteToggle = () => {
    const next = sound.toggleMute();
    setIsMuted(next);
    (document.activeElement as HTMLElement | null)?.blur?.();
  };

  const handleGameOver = useCallback((score: number, coins: number) => {
    const { isNewHigh } = storage.saveScore(game.id, score, coins);
    admobService.recordGameCompleted();
    setSessionResults({
      score,
      coins,
      isNewHigh,
      doubled: false,
    });
    onScoreEarned();
  }, [game.id, onScoreEarned]);

  const handleWatchRewardedInterstitial = async () => {
    if (!sessionResults || sessionResults.doubled || rewardAdLoading) return;
    sound.playClick();
    setRewardAdLoading(true);
    const res = await admobService.showRewardedAd();
    setRewardAdLoading(false);

    if (res.rewarded) {
      const bonus = Math.max(10, sessionResults.coins);
      storage.creditRewardedCoins(bonus, `2x Bonus: ${game.title}`);
      sound.playCoin();
      setSessionResults((prev) =>
        prev ? { ...prev, coins: prev.coins + bonus, doubled: true } : prev
      );
      onScoreEarned();
    }
  };

  const handleCloseModal = () => {
    sound.playClick();
    if (sessionResults) {
      void admobService.showInterstitialIfReady();
    }
    onClose();
  };

  const renderGameComponent = () => {
    switch (game.id) {
      case '3d-ludo': return <ThreeLudo onGameOver={handleGameOver} />;
      case '3d-tic-tac-toe': return <ThreeTicTacToe onGameOver={handleGameOver} />;
      case '3d-snakes-ladders': return <ThreeSnakesLadders onGameOver={handleGameOver} />;
      case '3d-connect-four': return <ThreeConnectFour onGameOver={handleGameOver} />;
      case '3d-memory-cards': return <ThreeMemoryCards onGameOver={handleGameOver} />;
      case '3d-checkers': return <ThreeCheckers onGameOver={handleGameOver} />;
      case '3d-reversi': return <ThreeReversi3D onGameOver={handleGameOver} />;
      case '3d-gomoku': return <ThreeGomoku3D onGameOver={handleGameOver} />;
      case '3d-minesweeper': return <ThreeMinesweeper3D onGameOver={handleGameOver} />;
      case '3d-simon-says': return <ThreeSimon3D onGameOver={handleGameOver} />;
      case '3d-towers-hanoi': return <ThreePuzzleBoardPack variant="hanoi" onGameOver={handleGameOver} />;
      case '3d-sliding-puzzle': return <ThreePuzzleBoardPack variant="slide" onGameOver={handleGameOver} />;
      case '3d-chess-knight': return <ThreePuzzleBoardPack variant="knight" onGameOver={handleGameOver} />;
      case '3d-sudoku-mini': return <ThreePuzzleBoardPack variant="sudoku" onGameOver={handleGameOver} />;
      case '3d-domino-match': return <ThreePuzzleBoardPack variant="domino" onGameOver={handleGameOver} />;
      case '3d-math-dice': return <ThreePuzzleBoardPack variant="dice-duel" onGameOver={handleGameOver} />;

      case '3d-car-drift': return <ThreeCarDrift onGameOver={handleGameOver} />;
      case '3d-cube-runner': return <ThreeCubeRunner onGameOver={handleGameOver} />;
      case '3d-moto-gp': return <ThreeLaneRacerPack variant="moto" onGameOver={handleGameOver} />;
      case '3d-boat-rush': return <ThreeLaneRacerPack variant="boat" onGameOver={handleGameOver} />;
      case '3d-jet-canyon': return <ThreeLaneRacerPack variant="jet" onGameOver={handleGameOver} />;
      case '3d-heli-rescue': return <ThreeLaneRacerPack variant="heli" onGameOver={handleGameOver} />;
      case '3d-kart-turbo': return <ThreeLaneRacerPack variant="kart" onGameOver={handleGameOver} />;
      case '3d-ski-slalom': return <ThreeLaneRacerPack variant="ski" onGameOver={handleGameOver} />;
      case '3d-hoverboard': return <ThreeLaneRacerPack variant="hover" onGameOver={handleGameOver} />;
      case '3d-monster-truck': return <ThreeLaneRacerPack variant="monster" onGameOver={handleGameOver} />;
      case '3d-pod-racer': return <ThreeLaneRacerPack variant="pod" onGameOver={handleGameOver} />;
      case '3d-subway-dash': return <ThreeLaneRacerPack variant="subway" onGameOver={handleGameOver} />;

      case '3d-bowling': return <ThreeBowling onGameOver={handleGameOver} />;
      case '3d-hoops': return <ThreeHoops onGameOver={handleGameOver} />;
      case '3d-penalty-kick': return <ThreeTargetSportsPack variant="penalty" onGameOver={handleGameOver} />;
      case '3d-mini-golf': return <ThreeTargetSportsPack variant="golf" onGameOver={handleGameOver} />;
      case '3d-archery-pro': return <ThreeTargetSportsPack variant="archery" onGameOver={handleGameOver} />;
      case '3d-darts-3d': return <ThreeTargetSportsPack variant="darts" onGameOver={handleGameOver} />;
      case '3d-pool-shot': return <ThreeTargetSportsPack variant="pool" onGameOver={handleGameOver} />;
      case '3d-skee-ball': return <ThreeTargetSportsPack variant="skeeball" onGameOver={handleGameOver} />;
      case '3d-table-tennis': return <ThreePaddleSportsPack variant="table-tennis" onGameOver={handleGameOver} />;
      case '3d-air-hockey': return <ThreePaddleSportsPack variant="air-hockey" onGameOver={handleGameOver} />;
      case '3d-baseball-hr': return <ThreePaddleSportsPack variant="baseball" onGameOver={handleGameOver} />;
      case '3d-cricket-six': return <ThreePaddleSportsPack variant="cricket" onGameOver={handleGameOver} />;

      case '3d-space-dogfight': return <ThreeSpaceDogfight onGameOver={handleGameOver} />;
      case '3d-tunnel-rush': return <ThreeTunnelRush onGameOver={handleGameOver} />;
      case '3d-tank-battle': return <ThreeCombatPack variant="tank" onGameOver={handleGameOver} />;
      case '3d-turret-defense': return <ThreeCombatPack variant="turret" onGameOver={handleGameOver} />;
      case '3d-asteroid-blast': return <ThreeCombatPack variant="asteroid" onGameOver={handleGameOver} />;
      case '3d-alien-invasion': return <ThreeCombatPack variant="alien" onGameOver={handleGameOver} />;
      case '3d-boss-raid': return <ThreeCombatPack variant="boss" onGameOver={handleGameOver} />;
      case '3d-zombie-holdout': return <ThreeCombatPack variant="zombie" onGameOver={handleGameOver} />;
      case '3d-sniper-range': return <ThreeTapActionPack variant="sniper" onGameOver={handleGameOver} />;
      case '3d-ninja-slice': return <ThreeTapActionPack variant="ninja" onGameOver={handleGameOver} />;
      case '3d-hammer-whack': return <ThreeTapActionPack variant="whack" onGameOver={handleGameOver} />;
      case '3d-piano-tiles': return <ThreeTapActionPack variant="piano" onGameOver={handleGameOver} />;

      case '3d-tower-stack': return <ThreeTowerStack onGameOver={handleGameOver} />;
      case '3d-snake': return <ThreeSnake onGameOver={handleGameOver} />;
      case '3d-maze-ball': return <ThreeMazeBall onGameOver={handleGameOver} />;
      case '3d-brick-smash': return <ThreeBrickSmash onGameOver={handleGameOver} />;
      case '3d-helix-drop': return <ThreeReflexPack variant="helix" onGameOver={handleGameOver} />;
      case '3d-color-tunnel': return <ThreeReflexPack variant="color-ring" onGameOver={handleGameOver} />;
      case '3d-flappy-drone': return <ThreeReflexPack variant="flappy" onGameOver={handleGameOver} />;
      case '3d-jump-pads': return <ThreeReflexPack variant="sky-hop" onGameOver={handleGameOver} />;
      case '3d-stack-roll': return <ThreeReflexPack variant="crossy" onGameOver={handleGameOver} />;
      case '3d-coin-magnet': return <ThreeArcadeMixPack variant="coin-magnet" onGameOver={handleGameOver} />;
      case '3d-orb-catcher': return <ThreeArcadeMixPack variant="orb-catcher" onGameOver={handleGameOver} />;
      case '3d-meteor-dodge': return <ThreeArcadeMixPack variant="meteor-dodge" onGameOver={handleGameOver} />;
      case '3d-cube-2048': return <ThreeArcadeMixPack variant="cube-2048" onGameOver={handleGameOver} />;
      case '3d-bubble-pop': return <ThreeArcadeMixPack variant="bubble-pop" onGameOver={handleGameOver} />;
      default: return <div>Game not found</div>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-between p-2 sm:p-4 overflow-y-auto overscroll-contain">
      {/* Top Game Bar */}
      <div className="w-full max-w-md flex items-center justify-between py-2 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={handleCloseModal}
            className="w-11 h-11 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
            aria-label="Close Game"
          >
            <X size={18} />
          </button>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight leading-none">{game.title}</h2>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
              <span className="capitalize">{game.category}</span>
              <span>·</span>
              <span className="flex items-center gap-0.5 text-amber-400 font-mono">
                <Trophy size={10} /> Best: {bestScore}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setShowInstructions(!showInstructions);
              (document.activeElement as HTMLElement | null)?.blur?.();
            }}
            className="w-11 h-11 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
            title="How to Play"
            aria-label="How to Play"
          >
            <HelpCircle size={18} />
          </button>
          <button
            onClick={handleMuteToggle}
            className="w-11 h-11 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX size={18} className="text-rose-400" /> : <Volume2 size={18} className="text-cyan-400" />}
          </button>
        </div>
      </div>

      {/* Instructions Dropdown */}
      {showInstructions && (
        <div className="w-full max-w-md my-2 p-3 bg-slate-900 border border-cyan-500/30 rounded-xl text-xs space-y-1.5 animate-in fade-in duration-200 shrink-0">
          <div className="flex items-center justify-between font-bold text-cyan-400">
            <span>How to Play</span>
            <span className="text-[10px] text-slate-400">{game.controlsText}</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-300">
            {game.instructions.map((ins, i) => (
              <li key={i}>{ins}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Game Center Stage - touch-none ensures game swipes/drags never scroll the modal */}
      <div className="my-auto py-2 flex flex-col items-center justify-center w-full max-w-md touch-none select-none">
        {renderGameComponent()}
      </div>

      {/* Result celebration banner if achieved new high score */}
      {sessionResults && (
        <div className="w-full max-w-md mt-2 p-2.5 bg-slate-900/90 border border-white/10 rounded-xl flex items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-yellow-500/20 text-yellow-400 flex items-center justify-center font-bold shrink-0">
              <Coins size={15} />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-white truncate">+{sessionResults.coins} Coins Deposited</div>
              <div className="text-[10px] text-slate-400">Score: {sessionResults.score} {sessionResults.isNewHigh && '· 🏆 New Best!'}</div>
            </div>
          </div>
          {canWatchNativeReward && !sessionResults.doubled ? (
            <button
              type="button"
              onClick={handleWatchRewardedInterstitial}
              disabled={rewardAdLoading}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-extrabold text-[11px] flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
            >
              {rewardAdLoading ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  <span>Loading…</span>
                </>
              ) : (
                <>
                  <PlayCircle size={13} />
                  <span>+{Math.max(10, sessionResults.coins)} Watch Ad</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => setSessionResults(null)}
              className="text-[11px] text-slate-400 hover:text-white px-2 py-1 shrink-0"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
};
