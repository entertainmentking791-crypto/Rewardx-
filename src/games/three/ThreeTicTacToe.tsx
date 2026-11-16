import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../services/audio';
import { createStudioContext } from './threeUtils';
import { Bot, Users, Play, RotateCcw } from 'lucide-react';

interface Props {
  onGameOver: (score: number, coinsEarned: number) => void;
}

type CellVal = null | 'X' | 'O';

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function checkWinner(board: CellVal[]): { winner: CellVal | 'DRAW'; line: number[] | null } {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  if (board.every((c) => c !== null)) return { winner: 'DRAW', line: null };
  return { winner: null, line: null };
}

function bestAiMove(board: CellVal[]): number {
  const empty = board.map((v, i) => (v === null ? i : -1)).filter((i) => i !== -1);
  if (empty.length === 0) return -1;

  // 1. Win immediately if O can win
  for (const idx of empty) {
    const copy = [...board];
    copy[idx] = 'O';
    if (checkWinner(copy).winner === 'O') return idx;
  }
  // 2. Block X from winning
  for (const idx of empty) {
    const copy = [...board];
    copy[idx] = 'X';
    if (checkWinner(copy).winner === 'X') return idx;
  }
  // 3. 75% smart play (center/corners), 25% fun opening variety
  if (Math.random() < 0.78) {
    if (board[4] === null) return 4;
    const corners = [0, 2, 6, 8].filter((c) => board[c] === null);
    if (corners.length > 0) return corners[Math.floor(Math.random() * corners.length)];
  }
  return empty[Math.floor(Math.random() * empty.length)];
}

function build3DX(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x22d3ee,
    emissive: 0x0891b2,
    emissiveIntensity: 0.75,
    metalness: 0.4,
    roughness: 0.2,
    clearcoat: 1,
  });
  const barGeo = new THREE.BoxGeometry(1.05, 0.22, 0.22);
  const b1 = new THREE.Mesh(barGeo, mat);
  b1.rotation.y = Math.PI / 4;
  b1.castShadow = true;
  const b2 = new THREE.Mesh(barGeo, mat);
  b2.rotation.y = -Math.PI / 4;
  b2.castShadow = true;
  g.add(b1, b2);
  return g;
}

function build3DO(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xf43f5e,
    emissive: 0xbe123c,
    emissiveIntensity: 0.75,
    metalness: 0.4,
    roughness: 0.2,
    clearcoat: 1,
  });
  const torus = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.11, 14, 28), mat);
  torus.rotation.x = Math.PI / 2;
  torus.castShadow = true;
  g.add(torus);
  return g;
}

const CELL_SPACING = 1.55;
function cellCoords(idx: number): [number, number] {
  const r = Math.floor(idx / 3);
  const c = idx % 3;
  return [(c - 1) * CELL_SPACING, (r - 1) * CELL_SPACING];
}

export const ThreeTicTacToe: React.FC<Props> = ({ onGameOver }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [vsAI, setVsAI] = useState(true);
  const [round, setRound] = useState(1);
  const [xWins, setXWins] = useState(0);
  const [oWins, setOWins] = useState(0);
  const [score, setScore] = useState(0);
  const [turn, setTurn] = useState<'X' | 'O'>('X');
  const [status, setStatus] = useState('Tap any 3D square to place X');
  const [gameOver, setGameOver] = useState(false);

  const boardRef = useRef<CellVal[]>(Array(9).fill(null));
  const pieceMeshesRef = useRef<(THREE.Group | null)[]>(Array(9).fill(null));
  const padMeshesRef = useRef<THREE.Mesh[]>([]);
  const winLaserRef = useRef<THREE.Mesh | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const gameStateRef = useRef({
    started: false,
    gameOver: false,
    roundLocked: false,
    vsAI: true,
    turn: 'X' as 'X' | 'O',
    round: 1,
    xWins: 0,
    oWins: 0,
    score: 0,
    aiTimer: null as number | null,
  });
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const clearBoard3D = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    pieceMeshesRef.current.forEach((m, i) => {
      if (m) {
        scene.remove(m);
        pieceMeshesRef.current[i] = null;
      }
    });
    if (winLaserRef.current) {
      winLaserRef.current.visible = false;
    }
    boardRef.current = Array(9).fill(null);
  }, []);

  const showWinLaser = useCallback((line: number[]) => {
    const laser = winLaserRef.current;
    if (!laser) return;
    const [x1, z1] = cellCoords(line[0]);
    const [x2, z2] = cellCoords(line[2]);
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz) + 0.9;
    laser.scale.set(1, len, 1);
    laser.position.set((x1 + x2) / 2, 0.35, (z1 + z2) / 2);
    laser.rotation.set(Math.PI / 2, 0, -Math.atan2(dx, dz));
    laser.visible = true;
  }, []);

  const finishMatch = useCallback(() => {
    const gs = gameStateRef.current;
    gs.gameOver = true;
    setGameOver(true);
    const coins = Math.max(3, Math.floor(gs.score / 25));
    if (gs.xWins >= gs.oWins) sound.playVictory();
    else sound.playGameOver();
    onGameOverRef.current(gs.score, coins);
  }, []);

  const placeMark = useCallback((idx: number, mark: 'X' | 'O') => {
    const gs = gameStateRef.current;
    const scene = sceneRef.current;
    if (!scene || boardRef.current[idx] !== null || gs.roundLocked || gs.gameOver) return;

    boardRef.current[idx] = mark;
    const [wx, wz] = cellCoords(idx);
    const mesh = mark === 'X' ? build3DX() : build3DO();
    mesh.position.set(wx, 2.6, wz);
    mesh.userData.targetY = 0.32;
    scene.add(mesh);
    pieceMeshesRef.current[idx] = mesh;
    sound.playMove();

    const result = checkWinner(boardRef.current);
    if (result.winner) {
      gs.roundLocked = true;
      if (result.line) showWinLaser(result.line);

      if (result.winner === 'X') {
        gs.xWins += 1;
        gs.score += 120;
        setXWins(gs.xWins);
        setScore(gs.score);
        setStatus('X Wins Round! +120 pts');
        sound.playScore();
      } else if (result.winner === 'O') {
        gs.oWins += 1;
        gs.score += 20;
        setOWins(gs.oWins);
        setScore(gs.score);
        setStatus(gs.vsAI ? 'Bot took this round!' : 'O Wins Round!');
        sound.playHit();
      } else {
        gs.score += 45;
        setScore(gs.score);
        setStatus('Draw Round! +45 pts');
      }

      gs.aiTimer = window.setTimeout(() => {
        if (gs.round >= 3) {
          finishMatch();
        } else {
          gs.round += 1;
          gs.roundLocked = false;
          gs.turn = 'X';
          setRound(gs.round);
          setTurn('X');
          clearBoard3D();
          setStatus(`Round ${gs.round}/3 · Your move (X)`);
        }
      }, 1150);
      return;
    }

    const nextTurn = mark === 'X' ? 'O' : 'X';
    gs.turn = nextTurn;
    setTurn(nextTurn);
    setStatus(nextTurn === 'O' && gs.vsAI ? 'Neon Bot thinking...' : `Turn: ${nextTurn}`);

    if (nextTurn === 'O' && gs.vsAI) {
      gs.aiTimer = window.setTimeout(() => {
        const aiIdx = bestAiMove(boardRef.current);
        if (aiIdx !== -1) placeMark(aiIdx, 'O');
      }, 420);
    }
  }, [clearBoard3D, finishMatch, showWinLaser]);

  const startGame = useCallback((aiMode: boolean = vsAI) => {
    const gs = gameStateRef.current;
    if (gs.aiTimer) clearTimeout(gs.aiTimer);
    gs.started = true;
    gs.gameOver = false;
    gs.roundLocked = false;
    gs.vsAI = aiMode;
    gs.turn = 'X';
    gs.round = 1;
    gs.xWins = 0;
    gs.oWins = 0;
    gs.score = 0;

    clearBoard3D();
    setVsAI(aiMode);
    setRound(1);
    setXWins(0);
    setOWins(0);
    setScore(0);
    setTurn('X');
    setGameOver(false);
    setStarted(true);
    setStatus('Round 1/3 · Tap any glowing square!');
    sound.playClick();
  }, [clearBoard3D, vsAI]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, {
      fov: 44,
      bgColor: 0x060a17,
      fogNear: 18,
      fogFar: 45,
    });
    const { scene, camera } = studio;
    camera.position.set(0, 6.2, 5.4);
    camera.lookAt(0, 0, 0.1);
    sceneRef.current = scene;
    cameraRef.current = camera;

    // Pedestal board
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 0.35, 5.2),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.6, roughness: 0.3 })
    );
    base.position.y = -0.175;
    base.receiveShadow = true;
    scene.add(base);

    // Glowing grid bars
    const barMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.85,
    });
    for (const offset of [-CELL_SPACING / 2, CELL_SPACING / 2]) {
      const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 4.7), barMat);
      vBar.position.set(offset, 0.06, 0);
      const hBar = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.14, 0.08), barMat);
      hBar.position.set(0, 0.06, offset);
      scene.add(vBar, hBar);
    }

    // 9 clickable tile pads
    padMeshesRef.current = [];
    const padGeo = new THREE.BoxGeometry(1.3, 0.08, 1.3);
    for (let i = 0; i < 9; i++) {
      const [wx, wz] = cellCoords(i);
      const pad = new THREE.Mesh(
        padGeo,
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.2 })
      );
      pad.position.set(wx, 0.04, wz);
      pad.userData = { cellIdx: i };
      pad.receiveShadow = true;
      scene.add(pad);
      padMeshesRef.current.push(pad);
    }

    // Winning laser beam
    const laser = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 1, 12),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfacc15,
        emissiveIntensity: 2.0,
      })
    );
    laser.visible = false;
    scene.add(laser);
    winLaserRef.current = laser;

    const stopLoop = studio.start((delta, elapsed) => {
      const dt = Math.min(delta, 0.05);
      for (const m of pieceMeshesRef.current) {
        if (m) {
          const ty = m.userData.targetY ?? 0.32;
          m.position.y = THREE.MathUtils.damp(m.position.y, ty, 15, dt);
          m.rotation.y = Math.sin(elapsed * 1.6) * 0.06;
        }
      }
    });

    return () => {
      if (gameStateRef.current.aiTimer) clearTimeout(gameStateRef.current.aiTimer);
      stopLoop();
      studio.cleanup();
    };
  }, []);

  const handleTapBoard = (e: React.PointerEvent<HTMLDivElement>) => {
    const gs = gameStateRef.current;
    if (!gs.started || gs.gameOver || gs.roundLocked) return;
    if (gs.vsAI && gs.turn === 'O') return;
    if (!cameraRef.current || !mountRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, cameraRef.current);
    const hits = raycaster.intersectObjects(padMeshesRef.current, false);
    if (hits.length > 0) {
      const idx = hits[0].object.userData?.cellIdx;
      if (typeof idx === 'number' && boardRef.current[idx] === null) {
        placeMark(idx, gs.turn);
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-2.5 w-full max-w-md mx-auto">
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-cyan-500/30 rounded-xl text-xs font-mono tabular-nums">
        <span className="text-cyan-400 font-bold">X: {xWins}</span>
        <span className="text-slate-300 font-bold">Round {round}/3</span>
        <span className="text-rose-400 font-bold">O: {oWins}</span>
        <span className="text-amber-400 font-bold">Pts: {score}</span>
      </div>

      <div
        className="relative w-full h-[360px] rounded-2xl overflow-hidden border-2 border-cyan-500/40 bg-[#060a17] touch-none select-none"
        onPointerDown={handleTapBoard}
      >
        <div ref={mountRef} className="w-full h-full touch-none" />

        {started && !gameOver && (
          <div className="absolute top-2 left-2 right-2 flex justify-between items-center pointer-events-none">
            <span className="px-2.5 py-1 rounded-lg bg-black/75 border border-white/10 text-[11px] font-semibold text-slate-200">
              {status}
            </span>
            <span className={`px-2.5 py-1 rounded-lg font-black text-xs ${turn === 'X' ? 'bg-cyan-500 text-black' : 'bg-rose-500 text-white'}`}>
              {turn}'s Turn
            </span>
          </div>
        )}

        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black text-cyan-400 mb-1">
                  {xWins > oWins ? 'VICTORY!' : xWins === oWins ? 'MATCH TIED!' : 'BOT WON!'}
                </h3>
                <p className="text-slate-300 text-sm mb-3">
                  Series: {xWins} - {oWins} · +{Math.max(3, Math.floor(score / 25))} Coins
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); startGame(vsAI); }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-cyan-500 text-black font-extrabold rounded-xl active:scale-95"
                >
                  <RotateCcw size={18} /> Play Again
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black text-cyan-400 mb-1">3D Neon Tic-Tac-Toe</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[250px]">
                  Drop 3D X and O pieces on the glowing arena! Best of 3 rounds earns bonus coins.
                </p>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setVsAI(true); }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
                      vsAI ? 'bg-cyan-500 text-black border-cyan-300' : 'bg-slate-800 text-slate-300 border-white/10'
                    }`}
                  >
                    <Bot size={14} /> vs Smart Bot
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setVsAI(false); }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
                      !vsAI ? 'bg-cyan-500 text-black border-cyan-300' : 'bg-slate-800 text-slate-300 border-white/10'
                    }`}
                  >
                    <Users size={14} /> 2P Local
                  </button>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); startGame(vsAI); }}
                  className="flex items-center gap-2 px-7 py-3 bg-cyan-500 text-black font-extrabold rounded-xl shadow-lg shadow-cyan-500/30 active:scale-95"
                >
                  <Play size={18} fill="currentColor" /> Start 3D Match
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Quick 3x3 Accessibility Touch Pad */}
      {started && !gameOver && (
        <p className="text-[11px] text-slate-400">
          Tap directly on any 3D board square to place your piece
        </p>
      )}
    </div>
  );
};
