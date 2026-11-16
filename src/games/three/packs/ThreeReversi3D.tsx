import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../../services/audio';
import { createStudioContext } from '../threeUtils';
import { Play, RotateCcw } from 'lucide-react';

interface Props {
  onGameOver: (score: number, coinsEarned: number) => void;
}

const SIZE = 6;
const CELL = 0.94;
type Disc = 0 | 1 | 2; // 1 Cyan (You), 2 Rose (Bot)

const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

function getFlips(board: Disc[][], r: number, c: number, player: 1 | 2): [number, number][] {
  if (board[r][c] !== 0) return [];
  const opp: Disc = player === 1 ? 2 : 1;
  const allFlips: [number, number][] = [];

  for (const [dr, dc] of DIRS) {
    const line: [number, number][] = [];
    let nr = r + dr;
    let nc = c + dc;
    while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === opp) {
      line.push([nr, nc]);
      nr += dr;
      nc += dc;
    }
    if (line.length > 0 && nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === player) {
      allFlips.push(...line);
    }
  }
  return allFlips;
}

function getAllValidMoves(board: Disc[][], player: 1 | 2): { r: number; c: number; flips: [number, number][] }[] {
  const moves: { r: number; c: number; flips: [number, number][] }[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const flips = getFlips(board, r, c, player);
      if (flips.length > 0) moves.push({ r, c, flips });
    }
  }
  return moves;
}

function rcToWorld(r: number, c: number): [number, number] {
  return [(c - (SIZE - 1) / 2) * CELL, (r - (SIZE - 1) / 2) * CELL];
}

function buildReversiDisc(): THREE.Group {
  const g = new THREE.Group();
  const topMat = new THREE.MeshPhysicalMaterial({ color: 0x06b6d4, roughness: 0.2, metalness: 0.35, clearcoat: 1 });
  const botMat = new THREE.MeshPhysicalMaterial({ color: 0xf43f5e, roughness: 0.2, metalness: 0.35, clearcoat: 1 });
  const topHalf = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.09, 22), topMat);
  topHalf.position.y = 0.045;
  topHalf.castShadow = true;
  const botHalf = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.09, 22), botMat);
  botHalf.position.y = -0.045;
  botHalf.castShadow = true;
  g.add(topHalf, botHalf);
  return g;
}

export const ThreeReversi3D: React.FC<Props> = ({ onGameOver }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [counts, setCounts] = useState({ p1: 2, p2: 2 });
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState('Tap a golden ring square to flip discs');

  const boardRef = useRef<Disc[][]>(Array.from({ length: SIZE }, () => Array(SIZE).fill(0)));
  const discMeshesRef = useRef<(THREE.Group | null)[][]>(Array.from({ length: SIZE }, () => Array(SIZE).fill(null)));
  const ringPoolRef = useRef<THREE.Mesh[]>([]);
  const tileMeshesRef = useRef<THREE.Mesh[]>([]);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const stateRef = useRef({
    started: false,
    gameOver: false,
    turn: 1 as 1 | 2,
    score: 0,
    timer: null as number | null,
  });
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const updateCountsAndRings = useCallback((showForP1: boolean) => {
    let p1 = 0;
    let p2 = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (boardRef.current[r][c] === 1) p1++;
        else if (boardRef.current[r][c] === 2) p2++;
      }
    }
    setCounts({ p1, p2 });

    ringPoolRef.current.forEach((m) => (m.visible = false));
    if (showForP1) {
      const valid = getAllValidMoves(boardRef.current, 1);
      valid.forEach((m, idx) => {
        const ring = ringPoolRef.current[idx];
        if (ring) {
          const [wx, wz] = rcToWorld(m.r, m.c);
          ring.position.set(wx, 0.08, wz);
          ring.visible = true;
        }
      });
    }
    return { p1, p2 };
  }, []);

  const finishMatch = useCallback((p1: number, p2: number) => {
    const s = stateRef.current;
    if (s.gameOver) return;
    s.gameOver = true;
    ringPoolRef.current.forEach((m) => (m.visible = false));
    const bonus = p1 > p2 ? 220 : p1 === p2 ? 80 : 20;
    s.score = p1 * 15 + bonus;
    setScore(s.score);
    setGameOver(true);
    if (p1 >= p2) sound.playVictory();
    else sound.playGameOver();
    onGameOverRef.current(s.score, Math.max(3, Math.floor(s.score / 28)));
  }, []);

  const placeDiscVisual = (r: number, c: number, owner: 1 | 2) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const disc = buildReversiDisc();
    const [wx, wz] = rcToWorld(r, c);
    disc.position.set(wx, 0.16, wz);
    disc.userData.targetRotX = owner === 1 ? 0 : Math.PI;
    disc.rotation.x = owner === 1 ? 0 : Math.PI;
    scene.add(disc);
    discMeshesRef.current[r][c] = disc;
  };

  const playMoveRef = useRef<(r: number, c: number, player: 1 | 2) => void>(() => {});

  playMoveRef.current = (r: number, c: number, player: 1 | 2) => {
    const s = stateRef.current;
    if (s.gameOver) return;
    const flips = getFlips(boardRef.current, r, c, player);
    if (flips.length === 0) return;

    boardRef.current[r][c] = player;
    placeDiscVisual(r, c, player);
    for (const [fr, fc] of flips) {
      boardRef.current[fr][fc] = player;
      const mesh = discMeshesRef.current[fr][fc];
      if (mesh) mesh.userData.targetRotX = player === 1 ? 0 : Math.PI;
    }

    if (player === 1) {
      s.score += 15 + flips.length * 10;
      setScore(s.score);
      sound.playCoin();
    } else {
      sound.playMove();
    }

    const { p1, p2 } = updateCountsAndRings(false);
    if (p1 + p2 >= SIZE * SIZE) {
      finishMatch(p1, p2);
      return;
    }

    const opp: 1 | 2 = player === 1 ? 2 : 1;
    const oppMoves = getAllValidMoves(boardRef.current, opp);
    const sameMoves = getAllValidMoves(boardRef.current, player);

    if (oppMoves.length === 0 && sameMoves.length === 0) {
      finishMatch(p1, p2);
      return;
    }

    const nextPlayer = oppMoves.length > 0 ? opp : player;
    s.turn = nextPlayer;

    if (nextPlayer === 2) {
      setStatus('Bot thinking...');
      s.timer = window.setTimeout(() => {
        const aiMoves = getAllValidMoves(boardRef.current, 2);
        if (aiMoves.length === 0) return;
        aiMoves.sort((a, b) => {
          const aCorner = (a.r === 0 || a.r === SIZE - 1) && (a.c === 0 || a.c === SIZE - 1) ? 20 : 0;
          const bCorner = (b.r === 0 || b.r === SIZE - 1) && (b.c === 0 || b.c === SIZE - 1) ? 20 : 0;
          return (b.flips.length + bCorner) - (a.flips.length + aCorner);
        });
        const pick = aiMoves[0];
        playMoveRef.current(pick.r, pick.c, 2);
      }, 480);
    } else {
      updateCountsAndRings(true);
      setStatus(oppMoves.length === 0 ? 'Bot had no move! Your turn again.' : 'Your turn! Tap a golden ring.');
    }
  };

  const resetBoard = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const m = discMeshesRef.current[r][c];
        if (m) scene.remove(m);
        discMeshesRef.current[r][c] = null;
        boardRef.current[r][c] = 0;
      }
    }
    const mid = SIZE / 2;
    boardRef.current[mid - 1][mid - 1] = 2;
    boardRef.current[mid][mid] = 2;
    boardRef.current[mid - 1][mid] = 1;
    boardRef.current[mid][mid - 1] = 1;
    placeDiscVisual(mid - 1, mid - 1, 2);
    placeDiscVisual(mid, mid, 2);
    placeDiscVisual(mid - 1, mid, 1);
    placeDiscVisual(mid, mid - 1, 1);
    updateCountsAndRings(true);
  }, [updateCountsAndRings]);

  const startGame = useCallback(() => {
    const s = stateRef.current;
    if (s.timer) clearTimeout(s.timer);
    s.started = true;
    s.gameOver = false;
    s.turn = 1;
    s.score = 0;
    resetBoard();
    setScore(0);
    setGameOver(false);
    setStarted(true);
    setStatus('Your turn! Tap a golden ring.');
    sound.playClick();
  }, [resetBoard]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, { fov: 45, bgColor: 0x051314, fogNear: 20, fogFar: 55 });
    const { scene, camera } = studio;
    camera.position.set(0, 6.8, 5.2);
    camera.lookAt(0, 0, 0.15);
    sceneRef.current = scene;
    cameraRef.current = camera;

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(SIZE * CELL + 0.5, 0.28, SIZE * CELL + 0.5),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.4 })
    );
    frame.position.y = -0.14;
    scene.add(frame);

    tileMeshesRef.current = [];
    const tileGeo = new THREE.BoxGeometry(CELL * 0.94, 0.08, CELL * 0.94);
    const matA = new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.45 });
    const matB = new THREE.MeshStandardMaterial({ color: 0x047857, roughness: 0.45 });
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const [wx, wz] = rcToWorld(r, c);
        const tile = new THREE.Mesh(tileGeo, (r + c) % 2 === 0 ? matA : matB);
        tile.position.set(wx, 0.01, wz);
        tile.userData = { r, c };
        tile.receiveShadow = true;
        scene.add(tile);
        tileMeshesRef.current.push(tile);
      }
    }

    ringPoolRef.current = [];
    const ringGeo = new THREE.RingGeometry(0.24, 0.34, 22);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide });
    for (let i = 0; i < 20; i++) {
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.visible = false;
      scene.add(ring);
      ringPoolRef.current.push(ring);
    }

    resetBoard();

    const stopLoop = studio.start((delta) => {
      const dt = Math.min(delta, 0.05);
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          const m = discMeshesRef.current[r][c];
          if (m) {
            m.rotation.x = THREE.MathUtils.damp(m.rotation.x, m.userData.targetRotX ?? 0, 12, dt);
          }
        }
      }
    });

    return () => {
      if (stateRef.current.timer) clearTimeout(stateRef.current.timer);
      stopLoop();
      studio.cleanup();
    };
  }, [resetBoard]);

  const handleTap = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stateRef.current;
    if (!s.started || s.gameOver || s.turn !== 1 || !cameraRef.current || !mountRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, cameraRef.current);
    const hits = raycaster.intersectObjects(tileMeshesRef.current, false);
    if (hits.length > 0) {
      const { r, c } = hits[0].object.userData as { r: number; c: number };
      if (getFlips(boardRef.current, r, c, 1).length > 0) {
        playMoveRef.current(r, c, 1);
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-2.5 w-full max-w-md mx-auto">
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-emerald-500/30 rounded-xl text-xs font-mono tabular-nums">
        <span className="text-cyan-400 font-bold">You: {counts.p1}</span>
        <span className="text-rose-400 font-bold">Bot: {counts.p2}</span>
        <span className="text-amber-400 font-bold">Pts: {score}</span>
      </div>
      <div className="relative w-full h-[360px] rounded-2xl overflow-hidden border-2 border-emerald-500/40 bg-[#051314] touch-none select-none" onPointerDown={handleTap}>
        <div ref={mountRef} className="w-full h-full touch-none" />
        {started && !gameOver && (
          <div className="absolute top-2 left-2 right-2 pointer-events-none">
            <span className="px-2.5 py-1 rounded-lg bg-black/75 border border-white/10 text-[11px] font-semibold text-slate-200">{status}</span>
          </div>
        )}
        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black text-emerald-400 mb-1">{counts.p1 > counts.p2 ? 'YOU FLIPPED THE BOARD!' : 'BOT WON!'}</h3>
                <p className="text-slate-300 text-sm mb-3">{counts.p1} vs {counts.p2} · +{Math.max(3, Math.floor(score / 28))} Coins</p>
                <button onClick={(e) => { e.stopPropagation(); startGame(); }} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 text-black font-extrabold rounded-xl active:scale-95">
                  <RotateCcw size={18} /> Rematch
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black text-emerald-400 mb-1">3D Reversi Othello</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[250px]">Trap Rose discs between your Cyan discs to flip entire lines in 3D!</p>
                <button onClick={(e) => { e.stopPropagation(); startGame(); }} className="flex items-center gap-2 px-7 py-3 bg-emerald-500 text-black font-extrabold rounded-xl shadow-lg active:scale-95">
                  <Play size={18} fill="currentColor" /> Start Reversi
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <p className="text-[11px] text-slate-400">Tap any highlighted golden ring square</p>
    </div>
  );
};
