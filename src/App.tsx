import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { GameDefinition } from './types/game';
import { storage } from './services/storage';
import { auth, loadOrCreateUserCloudAccount, signOutFirebase } from './services/firebase';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { GameModal } from './components/GameModal';
import { DailyBonusModal } from './components/DailyBonusModal';
import { SignInScreen } from './components/SignInScreen';

import { HomeView } from './views/HomeView';
import { GamesView } from './views/GamesView';
import { TasksView } from './views/TasksView';
import { WalletView } from './views/WalletView';
import { RewardsView } from './views/RewardsView';
import { ProfileView } from './views/ProfileView';
import { SettingsView } from './views/SettingsView';
import { admobService } from './services/admob';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [authStatus, setAuthStatus] = useState<'checking' | 'signed-out' | 'syncing' | 'ready'>('checking');
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>('home');
  const [gamesInitialMode, setGamesInitialMode] = useState<'all' | 'board' | 'racing' | 'sports' | 'action' | 'arcade'>('all');
  const [activeGame, setActiveGame] = useState<GameDefinition | null>(null);
  const [isDailyBonusOpen, setIsDailyBonusOpen] = useState(false);
  const [profile, setProfile] = useState(() => storage.getProfile());
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    void admobService.initialize();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void admobService.showAppOpenIfReady();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        storage.clearSessionCache();
        setActiveGame(null);
        setIsDailyBonusOpen(false);
        setAuthStatus('signed-out');
        return;
      }

      setAuthError(null);
      setAuthStatus('syncing');
      try {
        const cloud = await loadOrCreateUserCloudAccount(firebaseUser);
        storage.hydrateFromCloud(firebaseUser.uid, cloud);
        setProfile(storage.getProfile());
        setRefreshKey((k) => k + 1);
        setAuthStatus('ready');
      } catch {
        setAuthError('Could not load your saved account details. Please try signing in again.');
        storage.clearSessionCache();
        await signOutFirebase().catch(() => {});
        setAuthStatus('signed-out');
      }
    });

    return () => unsubscribe();
  }, []);

  const refreshUserData = () => {
    setProfile(storage.getProfile());
    setRefreshKey((k) => k + 1);
  };

  if (authStatus === 'checking' || authStatus === 'syncing') {
    return (
      <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col items-center justify-center p-6 gap-4">
        <div className="text-2xl font-black tracking-tight">
          <span className="text-cyan-400">Reward</span>
          <span className="text-purple-500">X</span>
        </div>
        <div className="flex items-center gap-2.5 text-xs text-slate-400 font-medium">
          <Loader2 size={16} className="animate-spin text-cyan-400" />
          <span>{authStatus === 'syncing' ? 'Loading your saved profile & wallet…' : 'Checking session…'}</span>
        </div>
      </div>
    );
  }

  if (authStatus === 'signed-out') {
    return <SignInScreen externalError={authError} />;
  }

  const { canClaim: canClaimBonus } = storage.canClaimDailyBonus();

  return (
    <div key={refreshKey} className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black">
      {/* Top Navbar */}
      <Navbar
        coins={profile.coins}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenDailyBonus={() => setIsDailyBonusOpen(true)}
        canClaimBonus={canClaimBonus}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-8 py-5">
        {activeTab === 'home' && (
          <HomeView
            onLaunchGame={(game) => setActiveGame(game)}
            onViewAllGames={(mode = 'all') => {
              setGamesInitialMode(mode);
              setActiveTab('games');
            }}
            onOpenDailyBonus={() => setIsDailyBonusOpen(true)}
            canClaimBonus={canClaimBonus}
          />
        )}

        {activeTab === 'games' && (
          <GamesView
            onLaunchGame={(game) => setActiveGame(game)}
            initialMode={gamesInitialMode}
          />
        )}

        {activeTab === 'tasks' && (
          <TasksView
            coins={profile.coins}
            onCoinsUpdated={refreshUserData}
            onNavigateToWallet={() => setActiveTab('wallet')}
            onNavigateToRewards={() => setActiveTab('rewards')}
          />
        )}

        {activeTab === 'wallet' && (
          <WalletView
            coins={profile.coins}
            onNavigateToRewards={() => setActiveTab('rewards')}
            onNavigateToTasks={() => setActiveTab('tasks')}
          />
        )}

        {activeTab === 'rewards' && (
          <RewardsView
            coins={profile.coins}
            userLevel={profile.level}
            onRewardClaimed={refreshUserData}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            onProfileUpdated={refreshUserData}
            onOpenSettings={() => setActiveTab('settings')}
            onSignOut={async () => {
              storage.clearSessionCache();
              setActiveTab('home');
              await signOutFirebase();
            }}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            onDataReset={refreshUserData}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Daily Bonus Streak Modal */}
      <DailyBonusModal
        isOpen={isDailyBonusOpen}
        onClose={() => setIsDailyBonusOpen(false)}
        onClaimed={() => {
          refreshUserData();
          setIsDailyBonusOpen(false);
        }}
      />

      {/* 3D WebGL Game Modal */}
      {activeGame && (
        <GameModal
          game={activeGame}
          onClose={() => setActiveGame(null)}
          onScoreEarned={refreshUserData}
        />
      )}
    </div>
  );
}
