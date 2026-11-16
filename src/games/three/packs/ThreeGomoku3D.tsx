import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../../services/audio';
import { createStudioContext } from '../threeUtils';
import { Play, RotateCcw } from 'lucide-react';

interface Props {
  onGameOver: (score: number, coinsEarned: number) => void;
}

const SIZE = 7;
const CELL = 0.82;
type Stone = 0 | 1 | 2;

function checkFourLine(board: Stone[][], player: 1 | 2): boolean {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== player) continue;
      for (const [dr, dc] of dirs) {
        let count = 1;
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k;
          const nc = c + dc * k;
          if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE || board[nr][nc] !== player) break;
          count++;
        }
        if (count >= 4) return true;
      }
    }
  }
  return false;
}

function rcToWorld(r: number, c: number): [number, number] {
  return [(c - (SIZE - 1) / 2) * CELL, (r - (SIZE - 1) / 2) * CELL];
}

export const ThreeGomoku3D: React.FC<Props> = ({ onGameOver }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<'YOU' | 'BOT' | 'DRAW' | null>(null);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(0);

  const boardRef = useRef<Stone[][]>(Array.from({ length: SIZE }, () => Array(SIZE).fill(0)));
  const stoneMeshesRef = useRef<THREE.Mesh[]>([]);
  const padMeshesRef = useRef<THREE.Mesh[]>([]);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const stateRef = useRef({
    started: false,
    gameOver: false,
    turn: 1 as 1 | 2,
    moves: 0,
    score: 0,
    timer: null as number | null,
  });
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const clearStones = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    stoneMeshesRef.current.forEach((m) => scene.remove(m));
    stoneMeshesRef.current = [];
    boardRef.current = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  }, []);

  const placeStone = useCallback((r: number, c: number, owner: 1 | 2) => {
    const scene = sceneRef.current;
    const s = stateRef.current;
    if (!scene || boardRef.current[r][c] !== 0 || s.gameOver) return;

    boardRef.current[r][c] = owner;
    s.moves += 1;
    setMoves(s.moves);

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 18, 18),
      new THREE.MeshPhysicalMaterial({
        color: owner === 1 ? 0x22d3ee : 0xf59e0b,
        emissive: owner === 1 ? 0x0891b2 : 0xb45309,
        emissiveIntensity: 0.4,
        roughness: 0.15,
        metalness: 0.3,
        clearcoat: 1,
      })
    );
    const [wx, wz] = rcToWorld(r, c);
    sphere.position.set(wx, 1.8, wz);
    sphere.userData.targetY = 0.28;
    sphere.castShadow = true;
    scene.add(sphere);
    stoneMeshesRef.current.push(sphere);
    sound.playMove();

    if (checkFourLine(boardRef.current, owner)) {
      s.gameOver = true;
      const finalScore = owner === 1 ? Math.max(150, 420 - s.moves * 8) : 45;
      s.score = finalScore;
      setScore(finalScore);
      setWinner(owner === 1 ? 'YOU' : 'BOT');
      setGameOver(true);
      if (owner === 1) sound.playVictory();
      else sound.playGameOver();
      onGameOverRef.current(finalScore, Math.max(3, Math.floor(finalScore / 26)));
      return;
    }

    if (s.moves >= SIZE * SIZE) {
      s.gameOver = true;
      s.score = 100;
      setScore(100);
      setWinner('DRAW');
      setGameOver(true);
      onGameOverRef.current(100, 4);
      return;
    }

    const next: 1 | 2 = owner === 1 ? 2 : 1;
    s.turn = next;

    if (next === 2) {
      s.timer = window.setTimeout(() => {
        const empties: [number, number][] = [];
        for (let rr = 0; rr < SIZE; rr++) {
          for (let cc = 0; cc < SIZE; cc++) {
            if (boardRef.current[rr][cc] === 0) empties.push([rr, cc]);
          }
        }
        // Check win or block
        let pick: [number, number] | null = null;
        for (const [rr, cc] of empties) {
          boardRef.current[rr][cc] = 2;
          if (checkFourLine(boardRef.current, 2)) pick = [rr, cc];
          boardRef.current[rr][cc] = 0;
          if (pick) break;
        }
        if (!pick) {
          for (const [rr, cc] of empties) {
            boardRef.current[rr][cc] = 1;
            if (checkFourLine(boardRef.current, 1)) pick = [rr, cc];
            boardRef.current[rr][cc] = 0;
            if (pick) break;
          }
        }
        if (!pick && empties.length > 0) {
          empties.sort((a, b) => Math.hypot(a[0] - 3, a[1] - 3) - Math.hypot(b[0] - 3, b[1] - 3));
          pick = empties[Math.floor(Math.random() * Math.min(5, empties.length))];
        }
        if (pick) placeStone(pick[0], pick[1], 2);
      }, 420);
    }
  }, []);

  const startGame = useCallback(() => {
    const s = stateRef.current;
    if (s.timer) clearTimeout(s.timer);
    clearStones();
    s.started = true;
    s.gameOver = false;
    s.turn = 1;
    s.moves = 0;
    s.score = 0;
    setScore(0);
    setMoves(0);
    setWinner(null);
    setGameOver(false);
    setStarted(true);
    sound.playClick();
  }, [clearStones]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, { fov: 45, bgColor: 0x070a18, fogNear: 20, fogFar: 55 });
    const { scene, camera } = studio;
    camera.position.set(0, 7.2, 5.4);
    camera.lookAt(0, 0, 0.15);
    sceneRef.current = scene;
    cameraRef.current = camera;

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(SIZE * CELL + 0.4, 0.26, SIZE * CELL + 0.4),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.4 })
    );
    board.position.y = -0.13;
    scene.add(board);

    padMeshesRef.current = [];
    const padGeo = new THREE.BoxGeometry(CELL * 0.9, 0.06, CELL * 0.9);
    const padMatA = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
    const padMatB = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.5 });
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const [wx, wz] = rcToWorld(r, c);
        const pad = new THREE.Mesh(padGeo, (r + c) % 2 === 0 ? padMatA : padMatB);
        pad.position.set(wx, 0.01, wz);
        pad.userData = { r, c };
        pad.receiveShadow = true;
        scene.add(pad);
        padMeshesRef.current.push(pad);
      }
    }

    const stopLoop = studio.start((delta) => {
      const dt = Math.min(delta, 0.05);
      for (const m of stoneMeshesRef.current) {
        m.position.y = THREE.MathUtils.damp(m.position.y, m.userData.targetY ?? 0.28, 16, dt);
      }
    });

    return () => {
      if (stateRef.current.timer) clearTimeout(stateRef.current.timer);
      stopLoop();
      studio.cleanup();
    };
  }, []);

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
    const hits = raycaster.intersectObjects(padMeshesRef.current, false);
    if (hits.length > 0) {
      const { r, c } = hits[0].object.userData as { r: number; c: number };
      placeStone(r, c, 1);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2.5 w-full max-w-md mx-auto">
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-cyan-500/30 rounded-xl text-xs font-mono tabular-nums">
        <span className="text-cyan-400 font-bold">You: Cyan Spheres</span>
        <span className="text-amber-400 font-bold">Moves: {moves}</span>
      </div>
      <div className="relative w-full h-[360px] rounded-2xl overflow-hidden border-2 border-cyan-500/40 bg-[#070a18] touch-none select-none" onPointerDown={handleTap}>
        <div ref={mountRef} className="w-full h-full touch-none" />
        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black text-cyan-400 mb-1">
                  {winner === 'YOU' ? '4-IN-A-ROW VICTORY!' : winner === 'DRAW' ? 'BOARD FULL!' : 'BOT CONNECTED 4!'}
                </h3>
                <p className="text-slate-300 text-sm mb-3">Score: {score} · +{Math.max(3, Math.floor(score / 26))} Coins</p>
                <button onClick={(e) => { e.stopPropagation(); startGame(); }} className="flex items-center gap-2 px-6 py-2.5 bg-cyan-500 text-black font-extrabold rounded-xl active:scale-95">
                  <RotateCcw size={18} /> Play Again
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black text-cyan-400 mb-1">3D Gomoku Line</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[250px]">Tap squares on the 7x7 3D grid to drop glowing Cyan spheres and connect 4 in a row!</p>
                <button onClick={(e) => { e.stopPropagation(); startGame(); }} className="flex items-center gap-2 px-7 py-3 bg-cyan-500 text-black font-extrabold rounded-xl shadow-lg active:scale-95">
                  <Play size={18} fill="currentColor" /> Start 3D Gomoku
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <p className="text-[11px] text-slate-400">Tap any open 3D square to drop a Cyan sphere</p>
    </div>
  );
};
