import { RewardItem } from '../types/game';

export const REWARDS_CATALOG: RewardItem[] = [
  {
    id: 'voucher-ff-100',
    title: '100 Free Fire Diamonds',
    category: 'VOUCHER',
    coinCost: 1000,
    minLevel: 1,
    description: '1,000 Coins = 100 Free Fire Diamonds direct UID top-up voucher.',
    icon: 'Gem',
    stockText: 'Verification Required',
    terms: '1,000 Coins = 100 Free Fire Diamonds. Enter your Free Fire UID on redeem; enters Pending Review for verification.'
  },
  {
    id: 'voucher-upi-1',
    title: '₹1 UPI Payout',
    category: 'VOUCHER',
    coinCost: 1000,
    rupeeValue: 1,
    minLevel: 1,
    description: '1,000 Coins = ₹1 instant UPI cash transfer voucher.',
    icon: 'IndianRupee',
    stockText: 'Verification Required',
    terms: '1,000 Coins = ₹1 on UPI. Enter your UPI ID on redeem; enters Pending Review until payout verification completes.'
  },
  {
    id: 'voucher-play-10',
    title: '₹10 Play Store Voucher',
    category: 'VOUCHER',
    coinCost: 1000,
    rupeeValue: 10,
    minLevel: 2,
    description: 'Official ₹10 Google Play Store digital voucher for apps, games, and in-app content.',
    icon: 'Gift',
    stockText: 'Verification Required',
    terms: 'Requires Level 2 and 1,000 coins earned from gameplay. Enters Pending Review until verification completes.'
  },
  {
    id: 'voucher-gift-25',
    title: '₹25 Gaming Gift Card',
    category: 'VOUCHER',
    coinCost: 2500,
    rupeeValue: 25,
    minLevel: 4,
    description: 'Digital ₹25 gift voucher redeemable for gaming store purchases and accessories.',
    icon: 'ShoppingBag',
    stockText: 'Verification Required',
    terms: 'Requires Level 4 and 2,500 coins. Subject to anti-cheat score verification in Pending Review.'
  },
  {
    id: 'voucher-play-50',
    title: '₹50 Play Store Voucher',
    category: 'VOUCHER',
    coinCost: 5000,
    rupeeValue: 50,
    minLevel: 7,
    description: 'Official ₹50 digital Play Store voucher for games, passes, and store content.',
    icon: 'Gift',
    stockText: 'Verification Required',
    terms: 'Requires Level 7 and 5,000 coins. Never issues fake instant codes; enters Pending Review until verified.'
  },
  {
    id: 'voucher-mega-100',
    title: '₹100 Mega Gaming Voucher',
    category: 'VOUCHER',
    coinCost: 10000,
    rupeeValue: 100,
    minLevel: 10,
    description: 'Top-tier ₹100 digital voucher reward for dedicated RewardX players.',
    icon: 'Crown',
    stockText: 'Verification Required',
    terms: 'Requires Level 10 and 10,000 coins earned across mini-games. Queued in Pending Review for verification.'
  },
  {
    id: 'booster-double-coins',
    title: '2X Coin Multiplier (24H)',
    category: 'BOOSTER',
    coinCost: 350,
    minLevel: 1,
    description: 'Doubles all coins earned across every game for a full 24-hour gaming session.',
    icon: 'Zap',
    stockText: 'Instant Unlock',
    terms: 'Activates immediately upon redemption.'
  },
  {
    id: 'booster-extra-life',
    title: 'Arcade Shield Pack (x5)',
    category: 'BOOSTER',
    coinCost: 400,
    minLevel: 2,
    description: 'Grants 5 revival shields to protect your high-score streak from accidental hits.',
    icon: 'Shield',
    stockText: 'Instant Unlock',
    terms: 'Stored directly in your local inventory.'
  },
  {
    id: 'badge-arcade-champion',
    title: 'Arcade Legend Badge',
    category: 'VIP',
    coinCost: 500,
    minLevel: 2,
    description: 'Exclusive golden arcade emblem displayed on your RewardX profile card.',
    icon: 'Crown',
    stockText: 'VIP Emblem',
    terms: 'Unlocked immediately upon redemption on your local player profile.'
  },
  {
    id: 'avatar-neon-cyborg',
    title: 'Elite Neon Cyborg Avatar',
    category: 'COSMETIC',
    coinCost: 600,
    minLevel: 2,
    description: 'Holographic neon cyborg portrait upgrade for your player profile.',
    icon: 'UserCheck',
    stockText: 'Cosmetic',
    terms: 'Unlocks directly inside your profile avatar selector.'
  },
  {
    id: 'theme-matrix-neon',
    title: 'Matrix Cyber Neon Theme',
    category: 'COSMETIC',
    coinCost: 750,
    minLevel: 3,
    description: 'Emerald digital matrix accent styling and custom neon highlights.',
    icon: 'Palette',
    stockText: 'Cosmetic',
    terms: 'Permanent local visual unlock tied to your device profile.'
  },
  {
    id: 'badge-grandmaster',
    title: 'RewardX Grandmaster Insignia',
    category: 'VIP',
    coinCost: 2000,
    minLevel: 5,
    description: 'Prestige insignia proving mastery across the games in RewardX.',
    icon: 'Award',
    stockText: 'Prestige VIP',
    terms: 'Unlocked immediately once Level 5 and coin cost requirements are met.'
  }
];
