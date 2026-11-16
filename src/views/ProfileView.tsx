import React, { useState } from 'react';
import { storage } from '../services/storage';
import { sound } from '../services/audio';
import { GAMES_CATALOG } from '../data/gamesList';
import { GameThumbnail } from '../components/GameThumbnail';
import { Trophy, Award, Edit2, Check, Sparkles, Coins, Gamepad2, Settings, LogOut, Mail } from 'lucide-react';

interface Props {
  onProfileUpdated: () => void;
  onOpenSettings?: () => void;
  onSignOut?: () => void;
}

const AVATARS = [
  { id: 'avatar-1', label: 'Cyber Pilot', emoji: '🧑‍🚀', bg: 'bg-cyan-500/20 border-cyan-400' },
  { id: 'avatar-2', label: 'Pixel Ninja', emoji: '🥷', bg: 'bg-rose-500/20 border-rose-400' },
  { id: 'avatar-3', label: 'Arcade King', emoji: '👑', bg: 'bg-amber-500/20 border-amber-400' },
  { id: 'avatar-4', label: 'Mech Knight', emoji: '🤖', bg: 'bg-purple-500/20 border-purple-400' },
  { id: 'avatar-5', label: 'Star Raider', emoji: '🛸', bg: 'bg-blue-500/20 border-blue-400' },
  { id: 'avatar-6', label: 'Glitch Fox', emoji: '🦊', bg: 'bg-orange-500/20 border-orange-400' },
  { id: 'avatar-7', label: 'Neon Wizard', emoji: '🧙‍♂️', bg: 'bg-emerald-500/20 border-emerald-400' },
  { id: 'avatar-8', label: 'Cyber Cyborg', emoji: '👾', bg: 'bg-pink-500/20 border-pink-400' },
];

export const ProfileView: React.FC<Props> = ({ onProfileUpdated, onOpenSettings, onSignOut }) => {
  const [profile, setProfile] = useState(() => storage.getProfile());
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(profile.name);

  const highScores = storage.getHighScores();
  const transactions = storage.getTransactions();

  const totalGamesPlayed = transactions.filter(t => t.type === 'EARN_GAME').length;
  const currentAvatar = AVATARS.find(a => a.id === profile.avatarId) || AVATARS[0];

  // XP calculations: next level at level^2 * 100 XP
  const nextLevelXp = Math.pow(profile.level, 2) * 100;
  const currentLevelBaseXp = Math.pow(profile.level - 1, 2) * 100;
  const xpInCurrentLevel = Math.max(0, profile.xp - currentLevelBaseXp);
  const xpNeededInCurrentLevel = Math.max(1, nextLevelXp - currentLevelBaseXp);
  const xpPercent = Math.min(100, Math.floor((xpInCurrentLevel / xpNeededInCurrentLevel) * 100));

  const saveName = () => {
    if (!tempName.trim()) return;
    const updated = { ...profile, name: tempName.trim() };
    storage.saveProfile(updated);
    setProfile(updated);
    setIsEditingName(false);
    sound.playClick();
    onProfileUpdated();
  };

  const selectAvatar = (avatarId: string) => {
    const updated = { ...profile, avatarId };
    storage.saveProfile(updated);
    setProfile(updated);
    sound.playClick();
    onProfileUpdated();
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Profile Header Card */}
      <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-purple-950/40 via-[#10131f] to-slate-900 border border-purple-500/20 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Avatar Icon */}
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl border-2 shadow-lg ${currentAvatar.bg}`}>
            {currentAvatar.emoji}
          </div>

          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    maxLength={16}
                    className="bg-slate-800 border border-purple-400 rounded-lg px-2.5 py-1 text-sm font-bold text-white focus:outline-none"
                  />
                  <button
                    onClick={saveName}
                    className="p-1.5 bg-purple-600 rounded-lg text-white hover:bg-purple-500"
                  >
                    <Check size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">{profile.name}</h1>
                  <button
                    onClick={() => { setTempName(profile.name); setIsEditingName(true); }}
                    className="text-slate-400 hover:text-white p-1"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="text-purple-400 font-bold">Level {profile.level} Challenger</span>
              <span>·</span>
              <span>Joined {profile.joinedDate}</span>
            </div>

            {profile.email && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-white/10 text-[11px] text-cyan-300 font-medium">
                <Mail size={12} className="shrink-0" />
                <span className="truncate max-w-[220px]">{profile.email}</span>
              </div>
            )}

            {/* XP Bar */}
            <div className="w-full max-w-md pt-1">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-1">
                <span>XP: {profile.xp}</span>
                <span>Next Level: {nextLevelXp} XP ({xpPercent}%)</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-500"
                  style={{ width: `${xpPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onOpenSettings();
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/10 text-xs font-bold text-slate-200 flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
              >
                <Settings size={15} className="text-cyan-400" />
                <span>App Settings</span>
              </button>
            )}
            {onSignOut && (
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onSignOut();
                }}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/35 text-xs font-bold text-rose-200 flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <LogOut size={15} className="text-rose-400" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/10">
          <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
            <div className="text-[11px] text-slate-400">Total Coins</div>
            <div className="text-base font-bold text-amber-400 font-mono tabular-nums flex items-center gap-1 mt-0.5">
              <Coins size={14} /> {profile.coins.toLocaleString()}
            </div>
          </div>
          <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
            <div className="text-[11px] text-slate-400">Games Played</div>
            <div className="text-base font-bold text-cyan-400 font-mono tabular-nums flex items-center gap-1 mt-0.5">
              <Gamepad2 size={14} /> {totalGamesPlayed}
            </div>
          </div>
          <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
            <div className="text-[11px] text-slate-400">Rewards Claimed</div>
            <div className="text-base font-bold text-pink-400 font-mono tabular-nums flex items-center gap-1 mt-0.5">
              <Award size={14} /> {profile.claimedRewardIds.length}
            </div>
          </div>
        </div>
      </div>

      {/* Avatar Picker */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Sparkles size={16} className="text-purple-400" /> Choose Player Avatar
        </h2>

        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
          {AVATARS.map((av) => (
            <button
              key={av.id}
              onClick={() => selectAvatar(av.id)}
              className={`p-2 rounded-xl flex flex-col items-center gap-1 border transition-all ${
                profile.avatarId === av.id
                  ? 'bg-purple-950/80 border-purple-400 scale-105 shadow-md shadow-purple-500/20'
                  : 'bg-slate-900/60 border-white/5 hover:border-white/20'
              }`}
            >
              <span className="text-2xl">{av.emoji}</span>
              <span className="text-[10px] text-slate-300 font-semibold truncate w-full text-center">
                {av.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Hall of Fame: High Scores across all 66 3D games */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Trophy size={16} className="text-amber-400" /> High Scores Hall of Fame ({GAMES_CATALOG.length})
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {GAMES_CATALOG.map((game) => {
            const best = highScores[game.id] || 0;
            const catText =
              game.category === 'board'
                ? '3D Board & Party'
                : game.category === 'racing'
                ? '3D Racing & Flight'
                : game.category === 'sports'
                ? '3D Sports & Precision'
                : game.category === 'action'
                ? '3D Action & Combat'
                : '3D Arcade & Puzzle';
            return (
              <div
                key={game.id}
                className="p-3 bg-[#0d101a] border border-white/10 rounded-xl flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-12 h-9 rounded-lg overflow-hidden shrink-0 border border-white/10">
                    <GameThumbnail game={game} variant="hero" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white leading-tight truncate">{game.title}</div>
                    <div className="text-[10px] text-slate-400">
                      {catText}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-amber-400 tabular-nums">
                    {best > 0 ? `${best} pts` : '—'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
