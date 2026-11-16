import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../services/audio';
import { createStudioContext } from './threeUtils';
import { Bot, Users, Play, RotateCcw } from 'lucide-react';

interface Props {
  onGameOver: (score: number, coinsEarned: number) => void;
}

const COLS = 7;
const ROWS = 6;
const COL_GAP = 0.88;
const ROW_GAP = 0.82;

type DiscOwner = 0 | 1 | 2; // 0 empty, 1 Red (Player), 2 Gold (Bot / P2)

function checkFour(grid: DiscOwner[][]): { winner: DiscOwner | 'DRAW' | null; cells: [number, number][] } {
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = grid[r][c];
      if (!p) continue;
      for (const [dr, dc] of dirs) {
        const line: [number, number][] = [[r, c]];
        for (let step = 1; step < 4; step++) {
          const nr = r + dr * step;
          const nc = c + dc * step;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || grid[nr][nc] !== p) break;
          line.push([nr, nc]);
        }
        if (line.length === 4) return { winner: p, cells: line };
      }
    }
  }
  const full = grid[ROWS - 1].every((cell) => cell !== 0);
  if (full) return { winner: 'DRAW', cells: [] };
  return { winner: null, cells: [] };
}

function getDropRow(grid: DiscOwner[][], col: number): number {
  for (let r = 0; r < ROWS; r++) {
    if (grid[r][col] === 0) return r;
  }
  return -1;
}

function chooseBotColumn(grid: DiscOwner[][]): number {
  const validCols = Array.from({ length: COLS }, (_, i) => i).filter((c) => getDropRow(grid, c) !== -1);
  if (validCols.length === 0) return -1;

  // 1. Immediate AI win
  for (const c of validCols) {
    const r = getDropRow(grid, c);
    grid[r][c] = 2;
    const win = checkFour(grid).winner === 2;
    grid[r][c] = 0;
    if (win) return c;
  }
  // 2. Immediate block Player 1 win
  for (const c of validCols) {
    const r = getDropRow(grid, c);
    grid[r][c] = 1;
    const block = checkFour(grid).winner === 1;
    grid[r][c] = 0;
    if (block) return c;
  }
  // 3. Prefer center columns
  const scored = validCols.map((c) => ({
    col: c,
    weight: 10 - Math.abs(c - 3) * 2 + Math.random() * 2.5,
  }));
  scored.sort((a, b) => b.weight - a.weight);
  return scored[0].col;
}

function colToX(c: number): number {
  return (c - (COLS - 1) / 2) * COL_GAP;
}

function rowToY(r: number): number {
  return 0.65 + r * ROW_GAP;
}

export const ThreeConnectFour: React.FC<Props> = ({ onGameOver }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [vsAI, setVsAI] = useState(true);
  const [turn, setTurn] = useState<1 | 2>(1);
  const [gameOver, setGameOver] = useState(false);
  const [resultText, setResultText] = useState('');
  const [score, setScore] = useState(0);
  const [movesCount, setMovesCount] = useState(0);

  const gridRef = useRef<DiscOwner[][]>(Array.from({ length: ROWS }, () => Array(COLS).fill(0)));
  const discMeshesRef = useRef<{ mesh: THREE.Mesh; targetY: number; vy: number; r: number; c: number }[]>([]);
  const colHitMeshesRef = useRef<THREE.Mesh[]>([]);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const stateRef = useRef({
    started: false,
    gameOver: false,
    locked: false,
    vsAI: true,
    turn: 1 as 1 | 2,
    moves: 0,
    aiTimer: null as number | null,
  });
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const clearDiscs = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    discMeshesRef.current.forEach((d) => scene.remove(d.mesh));
    discMeshesRef.current = [];
    gridRef.current = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }, []);

  const dropDisc = useCallback((col: number) => {
    const s = stateRef.current;
    const scene = sceneRef.current;
    if (!scene || !s.started || s.gameOver || s.locked) return;

    const row = getDropRow(gridRef.current, col);
    if (row === -1) return;

    const owner = s.turn;
    gridRef.current[row][col] = owner;
    s.moves += 1;
    setMovesCount(s.moves);

    const discMat = new THREE.MeshPhysicalMaterial({
      color: owner === 1 ? 0xef4444 : 0xfacc15,
      emissive: owner === 1 ? 0x991b1b : 0xa16207,
      emissiveIntensity: 0.35,
      metalness: 0.35,
      roughness: 0.2,
      clearcoat: 1,
    });
    const discGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.22, 22);
    discGeo.rotateX(Math.PI / 2);
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.set(colToX(col), rowToY(ROWS) + 0.8, 0);
    disc.castShadow = true;
    scene.add(disc);
    discMeshesRef.current.push({ mesh: disc, targetY: rowToY(row), vy: 0, r: row, c: col });
    sound.playPaddle();

    const check = checkFour(gridRef.current);
    if (check.winner) {
      s.gameOver = true;
      s.locked = true;

      // Glow winning discs
      if (check.cells.length > 0) {
        const winSet = new Set(check.cells.map(([rr, cc]) => `${rr},${cc}`));
        discMeshesRef.current.forEach((d) => {
          if (winSet.has(`${d.r},${d.c}`)) {
            const mat = d.mesh.material as THREE.MeshPhysicalMaterial;
            mat.emissive.setHex(0xffffff);
            mat.emissiveIntensity = 1.2;
          }
        });
      }

      const finalScore =
        check.winner === 1
          ? Math.max(120, 420 - s.moves * 6)
          : check.winner === 'DRAW'
          ? 120
          : 60;
      setScore(finalScore);
      setResultText(
        check.winner === 1
          ? 'CONNECT 4 VICTORY!'
          : check.winner === 'DRAW'
          ? 'GRID FULL · DRAW!'
          : s.vsAI
          ? 'GOLD BOT CONNECTED 4!'
          : 'PLAYER 2 CONNECTED 4!'
      );
      if (check.winner === 1) sound.playVictory();
      else sound.playGameOver();

      const coins = Math.max(3, Math.floor(finalScore / 25));
      s.aiTimer = window.setTimeout(() => {
        setGameOver(true);
        onGameOverRef.current(finalScore, coins);
      }, 650);
      return;
    }

    const nextTurn: 1 | 2 = owner === 1 ? 2 : 1;
    s.turn = nextTurn;
    setTurn(nextTurn);

    if (nextTurn === 2 && s.vsAI) {
      s.locked = true;
      s.aiTimer = window.setTimeout(() => {
        s.locked = false;
        const aiCol = chooseBotColumn(gridRef.current);
        if (aiCol !== -1) dropDisc(aiCol);
      }, 480);
    }
  }, []);

  const startGame = useCallback((aiMode: boolean = vsAI) => {
    const s = stateRef.current;
    if (s.aiTimer) clearTimeout(s.aiTimer);
    clearDiscs();
    s.started = true;
    s.gameOver = false;
    s.locked = false;
    s.vsAI = aiMode;
    s.turn = 1;
    s.moves = 0;

    setVsAI(aiMode);
    setTurn(1);
    setScore(0);
    setMovesCount(0);
    setGameOver(false);
    setResultText('');
    setStarted(true);
    sound.playClick();
  }, [clearDiscs, vsAI]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, {
      fov: 45,
      bgColor: 0x060916,
      fogNear: 20,
      fogFar: 55,
    });
    const { scene, camera } = studio;
    camera.position.set(0, 3.6, 8.6);
    camera.lookAt(0, 2.5, 0);
    sceneRef.current = scene;
    cameraRef.current = camera;

    // 3D Connect 4 Rack Frame
    const rackMat = new THREE.MeshPhysicalMaterial({
      color: 0x1d4ed8,
      metalness: 0.35,
      roughness: 0.28,
      clearcoat: 0.7,
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.4 });

    const rackWidth = COLS * COL_GAP + 0.4;
    const rackHeight = ROWS * ROW_GAP + 0.35;

    // Base tray
    const base = new THREE.Mesh(new THREE.BoxGeometry(rackWidth + 0.8, 0.32, 1.3), darkMat);
    base.position.set(0, 0.16, 0);
    base.receiveShadow = true;
    scene.add(base);

    // Side pillars
    const pillarGeo = new THREE.BoxGeometry(0.24, rackHeight, 0.55);
    const leftPillar = new THREE.Mesh(pillarGeo, rackMat);
    leftPillar.position.set(-rackWidth / 2 - 0.12, rackHeight / 2 + 0.16, 0);
    const rightPillar = leftPillar.clone();
    rightPillar.position.x = rackWidth / 2 + 0.12;
    scene.add(leftPillar, rightPillar);

    // Front & back translucent vertical ribs + slot rings
    const slotRingGeo = new THREE.TorusGeometry(0.36, 0.045, 8, 22);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ring = new THREE.Mesh(slotRingGeo, rackMat);
        ring.position.set(colToX(c), rowToY(r), 0.15);
        scene.add(ring);
        const backRing = ring.clone();
        backRing.position.z = -0.15;
        scene.add(backRing);
      }
    }

    // Invisible column hit boxes for raycasting
    colHitMeshesRef.current = [];
    const hitGeo = new THREE.BoxGeometry(COL_GAP * 0.92, rackHeight + 0.8, 0.8);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    for (let c = 0; c < COLS; c++) {
      const hit = new THREE.Mesh(hitGeo, hitMat);
      hit.position.set(colToX(c), rackHeight / 2 + 0.3, 0);
      hit.userData = { col: c };
      scene.add(hit);
      colHitMeshesRef.current.push(hit);
    }

    const stopLoop = studio.start((delta) => {
      const dt = Math.min(delta, 0.05);
      for (const d of discMeshesRef.current) {
        if (d.mesh.position.y > d.targetY || Math.abs(d.vy) > 0.05) {
          d.vy -= 28 * dt;
          d.mesh.position.y += d.vy * dt;
          if (d.mesh.position.y <= d.targetY) {
            d.mesh.position.y = d.targetY;
            if (Math.abs(d.vy) > 2.2) {
              d.vy = -d.vy * 0.32;
            } else {
              d.vy = 0;
            }
          }
        }
      }
    });

    return () => {
      if (stateRef.current.aiTimer) clearTimeout(stateRef.current.aiTimer);
      stopLoop();
      studio.cleanup();
    };
  }, []);

  const handleRackTap = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stateRef.current;
    if (!s.started || s.gameOver || s.locked) return;
    if (s.vsAI && s.turn === 2) return;
    if (!cameraRef.current || !mountRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, cameraRef.current);
    const hits = raycaster.intersectObjects(colHitMeshesRef.current, false);
    if (hits.length > 0) {
      const col = hits[0].object.userData?.col;
      if (typeof col === 'number') dropDisc(col);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2.5 w-full max-w-md mx-auto">
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-blue-500/30 rounded-xl text-xs font-mono tabular-nums">
        <span className={turn === 1 ? 'text-rose-400 font-bold' : 'text-yellow-400 font-bold'}>
          Turn: {turn === 1 ? 'Red (You)' : vsAI ? 'Gold Bot' : 'Gold (P2)'}
        </span>
        <span className="text-slate-300">Moves: {movesCount}</span>
      </div>

      <div
        className="relative w-full h-[335px] rounded-2xl overflow-hidden border-2 border-blue-500/40 bg-[#060916] touch-none select-none"
        onPointerDown={handleRackTap}
      >
        <div ref={mountRef} className="w-full h-full touch-none" />

        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black text-amber-400 mb-1">{resultText}</h3>
                <p className="text-slate-300 text-sm mb-3">
                  Score: <span className="text-white font-bold">{score}</span> · +{Math.max(3, Math.floor(score / 25))} Coins
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); startGame(vsAI); }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-500 text-white font-extrabold rounded-xl active:scale-95"
                >
                  <RotateCcw size={18} /> Rematch
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black text-blue-400 mb-1">3D Connect Four</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[260px]">
                  Drop 3D ruby &amp; gold discs down the rack to connect 4 in a row horizontally, vertically, or diagonally!
                </p>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setVsAI(true); }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
                      vsAI ? 'bg-blue-500 text-white border-blue-300' : 'bg-slate-800 text-slate-300 border-white/10'
                    }`}
                  >
                    <Bot size={14} /> vs Smart Bot
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setVsAI(false); }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
                      !vsAI ? 'bg-blue-500 text-white border-blue-300' : 'bg-slate-800 text-slate-300 border-white/10'
                    }`}
                  >
                    <Users size={14} /> 2P Local
                  </button>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); startGame(vsAI); }}
                  className="flex items-center gap-2 px-7 py-3 bg-blue-500 text-white font-extrabold rounded-xl shadow-lg shadow-blue-500/30 active:scale-95"
                >
                  <Play size={18} fill="currentColor" /> Start 3D Rack
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Column drop buttons */}
      <div className="grid grid-cols-7 gap-1.5 w-full">
        {Array.from({ length: COLS }, (_, c) => {
          const disabled = !started || gameOver || (vsAI && turn === 2) || getDropRow(gridRef.current, c) === -1;
          return (
            <button
              key={c}
              type="button"
              disabled={disabled}
              onClick={() => dropDisc(c)}
              className="h-11 rounded-xl bg-slate-800 hover:bg-blue-600 disabled:opacity-35 border border-blue-500/30 text-white font-black text-xs active:scale-95 transition-all"
            >
              ↓{c + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
};
