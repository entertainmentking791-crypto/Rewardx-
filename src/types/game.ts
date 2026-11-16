export type GameCategory = 'all' | 'board' | 'racing' | 'sports' | 'action' | 'arcade' | '3d' | 'puzzle' | 'casual';

export interface GameDefinition {
  id: string;
  title: string;
  category: GameCategory;
  description: string;
  icon: string; // lucide icon identifier or visual symbol
  color: string; // neon accent color
  badgeText?: string;
  is3D?: boolean;
  instructions: string[];
  controlsText: string;
  rewardRate: string; // e.g., "1 Coin per 50 pts"
}

export interface GameScoreResult {
  score: number;
  coinsEarned: number;
  isNewHigh: boolean;
}

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: 'EARN_GAME' | 'DAILY_BONUS' | 'REDEEM_REWARD' | 'ACHIEVEMENT' | 'REWARDED_AD';
  date: string;
  gameId?: string;
  status: 'COMPLETED' | 'PROCESSING' | 'PENDING';
}

export interface AdMobConfig {
  appId: string;
  interstitialId: string;
  bannerId: string;
  rewardedId: string;
  rewardedInterstitialId: string;
  nativeAdvancedId: string;
  appOpenId: string;
  interstitialCooldownSec: number;
}

export interface UserProfile {
  uid?: string;
  email?: string;
  photoURL?: string;
  name: string;
  avatarId: string;
  level: number;
  xp: number;
  coins: number;
  joinedDate: string;
  unlockedAvatars: string[];
  claimedBadges: string[];
  claimedRewardIds: string[];
}

export interface DailyBonusState {
  lastClaimDate: string | null;
  currentStreak: number;
  claimHistory: string[];
}

export interface RewardItem {
  id: string;
  title: string;
  category: 'COSMETIC' | 'BOOSTER' | 'VOUCHER' | 'VIP';
  coinCost: number;
  rupeeValue?: number;
  minLevel: number;
  description: string;
  rewardCode?: string;
  icon: string;
  stockText: string;
  terms: string;
}
