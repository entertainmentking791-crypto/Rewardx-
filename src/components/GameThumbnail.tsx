import React from 'react';
import { GameDefinition } from '../types/game';

interface Props {
  game: GameDefinition;
  variant?: 'card' | 'hero';
  className?: string;
}

const CLICKBAIT_TAGS: Record<string, { label: string; bg: string; text: string }> = {
  '3d-ludo': { label: 'HOT 3D', bg: '#F43F5E', text: '#FFFFFF' },
  '3d-tic-tac-toe': { label: '1V1 3D', bg: '#22D3EE', text: '#02151A' },
  '3d-snakes-ladders': { label: '3D BOARD', bg: '#10B981', text: '#03150E' },
  '3d-connect-four': { label: '4 IN ROW', bg: '#3B82F6', text: '#FFFFFF' },
  '3d-memory-cards': { label: 'BRAIN 3D', bg: '#14B8A6', text: '#021714' },
  '3d-checkers': { label: 'KING 3D', bg: '#A855F7', text: '#FFFFFF' },
  '3d-car-drift': { label: '3D RACE', bg: '#06B6D4', text: '#02151A' },
  '3d-tunnel-rush': { label: '3D RUSH', bg: '#A855F7', text: '#FFFFFF' },
  '3d-cube-runner': { label: '3D RUN', bg: '#22D3EE', text: '#02151A' },
  '3d-space-dogfight': { label: '3D WAR', bg: '#6366F1', text: '#FFFFFF' },
  '3d-bowling': { label: '3D STRIKE', bg: '#FACC15', text: '#1A1100' },
  '3d-hoops': { label: '3D DUNK', bg: '#F97316', text: '#1A0800' },
  '3d-tower-stack': { label: '3D STACK', bg: '#10B981', text: '#03150E' },
  '3d-snake': { label: '3D COBRA', bg: '#34D399', text: '#03150E' },
  '3d-maze-ball': { label: '3D MAZE', bg: '#22C55E', text: '#03170A' },
  '3d-brick-smash': { label: '3D SMASH', bg: '#E879F9', text: '#1C0321' },
};

const isLightHex = (hex: string) => {
  const c = hex.replace('#', '');
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
};

const renderArtwork = (game: GameDefinition) => {
  const { id, color } = game;
  switch (id) {
    case '3d-ludo':
      return (
        <g>
          <rect width="240" height="180" fill="#130816" />
          <g transform="translate(46, 16)">
            <rect x="0" y="0" width="148" height="148" rx="14" fill="#f8fafc" stroke="#f43f5e" strokeWidth="4" />
            <rect x="6" y="6" width="54" height="54" rx="8" fill="#ef4444" />
            <rect x="88" y="6" width="54" height="54" rx="8" fill="#22c55e" />
            <rect x="6" y="88" width="54" height="54" rx="8" fill="#3b82f6" />
            <rect x="88" y="88" width="54" height="54" rx="8" fill="#eab308" />
            <polygon points="60,60 88,60 74,74" fill="#22c55e" />
            <polygon points="88,60 88,88 74,74" fill="#eab308" />
            <polygon points="60,88 88,88 74,74" fill="#3b82f6" />
            <polygon points="60,60 60,88 74,74" fill="#ef4444" />
            <circle cx="33" cy="33" r="10" fill="#ffffff" />
            <circle cx="115" cy="33" r="10" fill="#ffffff" />
            <circle cx="33" cy="115" r="10" fill="#ffffff" />
            <circle cx="115" cy="115" r="10" fill="#ffffff" />
          </g>
          <g transform="translate(184, 128) rotate(-12)">
            <rect x="-20" y="-20" width="40" height="40" rx="8" fill="#ffffff" stroke="#fbbf24" strokeWidth="3" />
            <circle cx="-9" cy="-9" r="3.5" fill="#ef4444" />
            <circle cx="9" cy="-9" r="3.5" fill="#ef4444" />
            <circle cx="-9" cy="0" r="3.5" fill="#ef4444" />
            <circle cx="9" cy="0" r="3.5" fill="#ef4444" />
            <circle cx="-9" cy="9" r="3.5" fill="#ef4444" />
            <circle cx="9" cy="9" r="3.5" fill="#ef4444" />
          </g>
          <text x="18" y="34" fill="#f43f5e" fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-tic-tac-toe':
      return (
        <g>
          <rect width="240" height="180" fill="#060e1f" />
          <polygon points="36,136 86,38 206,38 184,136" fill="#0f172a" stroke="#22d3ee" strokeWidth="3" />
          <g stroke="#38bdf8" strokeWidth="4" strokeOpacity="0.6">
            <line x1="76" y1="70" x2="198" y2="70" />
            <line x1="58" y1="104" x2="190" y2="104" />
            <line x1="118" y1="38" x2="90" y2="136" />
            <line x1="162" y1="38" x2="138" y2="136" />
          </g>
          <g stroke="#22d3ee" strokeWidth="6" strokeLinecap="round">
            <line x1="88" y1="46" x2="106" y2="62" />
            <line x1="106" y1="46" x2="88" y2="62" />
            <line x1="122" y1="78" x2="140" y2="96" />
            <line x1="140" y1="78" x2="122" y2="96" />
            <line x1="154" y1="112" x2="172" y2="128" />
            <line x1="172" y1="112" x2="154" y2="128" />
          </g>
          <circle cx="176" cy="54" r="10" fill="none" stroke="#f43f5e" strokeWidth="5" />
          <circle cx="72" cy="120" r="10" fill="none" stroke="#f43f5e" strokeWidth="5" />
          <line x1="84" y1="44" x2="174" y2="130" stroke="#fde047" strokeWidth="4" strokeLinecap="round" />
          <text x="18" y="34" fill="#22d3ee" fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-snakes-ladders':
      return (
        <g>
          <rect width="240" height="180" fill="#051712" />
          <g transform="translate(38, 22)">
            {[0, 1, 2].map((r) =>
              [0, 1, 2, 3].map((c) => (
                <rect
                  key={`${r}-${c}`}
                  x={c * 41}
                  y={r * 42}
                  width="38"
                  height="38"
                  rx="6"
                  fill={(r + c) % 2 === 0 ? '#065f46' : '#0f172a'}
                  stroke="#10b981"
                  strokeOpacity="0.45"
                  strokeWidth="2"
                />
              ))
            )}
            <g stroke="#fbbf24" strokeWidth="4" strokeLinecap="round">
              <line x1="28" y1="118" x2="72" y2="20" />
              <line x1="46" y1="124" x2="90" y2="26" />
              <line x1="34" y1="100" x2="52" y2="106" />
              <line x1="46" y1="74" x2="64" y2="80" />
              <line x1="58" y1="48" x2="76" y2="54" />
            </g>
            <path d="M136 22 C164 46, 98 68, 134 114" fill="none" stroke="#f43f5e" strokeWidth="10" strokeLinecap="round" />
            <circle cx="136" cy="22" r="8" fill="#fb7185" />
          </g>
          <text x="18" y="34" fill="#34d399" fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-connect-four':
      return (
        <g>
          <rect width="240" height="180" fill="#060c1f" />
          <rect x="44" y="26" width="152" height="126" rx="12" fill="#1d4ed8" stroke="#60a5fa" strokeWidth="3" />
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2, 3, 4].map((c) => {
              const isRed = (r === 3 && c < 4) || (r === 2 && c === 1);
              const isGold = (r === 2 && c === 2) || (r === 1 && c === 1) || (r === 3 && c === 4);
              const fill = isRed ? '#ef4444' : isGold ? '#facc15' : '#090e1c';
              return (
                <circle
                  key={`${r}-${c}`}
                  cx={66 + c * 27}
                  cy={48 + r * 26}
                  r="10"
                  fill={fill}
                  stroke="#93c5fd"
                  strokeOpacity="0.4"
                  strokeWidth="1.5"
                />
              );
            })
          )}
          <line x1="62" y1="126" x2="150" y2="126" stroke="#fde047" strokeWidth="4" strokeLinecap="round" />
          <text x="14" y="34" fill="#60a5fa" fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-memory-cards':
      return (
        <g>
          <rect width="240" height="180" fill="#041918" />
          <g transform="translate(74, 92) rotate(-10)">
            <rect x="-32" y="-44" width="64" height="88" rx="10" fill="#0f766e" stroke="#2dd4bf" strokeWidth="3" />
            <polygon points="0,-16 16,12 -16,12" fill="#facc15" />
          </g>
          <g transform="translate(166, 92) rotate(10)">
            <rect x="-32" y="-44" width="64" height="88" rx="10" fill="#0f766e" stroke="#2dd4bf" strokeWidth="3" />
            <polygon points="0,-16 16,12 -16,12" fill="#facc15" />
          </g>
          <circle cx="120" cy="64" r="14" fill="#2dd4bf" />
          <text x="120" y="69" textAnchor="middle" fill="#042f2e" fontSize="14" fontWeight="900">★</text>
          <text x="18" y="34" fill="#2dd4bf" fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-checkers':
      return (
        <g>
          <rect width="240" height="180" fill="#12091c" />
          <polygon points="28,136 68,42 172,42 212,136" fill="#1e1b4b" stroke="#a855f7" strokeWidth="3" />
          <ellipse cx="96" cy="108" rx="22" ry="11" fill="#06b6d4" stroke="#a5f3fc" strokeWidth="2.5" />
          <ellipse cx="144" cy="72" rx="20" ry="10" fill="#f43f5e" stroke="#fecdd3" strokeWidth="2.5" />
          <ellipse cx="144" cy="108" rx="22" ry="11" fill="#06b6d4" stroke="#facc15" strokeWidth="3.5" />
          <polygon points="134,102 140,94 144,100 148,94 154,102" fill="#facc15" />
          <text x="18" y="34" fill="#c084fc" fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-reversi':
    case '3d-gomoku':
      return (
        <g>
          <rect width="240" height="180" fill="#051613" />
          <polygon points="34,136 68,42 172,42 206,136" fill="#064e3b" stroke={color} strokeWidth="3" />
          <g stroke={color} strokeOpacity="0.4" strokeWidth="2">
            <line x1="56" y1="74" x2="184" y2="74" />
            <line x1="44" y1="106" x2="196" y2="106" />
            <line x1="96" y1="42" x2="82" y2="136" />
            <line x1="144" y1="42" x2="158" y2="136" />
          </g>
          <circle cx="102" cy="88" r="14" fill="#22d3ee" stroke="#cffafe" strokeWidth="2.5" />
          <circle cx="138" cy="88" r="14" fill={id === '3d-reversi' ? '#f43f5e' : '#22d3ee'} stroke="#fef2f2" strokeWidth="2.5" />
          <circle cx="102" cy="118" r="14" fill="#f43f5e" stroke="#fecdd3" strokeWidth="2.5" />
          <circle cx="138" cy="58" r="12" fill="#facc15" />
          <text x="18" y="34" fill={color} fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-minesweeper':
      return (
        <g>
          <rect width="240" height="180" fill="#180812" />
          {[0, 1, 2].map((r) =>
            [0, 1, 2, 3].map((c) => (
              <rect
                key={`${r}-${c}`}
                x={46 + c * 38}
                y={30 + r * 38}
                width="32"
                height="32"
                rx="6"
                fill={r === 1 && c === 2 ? '#ef4444' : r === 0 && c === 1 ? '#1e293b' : '#334155'}
                stroke={r === 1 && c === 2 ? '#fca5a5' : '#64748b'}
                strokeWidth="2"
              />
            ))
          )}
          <circle cx="138" cy="84" r="9" fill="#0f172a" />
          <polygon points="94,36 106,42 94,48" fill="#facc15" />
          <text x="62" y="90" textAnchor="middle" fill="#22d3ee" fontSize="16" fontWeight="900">1</text>
          <text x="176" y="52" textAnchor="middle" fill="#10b981" fontSize="16" fontWeight="900">2</text>
          <text x="18" y="34" fill="#f43f5e" fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-simon-says':
      return (
        <g>
          <rect width="240" height="180" fill="#0e061b" />
          <polygon points="120,24 180,84 120,84" fill="#ef4444" stroke="#fca5a5" strokeWidth="3" />
          <polygon points="120,24 60,84 120,84" fill="#22c55e" stroke="#86efac" strokeWidth="3" />
          <polygon points="120,148 180,88 120,88" fill="#3b82f6" stroke="#93c5fd" strokeWidth="3" />
          <polygon points="120,148 60,88 120,88" fill="#facc15" stroke="#fef08a" strokeWidth="3" />
          <circle cx="120" cy="86" r="18" fill="#0f172a" stroke="#a855f7" strokeWidth="3" />
          <text x="18" y="34" fill="#c084fc" fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-towers-hanoi':
      return (
        <g>
          <rect width="240" height="180" fill="#140c04" />
          <rect x="28" y="136" width="184" height="14" rx="5" fill="#475569" />
          {[62, 120, 178].map((px) => (
            <rect key={px} x={px - 4} y="44" width="8" height="92" rx="3" fill="#94a3b8" />
          ))}
          <rect x="34" y="120" width="56" height="14" rx="6" fill="#f43f5e" />
          <rect x="40" y="104" width="44" height="14" rx="6" fill="#f59e0b" />
          <rect x="98" y="120" width="44" height="14" rx="6" fill="#22d3ee" />
          <rect x="164" y="62" width="28" height="14" rx="6" fill="#10b981" />
          <text x="18" y="34" fill="#f59e0b" fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-sliding-puzzle':
    case '3d-sudoku-mini':
      return (
        <g>
          <rect width="240" height="180" fill="#06121b" />
          <rect x="52" y="24" width="136" height="136" rx="12" fill="#0f172a" stroke={color} strokeWidth="3" />
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((c) => {
              const num = r * 3 + c + 1;
              if (id === '3d-sliding-puzzle' && num === 9) return null;
              return (
                <g key={num} transform={`translate(${62 + c * 40}, ${34 + r * 40})`}>
                  <rect width="34" height="34" rx="6" fill={num % 2 === 0 ? '#1e293b' : '#0e7490'} stroke={color} strokeWidth="1.5" />
                  <text x="17" y="23" textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="900">
                    {id === '3d-sudoku-mini' ? ((num % 4) + 1) : num}
                  </text>
                </g>
              );
            })
          )}
          <text x="18" y="34" fill={color} fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-chess-knight':
      return (
        <g>
          <rect width="240" height="180" fill="#10081c" />
          <polygon points="34,142 66,46 174,46 206,142" fill="#1e1b4b" stroke="#a855f7" strokeWidth="3" />
          <rect x="92" y="88" width="26" height="18" rx="4" fill="#facc15" />
          <path d="M110 104 L110 66 Q114 48 134 52 L144 64 L126 70 L134 104 Z" fill="#e2e8f0" stroke="#38bdf8" strokeWidth="2.5" />
          <circle cx="128" cy="59" r="3" fill="#0f172a" />
          <text x="18" y="34" fill="#c084fc" fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-domino-match':
    case '3d-math-dice':
      return (
        <g>
          <rect width="240" height="180" fill="#061612" />
          {id === '3d-domino-match' ? (
            <g>
              <g transform="translate(88, 90) rotate(-14)">
                <rect x="-22" y="-44" width="44" height="88" rx="8" fill="#f8fafc" stroke="#3b82f6" strokeWidth="3" />
                <line x1="-18" y1="0" x2="18" y2="0" stroke="#334155" strokeWidth="3" />
                <circle cx="0" cy="-22" r="5" fill="#0f172a" />
                <circle cx="-10" cy="14" r="4" fill="#ef4444" />
                <circle cx="10" cy="30" r="4" fill="#ef4444" />
              </g>
              <g transform="translate(154, 96) rotate(16)">
                <rect x="-22" y="-44" width="44" height="88" rx="8" fill="#f8fafc" stroke="#38bdf8" strokeWidth="3" />
                <line x1="-18" y1="0" x2="18" y2="0" stroke="#334155" strokeWidth="3" />
                <circle cx="-10" cy="-28" r="4" fill="#0f172a" />
                <circle cx="10" cy="-14" r="4" fill="#0f172a" />
                <circle cx="0" cy="22" r="5" fill="#3b82f6" />
              </g>
            </g>
          ) : (
            <g>
              <g transform="translate(84, 90) rotate(-15)">
                <rect x="-28" y="-28" width="56" height="56" rx="12" fill="#f8fafc" stroke="#f43f5e" strokeWidth="3" />
                <circle cx="-12" cy="-12" r="4.5" fill="#f43f5e" />
                <circle cx="12" cy="-12" r="4.5" fill="#f43f5e" />
                <circle cx="0" cy="0" r="4.5" fill="#f43f5e" />
                <circle cx="-12" cy="12" r="4.5" fill="#f43f5e" />
                <circle cx="12" cy="12" r="4.5" fill="#f43f5e" />
              </g>
              <g transform="translate(156, 94) rotate(14)">
                <rect x="-28" y="-28" width="56" height="56" rx="12" fill="#f8fafc" stroke="#facc15" strokeWidth="3" />
                <circle cx="-12" cy="-12" r="4.5" fill="#0f172a" />
                <circle cx="12" cy="12" r="4.5" fill="#0f172a" />
                <circle cx="0" cy="0" r="4.5" fill="#0f172a" />
              </g>
            </g>
          )}
          <text x="18" y="34" fill={color} fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-car-drift':
    case '3d-kart-turbo':
    case '3d-monster-truck':
    case '3d-pod-racer':
      return (
        <g>
          <rect width="240" height="180" fill="#050816" />
          <polygon points="88,0 152,0 232,180 8,180" fill="#0f172a" />
          <line x1="88" y1="0" x2="8" y2="180" stroke={color} strokeWidth="4" />
          <line x1="152" y1="0" x2="232" y2="180" stroke={color} strokeWidth="4" />
          <polygon points="106,36 134,36 144,68 96,68" fill="#ef4444" />
          <g transform="translate(120, 126)">
            <polygon points="-38,24 38,24 28,-16 -28,-16" fill={color} stroke="#ffffff" strokeWidth="2" />
            <polygon points="-20,-12 20,-12 14,-28 -14,-28" fill="#020617" />
            <rect x="-24" y="18" width="16" height="6" rx="2" fill="#facc15" />
            <rect x="8" y="18" width="16" height="6" rx="2" fill="#facc15" />
          </g>
          <text x="36" y="42" fill={color} fontSize="22" fontWeight="900">3D</text>
        </g>
      );

    case '3d-moto-gp':
    case '3d-hoverboard':
    case '3d-ski-slalom':
      return (
        <g>
          <rect width="240" height="180" fill="#071022" />
          <polygon points="90,0 150,0 228,180 12,180" fill="#111827" />
          <line x1="90" y1="0" x2="12" y2="180" stroke={color} strokeWidth="4" />
          <line x1="150" y1="0" x2="228" y2="180" stroke={color} strokeWidth="4" />
          <g transform="translate(120, 118) rotate(-8)">
            <ellipse cx="0" cy="28" rx="40" ry="8" fill={color} fillOpacity="0.25" />
            <polygon points="-12,24 12,24 18,-26 -18,-26" fill={color} stroke="#e2e8f0" strokeWidth="2.5" />
            <circle cx="0" cy="-34" r="11" fill="#f8fafc" />
          </g>
          <circle cx="174" cy="64" r="11" fill="#facc15" />
          <text x="24" y="38" fill={color} fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-boat-rush':
      return (
        <g>
          <rect width="240" height="180" fill="#031526" />
          <polygon points="84,0 156,0 236,180 4,180" fill="#0c4a6e" />
          <line x1="84" y1="0" x2="4" y2="180" stroke="#38bdf8" strokeWidth="3" />
          <line x1="156" y1="0" x2="236" y2="180" stroke="#38bdf8" strokeWidth="3" />
          <polygon points="120,76 154,148 120,136 86,148" fill="#f8fafc" stroke="#38bdf8" strokeWidth="3" />
          <circle cx="80" cy="54" r="11" fill="#ef4444" stroke="#fca5a5" strokeWidth="2" />
          <text x="22" y="38" fill="#38bdf8" fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-jet-canyon':
    case '3d-heli-rescue':
      return (
        <g>
          <rect width="240" height="180" fill="#0e0914" />
          <polygon points="0,180 68,18 96,180" fill="#1e293b" />
          <polygon points="240,180 172,18 144,180" fill="#1e293b" />
          <polygon points="120,66 176,138 120,122 64,138" fill={color} stroke="#ffffff" strokeWidth="2.5" />
          {id === '3d-heli-rescue' && (
            <line x1="60" y1="68" x2="180" y2="68" stroke="#facc15" strokeWidth="5" strokeLinecap="round" />
          )}
          <text x="20" y="38" fill={color} fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-subway-dash':
    case '3d-cube-runner':
      return (
        <g>
          <rect width="240" height="180" fill="#071020" />
          <polygon points="94,10 146,10 220,180 20,180" fill="#0f172a" stroke={color} strokeWidth="3" />
          <rect x="136" y="54" width="44" height="36" rx="6" fill="#ef4444" stroke="#fca5a5" strokeWidth="2" />
          <g transform="translate(86, 100)">
            <rect x="-18" y="-18" width="36" height="36" rx="7" fill={color} stroke="#ffffff" strokeWidth="2.5" />
            <rect x="-10" y="-10" width="20" height="8" rx="3" fill="#fde047" />
          </g>
          <text x="24" y="38" fill={color} fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-tunnel-rush':
      return (
        <g>
          <rect width="240" height="180" fill="#060414" />
          {[78, 56, 38, 22].map((r, i) => (
            <polygon
              key={i}
              points={`120,${90 - r} ${120 + r},${90 - r * 0.4} ${120 + r},${90 + r * 0.4} 120,${90 + r} ${120 - r},${90 + r * 0.4} ${120 - r},${90 - r * 0.4}`}
              fill="none"
              stroke={i % 2 === 0 ? '#a855f7' : '#22d3ee'}
              strokeWidth="4"
            />
          ))}
          <polygon points="120,90 198,136 150,168" fill="#f43f5e" fillOpacity="0.82" />
          <polygon points="120,126 106,154 134,154" fill="#22d3ee" stroke="#cffafe" strokeWidth="2" />
          <text x="24" y="38" fill="#a855f7" fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-space-dogfight':
    case '3d-asteroid-blast':
    case '3d-alien-invasion':
      return (
        <g>
          <rect width="240" height="180" fill="#030512" />
          <line x1="88" y1="120" x2="112" y2="52" stroke="#22d3ee" strokeWidth="4" />
          <line x1="152" y1="120" x2="128" y2="52" stroke="#22d3ee" strokeWidth="4" />
          {id === '3d-asteroid-blast' ? (
            <polygon points="120,22 146,38 138,62 104,64 96,38" fill="#a855f7" stroke="#e9d5ff" strokeWidth="2.5" />
          ) : (
            <polygon points="120,26 156,56 120,48 84,56" fill="#f43f5e" stroke="#fda4af" strokeWidth="2" />
          )}
          <polygon points="120,104 176,154 120,138 64,154" fill={color} stroke="#e0e7ff" strokeWidth="2.5" />
          <text x="24" y="38" fill={color} fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-bowling':
      return (
        <g>
          <rect width="240" height="180" fill="#090b16" />
          <polygon points="84,12 156,12 206,180 34,180" fill="#92400e" stroke="#22d3ee" strokeWidth="3" />
          {[104, 120, 136].map((px, i) => (
            <g key={i} transform={`translate(${px}, 44)`}>
              <ellipse cx="0" cy="0" rx="7" ry="16" fill="#f8fafc" />
              <rect x="-5" y="-6" width="10" height="4" fill="#ef4444" />
            </g>
          ))}
          <circle cx="120" cy="128" r="24" fill="#0ea5e9" stroke="#7dd3fc" strokeWidth="3" />
          <text x="22" y="38" fill="#facc15" fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-hoops':
      return (
        <g>
          <rect width="240" height="180" fill="#0a0918" />
          <polygon points="20,130 220,130 240,180 0,180" fill="#1e293b" />
          <rect x="74" y="20" width="92" height="58" rx="6" fill="#0f172a" stroke="#38bdf8" strokeWidth="3" />
          <ellipse cx="120" cy="76" rx="26" ry="8" fill="none" stroke="#f97316" strokeWidth="5" />
          <circle cx="120" cy="116" r="22" fill="#f97316" stroke="#fed7aa" strokeWidth="3" />
          <text x="20" y="38" fill="#f97316" fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-penalty-kick':
      return (
        <g>
          <rect width="240" height="180" fill="#04190e" />
          <rect x="38" y="30" width="164" height="72" fill="none" stroke="#f8fafc" strokeWidth="6" />
          <rect x="98" y="54" width="24" height="44" rx="6" fill="#f97316" />
          <circle cx="120" cy="134" r="20" fill="#f8fafc" stroke="#22c55e" strokeWidth="3" />
          <polygon points="120,122 129,129 125,140 115,140 111,129" fill="#0f172a" />
          <text x="20" y="38" fill="#22c55e" fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-mini-golf':
      return (
        <g>
          <rect width="240" height="180" fill="#031a12" />
          <polygon points="62,24 178,24 214,166 26,166" fill="#059669" stroke="#34d399" strokeWidth="3" />
          <ellipse cx="120" cy="54" rx="16" ry="7" fill="#020617" stroke="#facc15" strokeWidth="2.5" />
          <line x1="120" y1="54" x2="120" y2="16" stroke="#f8fafc" strokeWidth="3" />
          <polygon points="120,16 146,24 120,32" fill="#ef4444" />
          <circle cx="120" cy="132" r="14" fill="#f8fafc" />
          <text x="20" y="38" fill="#34d399" fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-archery-pro':
    case '3d-darts-3d':
    case '3d-skee-ball':
      return (
        <g>
          <rect width="240" height="180" fill="#140710" />
          <circle cx="120" cy="88" r="56" fill="#f8fafc" stroke={color} strokeWidth="4" />
          <circle cx="120" cy="88" r="40" fill="#3b82f6" />
          <circle cx="120" cy="88" r="24" fill="#ef4444" />
          <circle cx="120" cy="88" r="10" fill="#facc15" />
          <line x1="168" y1="142" x2="122" y2="90" stroke="#22d3ee" strokeWidth="4" strokeLinecap="round" />
          <text x="20" y="38" fill={color} fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-pool-shot':
      return (
        <g>
          <rect width="240" height="180" fill="#04191e" />
          <rect x="28" y="24" width="184" height="132" rx="12" fill="#047857" stroke="#78350f" strokeWidth="10" />
          <circle cx="42" cy="38" r="10" fill="#020617" />
          <circle cx="198" cy="38" r="10" fill="#020617" />
          <circle cx="144" cy="76" r="14" fill="#f43f5e" />
          <circle cx="96" cy="118" r="14" fill="#f8fafc" />
          <line x1="60" y1="154" x2="88" y2="126" stroke="#fde047" strokeWidth="5" strokeLinecap="round" />
          <text x="20" y="38" fill="#22d3ee" fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-table-tennis':
    case '3d-air-hockey':
      return (
        <g>
          <rect width="240" height="180" fill="#050d1d" />
          <polygon points="56,28 184,28 214,158 26,158" fill="#1e3a8a" stroke={color} strokeWidth="3" />
          <line x1="42" y1="90" x2="198" y2="90" stroke="#f8fafc" strokeWidth="3" strokeDasharray="6 4" />
          <rect x="86" y="136" width="68" height="12" rx="6" fill={color} />
          <rect x="94" y="36" width="52" height="10" rx="5" fill="#f43f5e" />
          <circle cx="120" cy="86" r="10" fill="#facc15" />
          <text x="20" y="38" fill={color} fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-baseball-hr':
    case '3d-cricket-six':
      return (
        <g>
          <rect width="240" height="180" fill="#06160a" />
          <polygon points="20,130 220,130 240,180 0,180" fill="#14532d" />
          <g transform="translate(86, 108) rotate(-32)">
            <rect x="-8" y="-52" width="16" height="84" rx="7" fill="#d97706" stroke="#fde68a" strokeWidth="2.5" />
          </g>
          <circle cx="146" cy="78" r="18" fill={id === '3d-cricket-six' ? '#dc2626' : '#f8fafc'} stroke={color} strokeWidth="3" />
          <text x="20" y="38" fill={color} fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-tank-battle':
    case '3d-turret-defense':
    case '3d-boss-raid':
    case '3d-zombie-holdout':
      return (
        <g>
          <rect width="240" height="180" fill="#0c0814" />
          <polygon points="32,168 92,16 148,16 208,168" fill="#111827" stroke={color} strokeOpacity="0.4" strokeWidth="2" />
          <line x1="120" y1="112" x2="120" y2="52" stroke="#fde047" strokeWidth="5" />
          <polygon points="120,24 146,50 120,76 94,50" fill="#ef4444" stroke="#fca5a5" strokeWidth="2.5" />
          <rect x="88" y="118" width="64" height="32" rx="8" fill={color} stroke="#ffffff" strokeWidth="2" />
          <rect x="114" y="96" width="12" height="28" rx="4" fill="#cbd5e1" />
          <text x="20" y="38" fill={color} fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-sniper-range':
    case '3d-ninja-slice':
    case '3d-hammer-whack':
    case '3d-piano-tiles':
      return (
        <g>
          <rect width="240" height="180" fill="#0d0718" />
          {id === '3d-piano-tiles' ? (
            <g>
              {[0, 1, 2, 3].map((lane) => (
                <line key={lane} x1={48 + lane * 44} y1="18" x2={48 + lane * 44} y2="162" stroke="#334155" strokeWidth="2" />
              ))}
              <rect x="52" y="36" width="36" height="44" rx="6" fill="#22d3ee" />
              <rect x="140" y="74" width="36" height="44" rx="6" fill="#a855f7" />
              <rect x="96" y="114" width="36" height="44" rx="6" fill="#f43f5e" />
            </g>
          ) : (
            <g>
              <circle cx="84" cy="76" r="24" fill={color} stroke="#ffffff" strokeWidth="3" />
              <circle cx="156" cy="108" r="20" fill="#facc15" stroke="#fef08a" strokeWidth="3" />
              <line x1="60" y1="138" x2="180" y2="42" stroke="#22d3ee" strokeWidth="5" strokeLinecap="round" />
            </g>
          )}
          <text x="20" y="38" fill={color} fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-tower-stack':
      return (
        <g>
          <rect width="240" height="180" fill="#050e17" />
          <polygon points="120,104 184,132 120,160 56,132" fill="#059669" stroke="#6ee7b7" strokeWidth="2" />
          <polygon points="120,76 176,102 120,128 64,102" fill="#10b981" stroke="#a7f3d0" strokeWidth="2" />
          <polygon points="120,48 168,72 120,96 72,72" fill="#34d399" stroke="#d1fae5" strokeWidth="2" />
          <polygon points="140,22 184,42 140,62 96,42" fill="#facc15" stroke="#fef08a" strokeWidth="2" />
          <text x="20" y="38" fill="#34d399" fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-snake':
      return (
        <g>
          <rect width="240" height="180" fill="#04120e" />
          <polygon points="36,112 120,66 204,112 120,158" fill="#064e3b" stroke="#10b981" strokeWidth="3" />
          <rect x="78" y="96" width="24" height="20" rx="4" fill="#10b981" />
          <rect x="104" y="88" width="24" height="20" rx="4" fill="#34d399" />
          <polygon points="164,84 176,98 164,112 152,98" fill="#facc15" stroke="#fef08a" strokeWidth="2" />
          <text x="20" y="38" fill="#34d399" fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-maze-ball':
      return (
        <g>
          <rect width="240" height="180" fill="#090814" />
          <polygon points="32,102 124,52 212,102 120,152" fill="#1e293b" stroke="#22c55e" strokeWidth="3" />
          <ellipse cx="154" cy="96" rx="16" ry="9" fill="#10b981" />
          <ellipse cx="92" cy="116" rx="14" ry="8" fill="#f43f5e" />
          <circle cx="116" cy="90" r="16" fill="#e2e8f0" stroke="#ffffff" strokeWidth="2.5" />
          <text x="20" y="38" fill="#22c55e" fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-helix-drop':
    case '3d-color-tunnel':
    case '3d-flappy-drone':
    case '3d-jump-pads':
    case '3d-stack-roll':
      return (
        <g>
          <rect width="240" height="180" fill="#090819" />
          <ellipse cx="120" cy="128" rx="68" ry="18" fill="none" stroke={color} strokeWidth="7" />
          <ellipse cx="120" cy="88" rx="54" ry="15" fill="none" stroke="#22d3ee" strokeWidth="6" />
          <ellipse cx="120" cy="52" rx="40" ry="12" fill="none" stroke="#facc15" strokeWidth="5" />
          <circle cx="120" cy="68" r="14" fill="#f8fafc" stroke={color} strokeWidth="3" />
          <text x="20" y="38" fill={color} fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-coin-magnet':
    case '3d-orb-catcher':
    case '3d-meteor-dodge':
    case '3d-cube-2048':
    case '3d-bubble-pop':
      return (
        <g>
          <rect width="240" height="180" fill="#100818" />
          <circle cx="78" cy="56" r="16" fill="#facc15" stroke="#fef08a" strokeWidth="3" />
          <circle cx="158" cy="48" r="14" fill={color} stroke="#ffffff" strokeWidth="2.5" />
          <circle cx="122" cy="92" r="18" fill="#22d3ee" stroke="#cffafe" strokeWidth="3" />
          <rect x="68" y="136" width="104" height="16" rx="8" fill={color} stroke="#ffffff" strokeWidth="2" />
          <text x="20" y="38" fill={color} fontSize="20" fontWeight="900">3D</text>
        </g>
      );

    case '3d-brick-smash':
    default:
      return (
        <g>
          <rect width="240" height="180" fill="#0b0518" />
          <polygon points="56,22 184,22 222,168 18,168" fill="#111827" stroke="#a855f7" strokeWidth="3" />
          <rect x="64" y="36" width="32" height="14" rx="3" fill="#f43f5e" />
          <rect x="104" y="36" width="32" height="14" rx="3" fill="#a855f7" />
          <rect x="144" y="36" width="32" height="14" rx="3" fill="#3b82f6" />
          <circle cx="120" cy="98" r="11" fill="#fde047" />
          <rect x="76" y="140" width="88" height="14" rx="6" fill="#22d3ee" />
          <text x="20" y="38" fill="#e879f9" fontSize="20" fontWeight="900">3D</text>
        </g>
      );
  }
};

export const GameThumbnail: React.FC<Props> = ({ game, variant = 'card', className = '' }) => {
  const tag = CLICKBAIT_TAGS[game.id] ?? {
    label: (game.badgeText || '3D PLAY').toUpperCase(),
    bg: game.color,
    text: isLightHex(game.color) ? '#09090b' : '#ffffff',
  };

  return (
    <div
      className={`relative overflow-hidden select-none bg-[#0a0d18] ${
        variant === 'hero' ? 'w-full h-full' : 'w-full aspect-[4/3]'
      } ${className}`}
    >
      <svg
        viewBox="0 0 240 180"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full block transition-transform duration-300 group-hover:scale-105"
        aria-hidden="true"
      >
        {renderArtwork(game)}
        <rect
          width="240"
          height="180"
          fill="none"
          stroke={game.color}
          strokeOpacity="0.28"
          strokeWidth="4"
        />
      </svg>

      {/* Bottom vignette for depth */}
      <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/65 to-transparent pointer-events-none" />

      {/* Crisp arcade corner stamp */}
      {variant === 'card' && (
        <span
          className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-black tracking-wider uppercase shadow-md leading-none"
          style={{ backgroundColor: tag.bg, color: tag.text }}
        >
          {tag.label}
        </span>
      )}
    </div>
  );
};
