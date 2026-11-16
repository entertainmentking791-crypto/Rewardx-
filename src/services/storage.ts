import { AdMobConfig, DailyBonusState, Transaction, UserProfile } from '../types/game';
import {
  CloudUserHydration,
  syncUserFieldsToCloud,
  writeTransactionToCloud,
} from './firebase';

const STORAGE_KEYS = {
  PROFILE: 'gamex_user_profile',
  TRANSACTIONS: 'gamex_transactions',
  SCORES: 'gamex_high_scores',
  DAILY_BONUS: 'gamex_daily_bonus',
  SETTINGS: 'gamex_settings',
  ADMOB_CONFIG: 'gamex_admob_config',
  RECENT_GAMES: 'gamex_recent_games',
  AD_TASKS: 'gamex_ad_tasks_state'
};

export interface AdTasksState {
  date: string;
  watchesByTask: Record<string, number>;
  totalWatchedToday: number;
  coinsEarnedToday: number;
  claimedMilestones: string[];
}

const DEFAULT_ADMOB_CONFIG: AdMobConfig = {
  appId: 'ca-app-pub-3246619602569680~4287491023',
  interstitialId: 'ca-app-pub-3246619602569680/3297842982',
  bannerId: 'ca-app-pub-3246619602569680/8358597975',
  rewardedId: 'ca-app-pub-3246619602569680/9474424430',
  rewardedInterstitialId: 'ca-app-pub-3246619602569680/8394256996',
  nativeAdvancedId: 'ca-app-pub-3246619602569680/4852653144',
  appOpenId: 'ca-app-pub-3246619602569680/2226489807',
  interstitialCooldownSec: 90,
};

const DEFAULT_PROFILE: UserProfile = {
  name: 'CyberPlayer',
  avatarId: 'avatar-1',
  level: 1,
  xp: 150,
  coins: 250,
  joinedDate: new Date().toISOString().split('T')[0],
  unlockedAvatars: ['avatar-1', 'avatar-2', 'avatar-3'],
  claimedBadges: ['Rookie Gamer'],
  claimedRewardIds: []
};

const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-welcome-01',
    title: 'RewardX Welcome Bonus',
    amount: 250,
    type: 'DAILY_BONUS',
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    status: 'COMPLETED'
  }
];

const DEFAULT_DAILY_BONUS: DailyBonusState = {
  lastClaimDate: null,
  currentStreak: 0,
  claimHistory: []
};

let activeCloudUid: string | null = null;

function syncToCloud(fields: Record<string, unknown>) {
  if (!activeCloudUid) return;
  void syncUserFieldsToCloud(activeCloudUid, fields).catch(() => {
    // Error logged inside handleFirestoreError
  });
}

function syncTransactionToCloud(tx: Transaction) {
  if (!activeCloudUid) return;
  void writeTransactionToCloud(activeCloudUid, tx).catch(() => {
    // Error logged inside handleFirestoreError
  });
}

export const storage = {
  hydrateFromCloud(uid: string, cloud: CloudUserHydration): void {
    activeCloudUid = uid;
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(cloud.profile));
    localStorage.setItem(STORAGE_KEYS.SCORES, JSON.stringify(cloud.highScores || {}));
    localStorage.setItem(STORAGE_KEYS.RECENT_GAMES, JSON.stringify(cloud.recentGames || []));
    localStorage.setItem(STORAGE_KEYS.DAILY_BONUS, JSON.stringify(cloud.dailyBonus || DEFAULT_DAILY_BONUS));
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(cloud.transactions || []));
    if (cloud.adTasks) {
      localStorage.setItem(STORAGE_KEYS.AD_TASKS, JSON.stringify(cloud.adTasks));
    } else {
      localStorage.removeItem(STORAGE_KEYS.AD_TASKS);
    }
  },

  clearSessionCache(): void {
    activeCloudUid = null;
    localStorage.removeItem(STORAGE_KEYS.PROFILE);
    localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
    localStorage.removeItem(STORAGE_KEYS.SCORES);
    localStorage.removeItem(STORAGE_KEYS.DAILY_BONUS);
    localStorage.removeItem(STORAGE_KEYS.RECENT_GAMES);
    localStorage.removeItem(STORAGE_KEYS.AD_TASKS);
  },

  getProfile(): UserProfile {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROFILE);
      return data ? { ...DEFAULT_PROFILE, ...JSON.parse(data) } : DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  },

  saveProfile(profile: UserProfile): void {
    const safeName = (profile.name || 'CyberPlayer').trim().slice(0, 40) || 'CyberPlayer';
    const next = { ...profile, name: safeName };
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(next));
    syncToCloud({
      name: next.name,
      avatarId: next.avatarId,
      level: Math.max(1, Math.trunc(next.level)),
      xp: Math.max(0, Math.trunc(next.xp)),
      coins: Math.max(0, Math.trunc(next.coins)),
      unlockedAvatars: (next.unlockedAvatars || []).slice(0, 16),
      claimedBadges: (next.claimedBadges || []).slice(0, 16),
      claimedRewardIds: (next.claimedRewardIds || []).slice(0, 64),
    });
  },

  getTransactions(): Transaction[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      return data ? JSON.parse(data) : INITIAL_TRANSACTIONS;
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  },

  addTransaction(tx: Omit<Transaction, 'id' | 'date'>): Transaction {
    const transactions = this.getTransactions();
    const newTx: Transaction = {
      ...tx,
      id: 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    };
    const updated = [newTx, ...transactions].slice(0, 100);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated));
    syncTransactionToCloud(newTx);
    return newTx;
  },

  getHighScores(): Record<string, number> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SCORES);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  },

  saveScore(gameId: string, score: number, coinsEarned: number): { isNewHigh: boolean; coinsAwarded: number } {
    const scores = this.getHighScores();
    const prevHigh = scores[gameId] || 0;
    const isNewHigh = score > prevHigh;

    if (isNewHigh) {
      scores[gameId] = score;
      localStorage.setItem(STORAGE_KEYS.SCORES, JSON.stringify(scores));
    }

    const actualCoins = coinsEarned;
    const profile = this.getProfile();
    if (actualCoins > 0) {
      profile.coins += actualCoins;
      profile.xp += score;
      profile.level = Math.max(1, Math.floor(Math.sqrt(profile.xp / 100)) + 1);
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));

      this.addTransaction({
        title: `Played ${gameId}`,
        amount: actualCoins,
        type: 'EARN_GAME',
        gameId,
        status: 'COMPLETED'
      });
    }

    const recents = this.getRecentGames().filter(id => id !== gameId);
    recents.unshift(gameId);
    const trimmedRecents = recents.slice(0, 6);
    localStorage.setItem(STORAGE_KEYS.RECENT_GAMES, JSON.stringify(trimmedRecents));

    syncToCloud({
      coins: Math.max(0, Math.trunc(profile.coins)),
      xp: Math.max(0, Math.trunc(profile.xp)),
      level: Math.max(1, Math.trunc(profile.level)),
      highScores: scores,
      recentGames: trimmedRecents,
    });

    return { isNewHigh, coinsAwarded: actualCoins };
  },

  getRecentGames(): string[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RECENT_GAMES);
      return data ? JSON.parse(data) : ['3d-ludo', '3d-tic-tac-toe', '3d-car-drift', '3d-bowling'];
    } catch {
      return ['3d-ludo', '3d-tic-tac-toe', '3d-car-drift', '3d-bowling'];
    }
  },

  recordRecentGame(gameId: string): void {
    const recents = this.getRecentGames().filter(id => id !== gameId);
    recents.unshift(gameId);
    const trimmed = recents.slice(0, 6);
    localStorage.setItem(STORAGE_KEYS.RECENT_GAMES, JSON.stringify(trimmed));
    syncToCloud({ recentGames: trimmed });
  },

  getDailyBonus(): DailyBonusState {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DAILY_BONUS);
      return data ? JSON.parse(data) : DEFAULT_DAILY_BONUS;
    } catch {
      return DEFAULT_DAILY_BONUS;
    }
  },

  canClaimDailyBonus(): { canClaim: boolean; hoursRemaining: number } {
    const bonus = this.getDailyBonus();
    if (!bonus.lastClaimDate) return { canClaim: true, hoursRemaining: 0 };

    const lastTime = new Date(bonus.lastClaimDate).getTime();
    const now = Date.now();
    const diffHours = (now - lastTime) / (1000 * 60 * 60);

    if (diffHours >= 20) {
      return { canClaim: true, hoursRemaining: 0 };
    }
    return { canClaim: false, hoursRemaining: Math.ceil(20 - diffHours) };
  },

  claimDailyBonus(rewardAmount: number): { success: boolean; newStreak: number } {
    const { canClaim } = this.canClaimDailyBonus();
    if (!canClaim) return { success: false, newStreak: 0 };

    const bonus = this.getDailyBonus();
    const newStreak = (bonus.currentStreak % 7) + 1;
    bonus.currentStreak = newStreak;
    bonus.lastClaimDate = new Date().toISOString();
    bonus.claimHistory = [...(bonus.claimHistory || []), new Date().toISOString()].slice(-30);

    localStorage.setItem(STORAGE_KEYS.DAILY_BONUS, JSON.stringify(bonus));

    const profile = this.getProfile();
    profile.coins += rewardAmount;
    profile.xp += 50;
    profile.level = Math.max(1, Math.floor(Math.sqrt(profile.xp / 100)) + 1);
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));

    this.addTransaction({
      title: `Day ${newStreak} Daily Bonus`,
      amount: rewardAmount,
      type: 'DAILY_BONUS',
      status: 'COMPLETED'
    });

    syncToCloud({
      coins: Math.max(0, Math.trunc(profile.coins)),
      xp: Math.max(0, Math.trunc(profile.xp)),
      level: Math.max(1, Math.trunc(profile.level)),
      dailyBonus: bonus,
    });

    return { success: true, newStreak };
  },

  redeemReward(rewardId: string, coinCost: number, title: string, isVoucher: boolean): { success: boolean; error?: string } {
    const profile = this.getProfile();
    if (profile.coins < coinCost) {
      return { success: false, error: 'Insufficient coins in your wallet.' };
    }

    profile.coins -= coinCost;
    if (!profile.claimedRewardIds.includes(rewardId)) {
      profile.claimedRewardIds.push(rewardId);
    }
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));

    this.addTransaction({
      title: `Redeemed: ${title}`,
      amount: -coinCost,
      type: 'REDEEM_REWARD',
      status: isVoucher ? 'PENDING' : 'COMPLETED'
    });

    syncToCloud({
      coins: Math.max(0, Math.trunc(profile.coins)),
      claimedRewardIds: profile.claimedRewardIds.slice(0, 64),
    });

    return { success: true };
  },

  getAdMobConfig(): AdMobConfig {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ADMOB_CONFIG);
      if (!data) return DEFAULT_ADMOB_CONFIG;
      const parsed = JSON.parse(data) as Partial<AdMobConfig>;
      return {
        appId: parsed.appId || DEFAULT_ADMOB_CONFIG.appId,
        interstitialId: parsed.interstitialId || DEFAULT_ADMOB_CONFIG.interstitialId,
        bannerId: parsed.bannerId || DEFAULT_ADMOB_CONFIG.bannerId,
        rewardedId: parsed.rewardedId || DEFAULT_ADMOB_CONFIG.rewardedId,
        rewardedInterstitialId: parsed.rewardedInterstitialId || DEFAULT_ADMOB_CONFIG.rewardedInterstitialId,
        nativeAdvancedId: parsed.nativeAdvancedId || DEFAULT_ADMOB_CONFIG.nativeAdvancedId,
        appOpenId: parsed.appOpenId || DEFAULT_ADMOB_CONFIG.appOpenId,
        interstitialCooldownSec: parsed.interstitialCooldownSec || DEFAULT_ADMOB_CONFIG.interstitialCooldownSec,
      };
    } catch {
      return DEFAULT_ADMOB_CONFIG;
    }
  },

  saveAdMobConfig(config: AdMobConfig): void {
    localStorage.setItem(STORAGE_KEYS.ADMOB_CONFIG, JSON.stringify(config));
  },

  creditRewardedCoins(amount: number, title: string = 'Rewarded Ad Bonus'): { coins: number } {
    const profile = this.getProfile();
    profile.coins += amount;
    profile.xp += 15;
    profile.level = Math.max(1, Math.floor(Math.sqrt(profile.xp / 100)) + 1);
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));

    this.addTransaction({
      title,
      amount,
      type: 'REWARDED_AD',
      status: 'COMPLETED',
    });

    syncToCloud({
      coins: Math.max(0, Math.trunc(profile.coins)),
      xp: Math.max(0, Math.trunc(profile.xp)),
      level: Math.max(1, Math.trunc(profile.level)),
    });

    return { coins: profile.coins };
  },

  getAdTasksState(): AdTasksState {
    const today = new Date().toISOString().split('T')[0];
    const fresh: AdTasksState = {
      date: today,
      watchesByTask: {},
      totalWatchedToday: 0,
      coinsEarnedToday: 0,
      claimedMilestones: [],
    };
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.AD_TASKS);
      if (!raw) return fresh;
      const parsed = JSON.parse(raw) as Partial<AdTasksState>;
      if (parsed.date !== today) return fresh;
      return {
        date: today,
        watchesByTask: parsed.watchesByTask || {},
        totalWatchedToday: parsed.totalWatchedToday || 0,
        coinsEarnedToday: parsed.coinsEarnedToday || 0,
        claimedMilestones: parsed.claimedMilestones || [],
      };
    } catch {
      return fresh;
    }
  },

  recordAdTaskWatch(taskId: string, coins: number, label: string): AdTasksState {
    const state = this.getAdTasksState();
    state.watchesByTask[taskId] = (state.watchesByTask[taskId] || 0) + 1;
    state.totalWatchedToday += 1;
    state.coinsEarnedToday += coins;
    localStorage.setItem(STORAGE_KEYS.AD_TASKS, JSON.stringify(state));

    this.creditRewardedCoins(coins, `Ad Task: ${label}`);
    syncToCloud({ adTasks: state });
    return state;
  },

  claimAdMilestone(milestoneId: string, requiredWatches: number, bonusCoins: number, label: string): { success: boolean; state: AdTasksState } {
    const state = this.getAdTasksState();
    if (state.totalWatchedToday < requiredWatches || state.claimedMilestones.includes(milestoneId)) {
      return { success: false, state };
    }
    state.claimedMilestones.push(milestoneId);
    state.coinsEarnedToday += bonusCoins;
    localStorage.setItem(STORAGE_KEYS.AD_TASKS, JSON.stringify(state));

    this.creditRewardedCoins(bonusCoins, `Milestone Bonus: ${label}`);
    syncToCloud({ adTasks: state });
    return { success: true, state };
  },

  resetAllData(): void {
    const admobCfg = this.getAdMobConfig();
    const prevProfile = this.getProfile();
    localStorage.clear();
    localStorage.setItem(STORAGE_KEYS.ADMOB_CONFIG, JSON.stringify(admobCfg));

    if (activeCloudUid) {
      const cleanProfile: UserProfile = {
        ...DEFAULT_PROFILE,
        uid: activeCloudUid,
        email: prevProfile.email,
        photoURL: prevProfile.photoURL,
        name: prevProfile.name || DEFAULT_PROFILE.name,
        joinedDate: prevProfile.joinedDate || DEFAULT_PROFILE.joinedDate,
      };
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(cleanProfile));
      syncToCloud({
        name: cleanProfile.name,
        avatarId: cleanProfile.avatarId,
        level: 1,
        xp: 150,
        coins: 250,
        unlockedAvatars: cleanProfile.unlockedAvatars,
        claimedBadges: cleanProfile.claimedBadges,
        claimedRewardIds: [],
        highScores: {},
        recentGames: [],
        dailyBonus: DEFAULT_DAILY_BONUS,
      });
    }
  }
};
