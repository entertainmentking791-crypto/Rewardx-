import React from 'react';
import { Coins, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { sound } from '../services/audio';

interface Props {
  coins: number;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onOpenDailyBonus: () => void;
  canClaimBonus: boolean;
}

export const Navbar: React.FC<Props> = ({
  coins,
  activeTab,
  onSelectTab,
  onOpenDailyBonus,
  canClaimBonus
}) => {
  const [isMuted, setIsMuted] = React.useState(sound.isMuted);

  const toggleSound = () => {
    const next = sound.toggleMute();
    setIsMuted(next);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#090a0f]/90 backdrop-blur-md border-b border-white/10 px-4 md:px-8 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          onClick={() => { sound.playClick(); onSelectTab('home'); }}
          className="text-lg md:text-xl font-black tracking-tight text-white whitespace-nowrap shrink-0 flex items-center"
        >
          <span className="text-cyan-400">Reward</span>
          <span className="text-purple-500">X</span>
        </button>

        {/* Zone 2: Clean single-line text navigation links (hidden on mobile, visible on desktop) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            onClick={() => { sound.playClick(); onSelectTab('home'); }}
            className={`hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0 ${activeTab === 'home' ? 'text-cyan-400 font-bold' : ''}`}
          >
            Home
          </button>
          <button
            onClick={() => { sound.playClick(); onSelectTab('games'); }}
            className={`hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0 ${activeTab === 'games' ? 'text-cyan-400 font-bold' : ''}`}
          >
            All 66 3D Games
          </button>
          <button
            onClick={() => { sound.playClick(); onSelectTab('tasks'); }}
            className={`hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 ${activeTab === 'tasks' ? 'text-amber-400 font-bold' : ''}`}
          >
            Tasks
          </button>
          <button
            onClick={() => { sound.playClick(); onSelectTab('wallet'); }}
            className={`hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0 ${activeTab === 'wallet' ? 'text-cyan-400 font-bold' : ''}`}
          >
            Coins Wallet
          </button>
          <button
            onClick={() => { sound.playClick(); onSelectTab('rewards'); }}
            className={`hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0 ${activeTab === 'rewards' ? 'text-cyan-400 font-bold' : ''}`}
          >
            Rewards Store
          </button>
          <button
            onClick={() => { sound.playClick(); onSelectTab('profile'); }}
            className={`hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0 ${activeTab === 'profile' ? 'text-cyan-400 font-bold' : ''}`}
          >
            Player Profile
          </button>
        </nav>

        {/* Zone 3: Primary action (Coins wallet trigger & Daily streak button) */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Daily bonus pill trigger if ready */}
          <button
            onClick={() => { sound.playClick(); onOpenDailyBonus(); }}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
              canClaimBonus
                ? 'bg-purple-950/80 border-purple-500 text-purple-300 shadow-md shadow-purple-500/30 animate-pulse'
                : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
            }`}
            title="Daily Bonus"
          >
            <Sparkles size={14} className={canClaimBonus ? 'text-yellow-400' : 'text-slate-500'} />
            <span className="hidden sm:inline">Daily Bonus</span>
          </button>

          {/* Sound toggle */}
          <button
            onClick={toggleSound}
            className="w-9 h-9 rounded-xl bg-slate-900 border border-white/10 hover:border-white/20 text-slate-300 flex items-center justify-center transition-colors"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX size={16} className="text-rose-400" /> : <Volume2 size={16} className="text-cyan-400" />}
          </button>

          {/* Wallet Coins Counter Button */}
          <button
            onClick={() => { sound.playClick(); onSelectTab('wallet'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold text-xs rounded-xl shadow-md shadow-amber-500/20 active:scale-95 transition-transform"
          >
            <Coins size={15} />
            <span className="font-mono tabular-nums">{coins.toLocaleString()}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
