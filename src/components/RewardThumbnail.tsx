import React from 'react';
import { RewardItem } from '../types/game';

interface Props {
  item: RewardItem;
}

const renderVoucherArt = (rupeeAmount: number, accentA: string, accentB: string, badgeLabel: string) => (
  <g>
    <defs>
      <linearGradient id={`vbg-${rupeeAmount}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={accentA} />
        <stop offset="100%" stopColor={accentB} />
      </linearGradient>
    </defs>
    <rect width="240" height="135" fill="#070a14" />
    <circle cx="195" cy="24" r="54" fill={accentA} fillOpacity="0.22" />
    <circle cx="38" cy="118" r="46" fill={accentB} fillOpacity="0.18" />

    {/* Glowing Gift Card Ticket */}
    <g transform="translate(26, 20)">
      <rect width="188" height="95" rx="14" fill={`url(#vbg-${rupeeAmount})`} stroke="#ffffff" strokeOpacity="0.35" strokeWidth="2" />
      <circle cx="0" cy="48" r="10" fill="#070a14" />
      <circle cx="188" cy="48" r="10" fill="#070a14" />
      <line x1="18" y1="24" x2="170" y2="24" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1.5" strokeDasharray="4 4" />

      <text x="22" y="18" fill="#ffffff" fillOpacity="0.9" fontSize="9.5" fontWeight="800" letterSpacing="1.5">
        {badgeLabel}
      </text>
      <text x="94" y="69" textAnchor="middle" fill="#ffffff" fontSize="38" fontWeight="900">
        ₹{rupeeAmount}
      </text>
      <text x="94" y="86" textAnchor="middle" fill="#fef08a" fontSize="10" fontWeight="800" letterSpacing="1">
        DIGITAL VOUCHER
      </text>
    </g>
  </g>
);

const renderRewardArtwork = (item: RewardItem) => {
  switch (item.id) {
    case 'voucher-ff-100':
      return (
        <g>
          <defs>
            <linearGradient id="vbg-ff100" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>
          <rect width="240" height="135" fill="#070a14" />
          <circle cx="195" cy="24" r="54" fill="#38bdf8" fillOpacity="0.22" />
          <circle cx="38" cy="118" r="46" fill="#6366f1" fillOpacity="0.2" />
          <g transform="translate(26, 20)">
            <rect width="188" height="95" rx="14" fill="url(#vbg-ff100)" stroke="#bae6fd" strokeOpacity="0.5" strokeWidth="2" />
            <circle cx="0" cy="48" r="10" fill="#070a14" />
            <circle cx="188" cy="48" r="10" fill="#070a14" />
            <line x1="18" y1="24" x2="170" y2="24" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="1.5" strokeDasharray="4 4" />
            <text x="20" y="18" fill="#ffffff" fontSize="9.5" fontWeight="800" letterSpacing="1.2">
              FREE FIRE TOP-UP
            </text>
            <polygon points="56,36 72,36 80,48 64,74 48,48" fill="#67e8f9" stroke="#ffffff" strokeWidth="2" />
            <text x="128" y="64" textAnchor="middle" fill="#ffffff" fontSize="30" fontWeight="900">
              100 💎
            </text>
            <text x="94" y="86" textAnchor="middle" fill="#fef08a" fontSize="9.5" fontWeight="800" letterSpacing="1">
              1,000 COINS = 100 DIAMONDS
            </text>
          </g>
        </g>
      );
    case 'voucher-upi-1':
      return renderVoucherArt(1, '#059669', '#0d9488', 'UPI TRANSFER');
    case 'voucher-play-10':
      return renderVoucherArt(10, '#0284c7', '#0f766e', 'PLAY REWARD');
    case 'voucher-gift-25':
      return renderVoucherArt(25, '#9333ea', '#db2777', 'GIFT VOUCHER');
    case 'voucher-play-50':
      return renderVoucherArt(50, '#2563eb', '#7c3aed', 'PLAY STORE');
    case 'voucher-mega-100':
      return renderVoucherArt(100, '#d97706', '#dc2626', 'MEGA VOUCHER');
    case 'booster-double-coins':
      return (
        <g>
          <rect width="240" height="135" fill="#171003" />
          <circle cx="120" cy="68" r="56" fill="#f59e0b" fillOpacity="0.22" />
          <circle cx="94" cy="68" r="28" fill="#f59e0b" stroke="#fef08a" strokeWidth="3.5" />
          <circle cx="146" cy="68" r="28" fill="#eab308" stroke="#fef08a" strokeWidth="3.5" />
          <polygon points="124,24 102,70 118,70 110,112 142,60 124,60" fill="#fef08a" stroke="#78350f" strokeWidth="2.5" />
          <text x="120" y="122" textAnchor="middle" fill="#fde047" fontSize="13" fontWeight="900">2X COINS (24H)</text>
        </g>
      );
    case 'booster-extra-life':
      return (
        <g>
          <rect width="240" height="135" fill="#061426" />
          <circle cx="120" cy="66" r="54" fill="#06b6d4" fillOpacity="0.2" />
          <path d="M120 20 L166 36 V68 C166 96 142 114 120 122 C98 114 74 96 74 68 V36 Z" fill="#0891b2" stroke="#a5f3fc" strokeWidth="3.5" />
          <path d="M120 42 V94 M96 68 H144" stroke="#fef08a" strokeWidth="10" strokeLinecap="round" />
        </g>
      );
    case 'badge-arcade-champion':
      return (
        <g>
          <rect width="240" height="135" fill="#191104" />
          <circle cx="120" cy="68" r="54" fill="#facc15" fillOpacity="0.2" />
          <polygon points="68,94 58,42 94,68 120,30 146,68 182,42 172,94" fill="#facc15" stroke="#fef9c3" strokeWidth="3" strokeLinejoin="round" />
          <rect x="66" y="96" width="108" height="14" rx="5" fill="#ca8a04" stroke="#fef08a" strokeWidth="2" />
        </g>
      );
    case 'avatar-neon-cyborg':
      return (
        <g>
          <rect width="240" height="135" fill="#0e0824" />
          <circle cx="120" cy="68" r="52" fill="#8b5cf6" fillOpacity="0.25" />
          <rect x="82" y="28" width="76" height="78" rx="20" fill="#1e1b4b" stroke="#22d3ee" strokeWidth="3.5" />
          <rect x="94" y="52" width="52" height="18" rx="9" fill="#06b6d4" />
          <circle cx="107" cy="61" r="4" fill="#fef08a" />
          <circle cx="133" cy="61" r="4" fill="#fef08a" />
          <path d="M102 86 H138" stroke="#a855f7" strokeWidth="4" strokeLinecap="round" />
        </g>
      );
    case 'theme-matrix-neon':
      return (
        <g>
          <rect width="240" height="135" fill="#031910" />
          <g stroke="#10b981" strokeOpacity="0.35" strokeWidth="1.5">
            <path d="M0 30 H240 M0 60 H240 M0 90 H240 M0 120 H240" />
            <path d="M40 0 V135 M80 0 V135 M120 0 V135 M160 0 V135 M200 0 V135" />
          </g>
          <rect x="52" y="24" width="136" height="86" rx="12" fill="#064e3b" stroke="#34d399" strokeWidth="3" />
          <circle cx="120" cy="67" r="22" fill="#10b981" stroke="#a7f3d0" strokeWidth="3" />
          <path d="M108 67 L117 76 L134 57" stroke="#022c22" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case 'badge-grandmaster':
    default:
      return (
        <g>
          <rect width="240" height="135" fill="#1b0724" />
          <circle cx="120" cy="68" r="56" fill="#ec4899" fillOpacity="0.22" />
          <polygon points="120,18 148,46 138,94 102,94 92,46" fill="#a855f7" stroke="#f5d0fe" strokeWidth="3" />
          <polygon points="120,34 134,54 128,82 112,82 106,54" fill="#facc15" />
          <path d="M90 106 H150" stroke="#f472b6" strokeWidth="6" strokeLinecap="round" />
        </g>
      );
  }
};

export const RewardThumbnail: React.FC<Props> = ({ item }) => {
  const isRupeeVoucher = item.category === 'VOUCHER' && item.rupeeValue;
  const isDiamondVoucher = item.id === 'voucher-ff-100';

  return (
    <div className="relative w-full aspect-[16/9] overflow-hidden bg-[#070a14] select-none">
      <svg
        viewBox="0 0 240 135"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full block transition-transform duration-300 group-hover:scale-105"
        aria-hidden="true"
      >
        {renderRewardArtwork(item)}
      </svg>

      {/* Bottom dark fade */}
      <div className="absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

      {/* Top corner tag */}
      <span
        className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shadow ${
          isRupeeVoucher || isDiamondVoucher
            ? 'bg-emerald-400 text-black'
            : 'bg-slate-900/90 text-slate-200 border border-white/15'
        }`}
      >
        {isDiamondVoucher
          ? '100 DIAMONDS'
          : item.id === 'voucher-upi-1'
          ? '₹1 UPI'
          : isRupeeVoucher
          ? `₹${item.rupeeValue} VOUCHER`
          : item.category}
      </span>
    </div>
  );
};
