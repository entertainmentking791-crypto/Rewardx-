import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../services/audio';
import { createStudioContext, makeCanvasTexture } from './threeUtils';
import { Dices, Play, RotateCcw, Users, Bot } from 'lucide-react';

interface Props {
  onGameOver: (score: number, coinsEarned: number) => void;
}

type PlayerIndex = 0 | 1 | 2 | 3; // 0: Red (Human), 1: Green (AI), 2: Yellow (AI), 3: Blue (AI)

const PLAYER_META: Record<PlayerIndex, { name: string; colorHex: number; cssColor: string; startIdx: number }> = {
  0: { name: 'You (Red)', colorHex: 0xef4444, cssColor: '#ef4444', startIdx: 0 },
  1: { name: 'Green Bot', colorHex: 0x22c55e, cssColor: '#22c55e', startIdx: 13 },
  2: { name: 'Yellow Bot', colorHex: 0xeab308, cssColor: '#eab308', startIdx: 26 },
  3: { name: 'Blue Bot', colorHex: 0x3b82f6, cssColor: '#3b82f6', startIdx: 39 },
};

// 52 outer track cells [col, row] on a 15x15 Ludo board (clockwise starting from Red exit at (1,6))
const OUTER_PATH: [number, number][] = [
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
  [7, 0], [8, 0],
  [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
  [14, 7], [14, 8],
  [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
  [7, 14], [6, 14],
  [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  [0, 7], [0, 6],
];

const HOME_PATHS: Record<PlayerIndex, [number, number][]> = {
  0: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  1: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  2: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
  3: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
};

// Yard base positions (Red=bottom-left in 3D? Let's keep top-left=Red? Wait: row 0..5 col 0..5 is top-left in 2D canvas, let's match 3D board!)
// In 3D board: col 0..14 -> x left(-5.04) to right(+5.04), row 0..14 -> z top(-5.04) to bottom(+5.04)
// Wait: Red start is (1,6) which is left-top edge of left arm -> Red Yard is Top-Left (cols 0..5, rows 0..5)
// Green start is (8,1) -> Green Yard is Top-Right (cols 9..14, rows 0..5)
// Yellow start is (13,8) -> Yellow Yard is Bottom-Right (cols 9..14, rows 9..14)
// Blue start is (6,13) -> Blue Yard is Bottom-Left (cols 0..5, rows 9..14)
const YARD_POSITIONS: Record<PlayerIndex, [number, number][]> = {
  0: [[1.6, 1.6], [3.4, 1.6], [1.6, 3.4], [3.4, 3.4]],
  1: [[10.6, 1.6], [12.4, 1.6], [10.6, 3.4], [12.4, 3.4]],
  2: [[10.6, 10.6], [12.4, 10.6], [10.6, 12.4], [12.4, 12.4]],
  3: [[1.6, 10.6], [3.4, 10.6], [1.6, 12.4], [3.4, 12.4]],
};

const SAFE_OUTER_INDICES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const CELL_SIZE = 0.68;

function gridToWorld(col: number, row: number): [number, number] {
  return [(col - 7) * CELL_SIZE, (row - 7) * CELL_SIZE];
}

function getTokenGridPos(player: PlayerIndex, tokenIdx: number, progress: number): [number, number] {
  if (progress < 0) return YARD_POSITIONS[player][tokenIdx];
  if (progress <= 50) {
    const outerIdx = (PLAYER_META[player].startIdx + progress) % 52;
    return OUTER_PATH[outerIdx];
  }
  const homeIdx = Math.min(progress - 51, 5);
  return HOME_PATHS[player][homeIdx];
}

function buildLudoPawn(colorHex: number): { group: THREE.Group; ring: THREE.Mesh } {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    metalness: 0.25,
    roughness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    metalness: 0.3,
    roughness: 0.3,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.12, 18), bodyMat);
  base.position.y = 0.06;
  base.castShadow = true;

  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 0.34, 16), bodyMat);
  stalk.position.y = 0.29;
  stalk.castShadow = true;

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.028, 8, 16), trimMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.44;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 18, 18), bodyMat);
  head.position.y = 0.56;
  head.castShadow = true;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.27, 0.34, 24),
    new THREE.MeshBasicMaterial({ color: 0xfef08a, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.visible = false;

  group.add(base, stalk, collar, head, ring);
  return { group, ring };
}

function createDieFaceTexture(renderer: THREE.WebGLRenderer, value: number): THREE.CanvasTexture {
  return makeCanvasTexture(renderer, 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    const pips: Record<number, [number, number][]> = {
      1: [[0.5, 0.5]],
      2: [[0.28, 0.28], [0.72, 0.72]],
      3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
      4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
      5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
      6: [[0.28, 0.25], [0.72, 0.25], [0.28, 0.5], [0.72, 0.5], [0.28, 0.75], [0.72, 0.75]],
    };
    ctx.fillStyle = value === 6 ? '#ef4444' : '#0f172a';
    for (const [px, py] of pips[value] || []) {
      ctx.beginPath();
      ctx.arc(px * w, py * h, value === 1 ? 15 : 11, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// Target Euler rotations so face `val` points UP (+Y)
// BoxGeometry materials order: 0:+X(3), 1:-X(4), 2:+Y(6), 3:-Y(1), 4:+Z(2), 5:-Z(5)
const DIE_UP_ROTATION: Record<number, [number, number, number]> = {
  6: [0, 0, 0],
  1: [Math.PI, 0, 0],
  2: [-Math.PI / 2, 0, 0],
  5: [Math.PI / 2, 0, 0],
  3: [0, 0, Math.PI / 2],
  4: [0, 0, -Math.PI / 2],
};

export const ThreeLudo: React.FC<Props> = ({ onGameOver }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState<'2p' | '4p'>('4p');
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<string>('');
  const [score, setScore] = useState(0);
  const [currentTurn, setCurrentTurn] = useState<PlayerIndex>(0);
  const [diceVal, setDiceVal] = useState<number | null>(null);
  const [statusText, setStatusText] = useState('Roll the 3D dice to begin!');
  const [phase, setPhase] = useState<'IDLE' | 'ROLLING' | 'SELECT_TOKEN' | 'ANIMATING' | 'BOT_THINK'>('IDLE');
  const [validTokens, setValidTokens] = useState<number[]>([]);
  const [homeCounts, setHomeCounts] = useState<Record<PlayerIndex, number>>({ 0: 0, 1: 0, 2: 0, 3: 0 });

  const stateRef = useRef<{
    activePlayers: PlayerIndex[];
    tokens: Record<PlayerIndex, number[]>;
    turnIdx: number;
    dice: number | null;
    phase: 'IDLE' | 'ROLLING' | 'SELECT_TOKEN' | 'ANIMATING' | 'BOT_THINK';
    score: number;
    started: boolean;
    gameOver: boolean;
    rollAnim: number;
    dieTargetRot: [number, number, number];
    moveAnim: {
      player: PlayerIndex;
      tokenIdx: number;
      fromX: number;
      fromZ: number;
      toX: number;
      toZ: number;
      t: number;
      onComplete: () => void;
    } | null;
    botTimer: number | null;
  }>({
    activePlayers: [0, 1, 2, 3],
    tokens: { 0: [-1, -1, -1, -1], 1: [-1, -1, -1, -1], 2: [-1, -1, -1, -1], 3: [-1, -1, -1, -1] },
    turnIdx: 0,
    dice: null,
    phase: 'IDLE',
    score: 0,
    started: false,
    gameOver: false,
    rollAnim: 0,
    dieTargetRot: [0, 0, 0],
    moveAnim: null,
    botTimer: null,
  });

  const pawnMeshesRef = useRef<Record<PlayerIndex, { group: THREE.Group; ring: THREE.Mesh }[]>>({
    0: [],
    1: [],
    2: [],
    3: [],
  });
  const dieGroupRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const syncVisualTokens = useCallback(() => {
    const s = stateRef.current;
    const counts: Record<PlayerIndex, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    ([0, 1, 2, 3] as PlayerIndex[]).forEach((p) => {
      const active = s.activePlayers.includes(p);
      const list = pawnMeshesRef.current[p];
      if (!list) return;

      // Group overlapping tokens on same cell slightly
      const occupiedMap = new Map<string, number>();
      s.tokens[p].forEach((prog) => {
        if (prog === 56) counts[p] += 1;
      });

      s.tokens[p].forEach((prog, idx) => {
        const entry = list[idx];
        if (!entry) return;
        entry.group.visible = active;
        if (!active) return;

        // Skip overriding currently animating token
        if (s.moveAnim && s.moveAnim.player === p && s.moveAnim.tokenIdx === idx) return;

        const [col, row] = getTokenGridPos(p, idx, prog);
        const key = `${col},${row}`;
        const slot = occupiedMap.get(key) || 0;
        occupiedMap.set(key, slot + 1);
        const offsetX = slot === 0 ? 0 : (slot % 2 === 1 ? 0.13 : -0.13);
        const offsetZ = slot < 2 ? 0 : 0.13;

        const [wx, wz] = gridToWorld(col, row);
        entry.group.position.set(wx + offsetX, 0.08, wz + offsetZ);
      });
    });
    setHomeCounts(counts);
  }, []);

  const updateHighlights = useCallback((tokensToHighlight: number[], activePlayer: PlayerIndex) => {
    ([0, 1, 2, 3] as PlayerIndex[]).forEach((p) => {
      pawnMeshesRef.current[p]?.forEach((entry, idx) => {
        entry.ring.visible = p === activePlayer && tokensToHighlight.includes(idx);
      });
    });
  }, []);

  const getValidMoves = (player: PlayerIndex, roll: number): number[] => {
    const arr = stateRef.current.tokens[player];
    const valid: number[] = [];
    for (let i = 0; i < 4; i++) {
      const prog = arr[i];
      if (prog === -1) {
        if (roll === 6) valid.push(i);
      } else if (prog + roll <= 56) {
        valid.push(i);
      }
    }
    return valid;
  };

  const endGame = useCallback((winningPlayer: PlayerIndex) => {
    const s = stateRef.current;
    if (s.gameOver) return;
    s.gameOver = true;
    if (s.botTimer) clearTimeout(s.botTimer);
    if (winningPlayer === 0) {
      s.score += 400;
      setScore(s.score);
      sound.playVictory();
    } else {
      sound.playGameOver();
    }
    setWinner(PLAYER_META[winningPlayer].name);
    setGameOver(true);
    const coins = Math.max(4, Math.floor(s.score / 35));
    onGameOverRef.current(s.score, coins);
  }, []);

  const advanceTurnRef = useRef<(bonusTurn: boolean) => void>(() => {});

  const executeTokenMove = useCallback((player: PlayerIndex, tokenIdx: number, roll: number) => {
    const s = stateRef.current;
    if (s.gameOver) return;
    s.phase = 'ANIMATING';
    setPhase('ANIMATING');
    updateHighlights([], player);

    const oldProg = s.tokens[player][tokenIdx];
    const newProg = oldProg === -1 ? 0 : oldProg + roll;
    const [fromCol, fromRow] = getTokenGridPos(player, tokenIdx, oldProg);
    const [toCol, toRow] = getTokenGridPos(player, tokenIdx, newProg);
    const [fromX, fromZ] = gridToWorld(fromCol, fromRow);
    const [toX, toZ] = gridToWorld(toCol, toRow);

    s.tokens[player][tokenIdx] = newProg;

    s.moveAnim = {
      player,
      tokenIdx,
      fromX,
      fromZ,
      toX,
      toZ,
      t: 0,
      onComplete: () => {
        sound.playMove();
        let captured = false;
        let reachedHome = newProg === 56;

        if (player === 0) {
          s.score += oldProg === -1 ? 25 : roll * 6;
        }

        // Check capture on outer track (0..50) if not a safe tile
        if (newProg >= 0 && newProg <= 50) {
          const targetOuter = (PLAYER_META[player].startIdx + newProg) % 52;
          if (!SAFE_OUTER_INDICES.has(targetOuter)) {
            for (const otherP of s.activePlayers) {
              if (otherP === player) continue;
              for (let k = 0; k < 4; k++) {
                const otherProg = s.tokens[otherP][k];
                if (otherProg >= 0 && otherProg <= 50) {
                  const otherOuter = (PLAYER_META[otherP].startIdx + otherProg) % 52;
                  if (otherOuter === targetOuter) {
                    s.tokens[otherP][k] = -1;
                    captured = true;
                  }
                }
              }
            }
          }
        }

        if (captured) {
          sound.playExplosion();
          if (player === 0) s.score += 120;
        }
        if (reachedHome) {
          sound.playCoin();
          if (player === 0) s.score += 220;
        }
        setScore(s.score);
        syncVisualTokens();

        // Check win
        if (s.tokens[player].every((p) => p === 56)) {
          endGame(player);
          return;
        }

        const bonusTurn = roll === 6 || captured || reachedHome;
        if (captured) {
          setStatusText(`${PLAYER_META[player].name} captured a pawn! Bonus roll!`);
        } else if (reachedHome) {
          setStatusText(`${PLAYER_META[player].name} reached HOME! Bonus roll!`);
        } else if (roll === 6) {
          setStatusText(`${PLAYER_META[player].name} rolled 6! Roll again!`);
        }

        advanceTurnRef.current(bonusTurn);
      },
    };
  }, [endGame, syncVisualTokens, updateHighlights]);

  const rollDiceForTurn = useCallback(() => {
    const s = stateRef.current;
    if (!s.started || s.gameOver || s.phase !== 'IDLE' && s.phase !== 'BOT_THINK') return;

    const activePlayer = s.activePlayers[s.turnIdx];
    const roll = 1 + Math.floor(Math.random() * 6);
    s.dice = roll;
    s.dieTargetRot = DIE_UP_ROTATION[roll];
    s.rollAnim = 0.55;
    s.phase = 'ROLLING';
    setPhase('ROLLING');
    setDiceVal(roll);
    sound.playPaddle();

    s.botTimer = window.setTimeout(() => {
      if (s.gameOver) return;
      const valid = getValidMoves(activePlayer, roll);
      if (valid.length === 0) {
        setStatusText(`${PLAYER_META[activePlayer].name} rolled ${roll} · No moves`);
        s.botTimer = window.setTimeout(() => advanceTurnRef.current(false), 650);
        return;
      }

      if (activePlayer === 0) {
        if (valid.length === 1) {
          setStatusText(`Rolled ${roll} · Auto-moving Token ${valid[0] + 1}`);
          executeTokenMove(0, valid[0], roll);
        } else {
          s.phase = 'SELECT_TOKEN';
          setPhase('SELECT_TOKEN');
          setValidTokens(valid);
          updateHighlights(valid, 0);
          setStatusText(`Rolled ${roll}! Tap a glowing Red pawn or Token button.`);
        }
      } else {
        // Smart Bot pick: prioritize capture -> home entry -> exit yard -> lead pawn
        let chosen = valid[0];
        let bestScore = -999;
        for (const idx of valid) {
          const prog = s.tokens[activePlayer][idx];
          const nextProg = prog === -1 ? 0 : prog + roll;
          let moveScore = nextProg;
          if (prog === -1) moveScore += 40;
          if (nextProg === 56) moveScore += 180;
          if (nextProg >= 0 && nextProg <= 50) {
            const targetOuter = (PLAYER_META[activePlayer].startIdx + nextProg) % 52;
            if (!SAFE_OUTER_INDICES.has(targetOuter)) {
              for (const otherP of s.activePlayers) {
                if (otherP === activePlayer) continue;
                if (s.tokens[otherP].some((op) => op >= 0 && op <= 50 && (PLAYER_META[otherP].startIdx + op) % 52 === targetOuter)) {
                  moveScore += 250;
                }
              }
            } else {
              moveScore += 25;
            }
          }
          if (moveScore > bestScore) {
            bestScore = moveScore;
            chosen = idx;
          }
        }
        setStatusText(`${PLAYER_META[activePlayer].name} rolled ${roll}`);
        executeTokenMove(activePlayer, chosen, roll);
      }
    }, 600);
  }, [executeTokenMove, updateHighlights]);

  advanceTurnRef.current = (bonusTurn: boolean) => {
    const s = stateRef.current;
    if (s.gameOver) return;
    if (!bonusTurn) {
      s.turnIdx = (s.turnIdx + 1) % s.activePlayers.length;
    }
    const nextPlayer = s.activePlayers[s.turnIdx];
    setCurrentTurn(nextPlayer);
    setValidTokens([]);

    if (nextPlayer === 0) {
      s.phase = 'IDLE';
      setPhase('IDLE');
      setStatusText(bonusTurn ? 'Your bonus roll! Tap ROLL DICE.' : 'Your turn! Tap ROLL DICE.');
    } else {
      s.phase = 'BOT_THINK';
      setPhase('BOT_THINK');
      setStatusText(`${PLAYER_META[nextPlayer].name} is rolling...`);
      s.botTimer = window.setTimeout(() => rollDiceForTurn(), 550);
    }
  };

  const handleSelectHumanToken = useCallback((tokenIdx: number) => {
    const s = stateRef.current;
    if (s.phase !== 'SELECT_TOKEN' || s.dice === null) return;
    if (!validTokens.includes(tokenIdx)) return;
    executeTokenMove(0, tokenIdx, s.dice);
  }, [executeTokenMove, validTokens]);

  const startGame = useCallback((selectedMode: '2p' | '4p' = mode) => {
    const s = stateRef.current;
    if (s.botTimer) clearTimeout(s.botTimer);
    s.activePlayers = selectedMode === '2p' ? [0, 2] : [0, 1, 2, 3];
    s.tokens = { 0: [-1, -1, -1, -1], 1: [-1, -1, -1, -1], 2: [-1, -1, -1, -1], 3: [-1, -1, -1, -1] };
    s.turnIdx = 0;
    s.dice = null;
    s.phase = 'IDLE';
    s.score = 0;
    s.started = true;
    s.gameOver = false;
    s.rollAnim = 0;
    s.moveAnim = null;

    setMode(selectedMode);
    setScore(0);
    setCurrentTurn(0);
    setDiceVal(null);
    setValidTokens([]);
    setGameOver(false);
    setWinner('');
    setPhase('IDLE');
    setStarted(true);
    setStatusText('Your turn! Tap ROLL DICE (need 6 to unlock a pawn).');
    updateHighlights([], 0);
    syncVisualTokens();
    sound.playClick();
  }, [mode, syncVisualTokens, updateHighlights]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, {
      fov: 44,
      bgColor: 0x070a14,
      fogNear: 24,
      fogFar: 60,
    });
    const { scene, camera, renderer } = studio;
    camera.position.set(0, 13.8, 9.2);
    camera.lookAt(0, 0, 0.3);
    cameraRef.current = camera;

    // 15x15 Ludo Board Texture
    const boardTex = makeCanvasTexture(renderer, 1024, 1024, (ctx, w) => {
      const c = w / 15;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, w, w);

      const paintYard = (gx: number, gy: number, color: string, light: string) => {
        ctx.fillStyle = color;
        ctx.fillRect(gx * c, gy * c, 6 * c, 6 * c);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect((gx + 1) * c, (gy + 1) * c, 4 * c, 4 * c);
        ctx.strokeStyle = light;
        ctx.lineWidth = 5;
        ctx.strokeRect((gx + 1) * c, (gy + 1) * c, 4 * c, 4 * c);
        const circles = [[1.8, 1.8], [4.2, 1.8], [1.8, 4.2], [4.2, 4.2]];
        for (const [cx, cy] of circles) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc((gx + cx) * c, (gy + cy) * c, c * 0.42, 0, Math.PI * 2);
          ctx.fill();
        }
      };

      paintYard(0, 0, '#ef4444', '#fca5a5'); // Red top-left
      paintYard(9, 0, '#22c55e', '#86efac'); // Green top-right
      paintYard(9, 9, '#eab308', '#fde047'); // Yellow bottom-right
      paintYard(0, 9, '#3b82f6', '#93c5fd'); // Blue bottom-left

      // Colored start + home stretch tiles
      const fillTile = (col: number, row: number, color: string) => {
        ctx.fillStyle = color;
        ctx.fillRect(col * c, row * c, c, c);
      };
      fillTile(1, 6, '#ef4444');
      for (let i = 1; i <= 5; i++) fillTile(i, 7, '#ef4444');

      fillTile(8, 1, '#22c55e');
      for (let i = 1; i <= 5; i++) fillTile(7, i, '#22c55e');

      fillTile(13, 8, '#eab308');
      for (let i = 9; i <= 13; i++) fillTile(i, 7, '#eab308');

      fillTile(6, 13, '#3b82f6');
      for (let i = 9; i <= 13; i++) fillTile(7, i, '#3b82f6');

      // Grid lines on track
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      for (let r = 0; r < 15; r++) {
        for (let col = 0; col < 15; col++) {
          const inCorner =
            (col < 6 && rowIsTop(r)) ||
            (col > 8 && rowIsTop(r)) ||
            (col < 6 && rowIsBot(r)) ||
            (col > 8 && rowIsBot(r));
          const inCenter = col >= 6 && col <= 8 && r >= 6 && r <= 8;
          if (!inCorner && !inCenter) {
            ctx.strokeRect(col * c, r * c, c, c);
          }
        }
      }
      function rowIsTop(r: number) { return r < 6; }
      function rowIsBot(r: number) { return r > 8; }

      // Safe stars
      const drawStar = (col: number, row: number, color = '#475569') => {
        const cx = (col + 0.5) * c;
        const cy = (row + 0.5) * c;
        ctx.fillStyle = color;
        ctx.font = `bold ${Math.floor(c * 0.6)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', cx, cy + 2);
      };
      drawStar(1, 6, '#ffffff');
      drawStar(8, 1, '#ffffff');
      drawStar(13, 8, '#ffffff');
      drawStar(6, 13, '#ffffff');
      drawStar(6, 2);
      drawStar(12, 6);
      drawStar(8, 12);
      drawStar(2, 8);

      // Center 3x3 home goal triangles
      const x0 = 6 * c, y0 = 6 * c, s3 = 3 * c, mid = 7.5 * c;
      const tri = (pts: [number, number][], color: string) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        ctx.lineTo(pts[1][0], pts[1][1]);
        ctx.lineTo(pts[2][0], pts[2][1]);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        ctx.stroke();
      };
      tri([[x0, y0], [x0, y0 + s3], [mid, mid]], '#ef4444');
      tri([[x0, y0], [x0 + s3, y0], [mid, mid]], '#22c55e');
      tri([[x0 + s3, y0], [x0 + s3, y0 + s3], [mid, mid]], '#eab308');
      tri([[x0, y0 + s3], [x0 + s3, y0 + s3], [mid, mid]], '#3b82f6');
    });

    const boardSize = 15 * CELL_SIZE;
    const baseFrame = new THREE.Mesh(
      new THREE.BoxGeometry(boardSize + 0.8, 0.36, boardSize + 0.8),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.45, roughness: 0.4 })
    );
    baseFrame.position.y = -0.18;
    baseFrame.receiveShadow = true;
    scene.add(baseFrame);

    const boardTop = new THREE.Mesh(
      new THREE.BoxGeometry(boardSize, 0.14, boardSize),
      new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.35, metalness: 0.08 })
    );
    boardTop.position.y = 0.01;
    boardTop.receiveShadow = true;
    scene.add(boardTop);

    // Build 16 pawns (4 per player)
    const raycastTargets: { mesh: THREE.Object3D; player: PlayerIndex; idx: number }[] = [];
    ([0, 1, 2, 3] as PlayerIndex[]).forEach((p) => {
      pawnMeshesRef.current[p] = [];
      for (let i = 0; i < 4; i++) {
        const pawn = buildLudoPawn(PLAYER_META[p].colorHex);
        scene.add(pawn.group);
        pawnMeshesRef.current[p].push(pawn);
        if (p === 0) {
          pawn.group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.userData = { player: p, tokenIdx: i };
              raycastTargets.push({ mesh: child, player: p, idx: i });
            }
          });
        }
      }
    });

    // 3D Dice at front edge of board
    const dieTex = [3, 4, 6, 1, 2, 5].map((v) => createDieFaceTexture(renderer, v));
    const dieMats = dieTex.map((tex) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25, metalness: 0.1 }));
    const dieGroup = new THREE.Group();
    const dieCube = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.92, 0.92), dieMats);
    dieCube.castShadow = true;
    dieGroup.add(dieCube);
    dieGroup.position.set(0, 0.54, boardSize / 2 + 1.05);
    scene.add(dieGroup);
    dieGroupRef.current = dieGroup;

    // Position pawns initially
    syncVisualTokens();

    const stopLoop = studio.start((delta, elapsed) => {
      const dt = Math.min(delta, 0.05);
      const s = stateRef.current;

      // Pulse highlight rings
      ([0] as PlayerIndex[]).forEach((p) => {
        pawnMeshesRef.current[p].forEach((entry, idx) => {
          if (entry.ring.visible) {
            const pulse = 1 + Math.sin(elapsed * 8) * 0.15;
            entry.ring.scale.set(pulse, pulse, 1);
            entry.group.position.y = 0.08 + Math.abs(Math.sin(elapsed * 6 + idx)) * 0.18;
          }
        });
      });

      // Dice roll animation
      if (s.rollAnim > 0) {
        s.rollAnim = Math.max(0, s.rollAnim - dt);
        dieCube.rotation.x += dt * 18;
        dieCube.rotation.y += dt * 22;
        dieGroup.position.y = 0.54 + Math.sin((1 - s.rollAnim / 0.55) * Math.PI) * 1.1;
      } else {
        const [tx, ty, tz] = s.dieTargetRot;
        dieCube.rotation.x = THREE.MathUtils.damp(dieCube.rotation.x, tx, 14, dt);
        dieCube.rotation.y = THREE.MathUtils.damp(dieCube.rotation.y, ty, 14, dt);
        dieCube.rotation.z = THREE.MathUtils.damp(dieCube.rotation.z, tz, 14, dt);
        dieGroup.position.y = THREE.MathUtils.damp(dieGroup.position.y, 0.54, 14, dt);
      }

      // Token arc hop animation
      if (s.moveAnim) {
        const anim = s.moveAnim;
        anim.t = Math.min(1, anim.t + dt * 3.4);
        const entry = pawnMeshesRef.current[anim.player][anim.tokenIdx];
        if (entry) {
          const x = THREE.MathUtils.lerp(anim.fromX, anim.toX, anim.t);
          const z = THREE.MathUtils.lerp(anim.fromZ, anim.toZ, anim.t);
          const y = 0.08 + Math.sin(anim.t * Math.PI) * 0.85;
          entry.group.position.set(x, y, z);
        }
        if (anim.t >= 1) {
          const done = anim.onComplete;
          s.moveAnim = null;
          done();
        }
      }
    });

    return () => {
      if (stateRef.current.botTimer) clearTimeout(stateRef.current.botTimer);
      stopLoop();
      boardTex.dispose();
      dieTex.forEach((t) => t.dispose());
      studio.cleanup();
    };
  }, [syncVisualTokens]);

  const handleViewportTap = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stateRef.current;
    if (!s.started || s.gameOver) return;
    if (s.phase === 'IDLE' && s.activePlayers[s.turnIdx] === 0) {
      // Check if user tapped die or anywhere while idle
      rollDiceForTurn();
      return;
    }
    if (s.phase !== 'SELECT_TOKEN' || !cameraRef.current || !mountRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, cameraRef.current);

    const candidateObjs: THREE.Object3D[] = [];
    for (const idx of validTokens) {
      const entry = pawnMeshesRef.current[0][idx];
      if (entry) candidateObjs.push(entry.group);
    }
    const hits = raycaster.intersectObjects(candidateObjs, true);
    if (hits.length > 0) {
      const tokenIdx = hits[0].object.userData?.tokenIdx;
      if (typeof tokenIdx === 'number') {
        handleSelectHumanToken(tokenIdx);
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-2.5 w-full max-w-md mx-auto">
      {/* Top Status & Scores */}
      <div className="flex items-center justify-between w-full px-3 py-2 bg-slate-900/90 border border-rose-500/30 rounded-xl text-xs font-mono tabular-nums">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: PLAYER_META[currentTurn].cssColor }}
          />
          <span className="font-bold text-white">{PLAYER_META[currentTurn].name}</span>
        </div>
        <div className="text-slate-300">
          Home: <span className="text-rose-400 font-bold">{homeCounts[0]}/4</span>
        </div>
        <span className="text-amber-400 font-bold">Pts: {score}</span>
      </div>

      {/* 3D Viewport */}
      <div
        className="relative w-full h-[350px] rounded-2xl overflow-hidden border-2 border-rose-500/40 bg-[#070a14] touch-none select-none"
        onPointerDown={handleViewportTap}
      >
        <div ref={mountRef} className="w-full h-full touch-none" />

        {started && !gameOver && (
          <div className="absolute top-2 left-2 right-2 pointer-events-none flex justify-between items-center">
            <div className="px-2.5 py-1 rounded-lg bg-black/75 border border-white/10 text-[11px] font-semibold text-slate-200 truncate max-w-[75%]">
              {statusText}
            </div>
            {diceVal !== null && (
              <div className="px-2.5 py-1 rounded-lg bg-amber-500 text-black font-black text-xs shadow">
                🎲 {diceVal}
              </div>
            )}
          </div>
        )}

        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black text-amber-400 mb-1">
                  {winner.includes('You') ? 'LUDO KING!' : `${winner} WON!`}
                </h3>
                <p className="text-slate-300 text-sm mb-3">
                  Score: <span className="text-white font-bold">{score}</span> · +{Math.max(4, Math.floor(score / 35))} Coins
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); startGame(mode); }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-rose-500 text-white font-extrabold rounded-xl active:scale-95"
                >
                  <RotateCcw size={18} /> Play Again
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black text-rose-400 mb-1">3D Ludo Arena</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[260px]">
                  Roll 6 to unlock pawns, capture opponents on unsafe tiles, and race all 4 tokens home!
                </p>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setMode('2p'); }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
                      mode === '2p' ? 'bg-rose-500 text-white border-rose-300' : 'bg-slate-800 text-slate-300 border-white/10'
                    }`}
                  >
                    <Users size={14} /> 1v1 Quick
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setMode('4p'); }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
                      mode === '4p' ? 'bg-rose-500 text-white border-rose-300' : 'bg-slate-800 text-slate-300 border-white/10'
                    }`}
                  >
                    <Bot size={14} /> 4-Player Arena
                  </button>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); startGame(mode); }}
                  className="flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-rose-500 to-amber-500 text-black font-extrabold rounded-xl shadow-lg shadow-rose-500/30 active:scale-95"
                >
                  <Play size={18} fill="currentColor" /> Start Ludo
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Controls: Roll Dice + Quick Token Pickers */}
      <div className="w-full space-y-2">
        <button
          type="button"
          disabled={!started || gameOver || phase !== 'IDLE'}
          onClick={rollDiceForTurn}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 disabled:opacity-40 text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20 active:scale-[0.98] transition-all"
        >
          <Dices size={20} />
          <span>
            {phase === 'IDLE'
              ? 'ROLL 3D DICE'
              : phase === 'SELECT_TOKEN'
              ? `CHOOSE PAWN (ROLLED ${diceVal})`
              : `${PLAYER_META[currentTurn].name.toUpperCase()}...`}
          </span>
        </button>

        {phase === 'SELECT_TOKEN' && (
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((idx) => {
              const isValid = validTokens.includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!isValid}
                  onClick={() => handleSelectHumanToken(idx)}
                  className={`h-11 rounded-xl font-extrabold text-xs border transition-all ${
                    isValid
                      ? 'bg-rose-500 text-white border-amber-300 shadow-md shadow-rose-500/30 animate-pulse active:scale-95'
                      : 'bg-slate-900 text-slate-600 border-white/5 opacity-50'
                  }`}
                >
                  Pawn {idx + 1}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
