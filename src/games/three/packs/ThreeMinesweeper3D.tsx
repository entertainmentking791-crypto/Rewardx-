import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../../services/audio';
import { createStudioContext, makeCanvasTexture } from '../threeUtils';
import { Flag, Play, RotateCcw, Pickaxe } from 'lucide-react';

interface Props {
  onGameOver: (score: number, coinsEarned: number) => void;
}

const SIZE = 5;
const MINES = 5;
const CELL = 1.08;

interface CellData {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adj: number;
}

function rcToWorld(r: number, c: number): [number, number] {
  return [(c - (SIZE - 1) / 2) * CELL, (r - (SIZE - 1) / 2) * CELL];
}

export const ThreeMinesweeper3D: React.FC<Props> = ({ onGameOver }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [flagMode, setFlagMode] = useState(false);
  const [safeLeft, setSafeLeft] = useState(SIZE * SIZE - MINES);
  const [score, setScore] = useState(0);

  const gridRef = useRef<CellData[][]>([]);
  const cubeMeshesRef = useRef<THREE.Mesh[]>([]);
  const texCacheRef = useRef<Record<string, THREE.CanvasTexture>>({});
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const stateRef = useRef({
    started: false,
    gameOver: false,
    flagMode: false,
    score: 0,
    revealedCount: 0,
    firstTap: true,
  });
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  useEffect(() => {
    stateRef.current.flagMode = flagMode;
  }, [flagMode]);

  const getTileTexture = useCallback((label: string, bg: string, fg: string): THREE.CanvasTexture | undefined => {
    const key = `${label}_${bg}_${fg}`;
    if (texCacheRef.current[key]) return texCacheRef.current[key];
    if (!rendererRef.current) return undefined;
    const tex = makeCanvasTexture(rendererRef.current, 128, 128, (ctx, w, h) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      if (label) {
        ctx.fillStyle = fg;
        ctx.font = 'bold 64px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, w / 2, h / 2 + 4);
      }
    });
    texCacheRef.current[key] = tex;
    return tex;
  }, []);

  const refreshCubes = useCallback(() => {
    const numColors = ['#94a3b8', '#38bdf8', '#22c55e', '#facc15', '#f97316', '#ef4444'];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = gridRef.current[r]?.[c];
        const mesh = cubeMeshesRef.current[r * SIZE + c];
        if (!cell || !mesh) continue;
        const mat = mesh.material as THREE.MeshStandardMaterial;

        if (!cell.revealed) {
          mesh.userData.targetY = 0.25;
          mat.map = cell.flagged ? getTileTexture('🚩', '#3b0764', '#f43f5e') || null : getTileTexture('', '#1e293b', '#ffffff') || null;
          mat.color.setHex(cell.flagged ? 0xc084fc : 0xffffff);
        } else if (cell.mine) {
          mesh.userData.targetY = 0.14;
          mat.map = getTileTexture('💣', '#7f1d1d', '#fef08a') || null;
          mat.color.setHex(0xffffff);
        } else {
          mesh.userData.targetY = 0.08;
          const lbl = cell.adj > 0 ? String(cell.adj) : '';
          mat.map = getTileTexture(lbl, '#0f172a', numColors[cell.adj] || '#e2e8f0') || null;
          mat.color.setHex(0xffffff);
        }
        mat.needsUpdate = true;
      }
    }
  }, [getTileTexture]);

  const populateMines = (safeR: number, safeC: number) => {
    const grid = gridRef.current;
    let placed = 0;
    while (placed < MINES) {
      const rr = Math.floor(Math.random() * SIZE);
      const cc = Math.floor(Math.random() * SIZE);
      if ((rr === safeR && cc === safeC) || grid[rr][cc].mine) continue;
      grid[rr][cc].mine = true;
      placed++;
    }
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && grid[nr][nc].mine) count++;
          }
        }
        grid[r][c].adj = count;
      }
    }
  };

  const revealCell = useCallback((r: number, c: number) => {
    const s = stateRef.current;
    const grid = gridRef.current;
    const cell = grid[r]?.[c];
    if (!cell || cell.revealed || cell.flagged || s.gameOver) return;

    if (s.firstTap) {
      s.firstTap = false;
      populateMines(r, c);
    }

    const flood = (rr: number, cc: number) => {
      const cur = grid[rr]?.[cc];
      if (!cur || cur.revealed || cur.flagged) return;
      cur.revealed = true;
      if (cur.mine) return;
      s.revealedCount += 1;
      s.score += 20;
      if (cur.adj === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            flood(rr + dr, cc + dc);
          }
        }
      }
    };

    if (cell.mine) {
      for (let rr = 0; rr < SIZE; rr++) {
        for (let cc = 0; cc < SIZE; cc++) {
          if (grid[rr][cc].mine) grid[rr][cc].revealed = true;
        }
      }
      refreshCubes();
      s.gameOver = true;
      setWon(false);
      setGameOver(true);
      sound.playExplosion();
      onGameOverRef.current(s.score, Math.max(2, Math.floor(s.score / 25)));
      return;
    }

    flood(r, c);
    sound.playMove();
    setScore(s.score);
    const left = SIZE * SIZE - MINES - s.revealedCount;
    setSafeLeft(left);
    refreshCubes();

    if (left <= 0) {
      s.gameOver = true;
      s.score += 180;
      setScore(s.score);
      setWon(true);
      setGameOver(true);
      sound.playVictory();
      onGameOverRef.current(s.score, Math.max(5, Math.floor(s.score / 25)));
    }
  }, [refreshCubes]);

  const startGame = useCallback(() => {
    const s = stateRef.current;
    s.started = true;
    s.gameOver = false;
    s.score = 0;
    s.revealedCount = 0;
    s.firstTap = true;
    gridRef.current = Array.from({ length: SIZE }, () =>
      Array.from({ length: SIZE }, () => ({ mine: false, revealed: false, flagged: false, adj: 0 }))
    );
    refreshCubes();
    setSafeLeft(SIZE * SIZE - MINES);
    setScore(0);
    setWon(false);
    setGameOver(false);
    setStarted(true);
    sound.playClick();
  }, [refreshCubes]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, { fov: 45, bgColor: 0x14080e, fogNear: 20, fogFar: 55 });
    const { scene, camera, renderer } = studio;
    camera.position.set(0, 6.6, 4.9);
    camera.lookAt(0, 0, 0.15);
    cameraRef.current = camera;
    rendererRef.current = renderer;

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(SIZE * CELL + 0.4, 0.24, SIZE * CELL + 0.4),
      new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.5 })
    );
    base.position.y = -0.14;
    scene.add(base);

    cubeMeshesRef.current = [];
    const geo = new THREE.BoxGeometry(CELL * 0.9, 0.42, CELL * 0.9);
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const [wx, wz] = rcToWorld(r, c);
        const cube = new THREE.Mesh(
          geo,
          new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 })
        );
        cube.position.set(wx, 0.25, wz);
        cube.userData = { r, c, targetY: 0.25 };
        cube.castShadow = true;
        scene.add(cube);
        cubeMeshesRef.current.push(cube);
      }
    }

    gridRef.current = Array.from({ length: SIZE }, () =>
      Array.from({ length: SIZE }, () => ({ mine: false, revealed: false, flagged: false, adj: 0 }))
    );
    refreshCubes();

    const stopLoop = studio.start((delta) => {
      const dt = Math.min(delta, 0.05);
      for (const m of cubeMeshesRef.current) {
        m.position.y = THREE.MathUtils.damp(m.position.y, m.userData.targetY ?? 0.25, 14, dt);
      }
    });

    return () => {
      stopLoop();
      Object.values(texCacheRef.current).forEach((t) => t.dispose());
      texCacheRef.current = {};
      studio.cleanup();
    };
  }, [refreshCubes]);

  const handleTap = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stateRef.current;
    if (!s.started || s.gameOver || !cameraRef.current || !mountRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, cameraRef.current);
    const hits = raycaster.intersectObjects(cubeMeshesRef.current, false);
    if (hits.length === 0) return;

    const { r, c } = hits[0].object.userData as { r: number; c: number };
    const cell = gridRef.current[r]?.[c];
    if (!cell || cell.revealed) return;

    if (s.flagMode) {
      cell.flagged = !cell.flagged;
      sound.playClick();
      refreshCubes();
    } else {
      revealCell(r, c);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2.5 w-full max-w-md mx-auto">
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-rose-500/30 rounded-xl text-xs font-mono tabular-nums">
        <span className="text-rose-400 font-bold">Mines: {MINES}</span>
        <span className="text-cyan-400 font-bold">Safe Left: {safeLeft}</span>
        <span className="text-amber-400 font-bold">Pts: {score}</span>
      </div>
      <div className="relative w-full h-[335px] rounded-2xl overflow-hidden border-2 border-rose-500/40 bg-[#14080e] touch-none select-none" onPointerDown={handleTap}>
        <div ref={mountRef} className="w-full h-full touch-none" />
        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black text-rose-400 mb-1">{won ? 'SECTOR CLEARED!' : 'BOOM! HIT A MINE'}</h3>
                <p className="text-slate-300 text-sm mb-3">Score: {score} · +{Math.max(won ? 5 : 2, Math.floor(score / 25))} Coins</p>
                <button onClick={(e) => { e.stopPropagation(); startGame(); }} className="flex items-center gap-2 px-6 py-2.5 bg-rose-500 text-white font-extrabold rounded-xl active:scale-95">
                  <RotateCcw size={18} /> New Grid
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black text-rose-400 mb-1">3D Cyber Sweeper</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[250px]">Tap raised 3D cubes to reveal safe proximity numbers. Switch to Flag Mode to mark all 5 mines!</p>
                <button onClick={(e) => { e.stopPropagation(); startGame(); }} className="flex items-center gap-2 px-7 py-3 bg-rose-500 text-white font-extrabold rounded-xl shadow-lg active:scale-95">
                  <Play size={18} fill="currentColor" /> Start Sweeping
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2.5 w-full">
        <button type="button" onClick={() => setFlagMode(false)} className={`h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border ${!flagMode ? 'bg-cyan-500 text-black border-cyan-300' : 'bg-slate-800 text-slate-300 border-white/10'}`}>
          <Pickaxe size={16} /> Dig Mode
        </button>
        <button type="button" onClick={() => setFlagMode(true)} className={`h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border ${flagMode ? 'bg-rose-500 text-white border-rose-300' : 'bg-slate-800 text-slate-300 border-white/10'}`}>
          <Flag size={16} /> Flag Mode
        </button>
      </div>
    </div>
  );
};
