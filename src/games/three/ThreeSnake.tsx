import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../services/audio';
import { createStudioContext } from './threeUtils';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Play, RotateCcw } from 'lucide-react';

interface Props {
  onGameOver: (score: number, coinsEarned: number) => void;
}

const GRID = 13;
const HALF = Math.floor(GRID / 2);

export const ThreeSnake: React.FC<Props> = ({ onGameOver }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const dirRef = useRef<{ x: number; z: number }>({ x: 1, z: 0 });
  const nextDirRef = useRef<{ x: number; z: number }>({ x: 1, z: 0 });
  const runningRef = useRef(false);
  const scoreRef = useRef(0);
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;
  const resetRef = useRef<() => void>(() => {});
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const setDir = useCallback((dx: number, dz: number) => {
    if (!runningRef.current) return;
    if (dirRef.current.x === -dx && dirRef.current.z === -dz) return;
    nextDirRef.current = { x: dx, z: dz };
  }, []);

  const startGame = useCallback(() => {
    resetRef.current();
    dirRef.current = { x: 1, z: 0 };
    nextDirRef.current = { x: 1, z: 0 };
    scoreRef.current = 0;
    runningRef.current = true;
    setScore(0);
    setGameOver(false);
    setStarted(true);
    sound.playClick();
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, {
      fov: 50,
      bgColor: 0x04120e,
      fogNear: 20,
      fogFar: 60,
    });
    const { scene, camera } = studio;
    camera.position.set(0, 14.5, 11.5);
    camera.lookAt(0, 0, 0.5);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(GRID + 0.6, 0.5, GRID + 0.6),
      new THREE.MeshStandardMaterial({ color: 0x062019, roughness: 0.75 })
    );
    board.position.y = -0.25;
    board.receiveShadow = true;
    scene.add(board);

    const gridHelper = new THREE.GridHelper(GRID, GRID, 0x10b981, 0x064e3b);
    gridHelper.position.y = 0.02;
    scene.add(gridHelper);

    const headMat = new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x059669, emissiveIntensity: 0.6, roughness: 0.25 });
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.4 });
    const segGeo = new THREE.BoxGeometry(0.84, 0.72, 0.84);

    // Food crystal
    const foodMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.42, 0),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xf59e0b, emissiveIntensity: 1.2, metalness: 0.4, roughness: 0.2 })
    );
    foodMesh.position.y = 0.52;
    scene.add(foodMesh);

    let snake: { x: number; z: number }[] = [];
    const segMeshes: THREE.Mesh[] = [];
    let food = { x: 3, z: 0 };
    let stepTimer = 0;

    const syncMeshes = () => {
      while (segMeshes.length < snake.length) {
        const m = new THREE.Mesh(segGeo, segMeshes.length === 0 ? headMat : bodyMat);
        m.castShadow = true;
        scene.add(m);
        segMeshes.push(m);
      }
      while (segMeshes.length > snake.length) {
        const m = segMeshes.pop()!;
        scene.remove(m);
      }
      snake.forEach((s, i) => {
        segMeshes[i].position.set(s.x, 0.36, s.z);
        segMeshes[i].material = i === 0 ? headMat : bodyMat;
      });
      foodMesh.position.set(food.x, 0.52, food.z);
    };

    const placeFood = () => {
      for (let tries = 0; tries < 80; tries++) {
        const fx = Math.floor(Math.random() * GRID) - HALF;
        const fz = Math.floor(Math.random() * GRID) - HALF;
        if (!snake.some((s) => s.x === fx && s.z === fz)) {
          food = { x: fx, z: fz };
          return;
        }
      }
    };

    const init = () => {
      snake = [{ x: 0, z: 0 }, { x: -1, z: 0 }, { x: -2, z: 0 }];
      placeFood();
      stepTimer = 0;
      syncMeshes();
    };

    init();
    resetRef.current = init;

    const stopLoop = studio.start((delta, elapsed) => {
      const dt = Math.min(delta, 0.05);
      foodMesh.rotation.y = elapsed * 3;
      foodMesh.position.y = 0.52 + Math.sin(elapsed * 5) * 0.1;

      if (!runningRef.current) return;

      stepTimer += dt;
      const interval = Math.max(0.11, 0.22 - scoreRef.current * 0.0005);
      if (stepTimer >= interval) {
        stepTimer = 0;
        dirRef.current = nextDirRef.current;
        const nx = snake[0].x + dirRef.current.x;
        const nz = snake[0].z + dirRef.current.z;

        if (Math.abs(nx) > HALF || Math.abs(nz) > HALF || snake.some((s) => s.x === nx && s.z === nz)) {
          runningRef.current = false;
          setGameOver(true);
          sound.playHit();
          onGameOverRef.current(scoreRef.current, Math.max(1, Math.floor(scoreRef.current / 20)));
          return;
        }

        snake.unshift({ x: nx, z: nz });
        if (nx === food.x && nz === food.z) {
          scoreRef.current += 20;
          setScore(scoreRef.current);
          sound.playCoin();
          placeFood();
        } else {
          snake.pop();
        }
        syncMeshes();
      }
    });

    return () => {
      stopLoop();
      segGeo.dispose();
      headMat.dispose();
      bodyMat.dispose();
      studio.cleanup();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.code === 'ArrowUp' || e.code === 'KeyW') setDir(0, -1);
      if (e.code === 'ArrowDown' || e.code === 'KeyS') setDir(0, 1);
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') setDir(-1, 0);
      if (e.code === 'ArrowRight' || e.code === 'KeyD') setDir(1, 0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setDir]);

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-md mx-auto">
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-emerald-500/30 rounded-xl text-sm font-mono tabular-nums">
        <span className="text-emerald-400 font-bold">3D Snake · {score}</span>
        <span className="text-amber-400">+{Math.floor(score / 20)} Coins</span>
      </div>

      <div className="relative w-full h-[320px] rounded-2xl overflow-hidden border-2 border-emerald-500/40 bg-[#04120e] touch-none select-none">
        <div
          ref={mountRef}
          className="w-full h-full touch-none"
          onPointerDown={(e) => { swipeStartRef.current = { x: e.clientX, y: e.clientY }; }}
          onPointerUp={(e) => {
            if (!runningRef.current || !swipeStartRef.current) return;
            const dx = e.clientX - swipeStartRef.current.x;
            const dy = e.clientY - swipeStartRef.current.y;
            swipeStartRef.current = null;
            if (Math.abs(dx) < 15 && Math.abs(dy) < 15) return;
            if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
            else setDir(0, dy > 0 ? 1 : -1);
          }}
        />

        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black text-rose-500 mb-1">GAME OVER</h3>
                <p className="text-slate-300 text-sm mb-3">
                  Score: <span className="text-emerald-400 font-bold">{score}</span> · +{Math.max(1, Math.floor(score / 20))} Coins
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 text-black font-extrabold rounded-xl active:scale-95"
                >
                  <RotateCcw size={18} /> Play Again
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black text-emerald-400 mb-1">3D Arena Snake</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[240px]">
                  Swipe or use D-Pad arrows to guide the 3D cyber cobra toward glowing yellow crystals!
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-7 py-3 bg-emerald-500 text-black font-extrabold rounded-xl shadow-lg shadow-emerald-500/30 active:scale-95"
                >
                  <Play size={18} fill="currentColor" /> Start 3D Snake
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 w-44">
        <div />
        <button onPointerDown={(e) => { e.preventDefault(); setDir(0, -1); }} className="h-12 bg-slate-800 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-400 active:bg-emerald-500 active:text-black touch-none select-none"><ArrowUp size={20} /></button>
        <div />
        <button onPointerDown={(e) => { e.preventDefault(); setDir(-1, 0); }} className="h-12 bg-slate-800 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-400 active:bg-emerald-500 active:text-black touch-none select-none"><ArrowLeft size={20} /></button>
        <button onPointerDown={(e) => { e.preventDefault(); setDir(0, 1); }} className="h-12 bg-slate-800 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-400 active:bg-emerald-500 active:text-black touch-none select-none"><ArrowDown size={20} /></button>
        <button onPointerDown={(e) => { e.preventDefault(); setDir(1, 0); }} className="h-12 bg-slate-800 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-400 active:bg-emerald-500 active:text-black touch-none select-none"><ArrowRight size={20} /></button>
      </div>
    </div>
  );
};
