import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../services/audio';
import { createStudioContext } from './threeUtils';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Play, RotateCcw } from 'lucide-react';

interface Props {
  onGameOver: (score: number, coinsEarned: number) => void;
}

export const ThreeMazeBall: React.FC<Props> = ({ onGameOver }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const tiltInputRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const runningRef = useRef(false);
  const scoreRef = useRef(0);
  const levelRef = useRef(1);
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;
  const resetLevelRef = useRef<() => void>(() => {});

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    levelRef.current = 1;
    runningRef.current = true;
    tiltInputRef.current = { x: 0, z: 0 };
    resetLevelRef.current();
    setScore(0);
    setLevel(1);
    setGameOver(false);
    setStarted(true);
    sound.playClick();
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, {
      fov: 50,
      bgColor: 0x090814,
      fogNear: 20,
      fogFar: 60,
    });
    const { scene, camera } = studio;
    camera.position.set(0, 11.5, 9.5);
    camera.lookAt(0, 0, 0.5);

    const boardGroup = new THREE.Group();
    scene.add(boardGroup);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.4, 10),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.15 })
    );
    floor.position.y = -0.2;
    floor.receiveShadow = true;
    boardGroup.add(floor);

    // Outer walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.4, roughness: 0.35 });
    const wN = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.9, 0.4), wallMat);
    wN.position.set(0, 0.45, -5.0);
    const wS = wN.clone();
    wS.position.z = 5.0;
    const wW = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 10.4), wallMat);
    wW.position.set(-5.0, 0.45, 0);
    const wE = wW.clone();
    wE.position.x = 5.0;
    boardGroup.add(wN, wS, wW, wE);

    // Chrome ball
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 24, 24),
      new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, metalness: 0.92, roughness: 0.12, clearcoat: 1 })
    );
    ball.castShadow = true;
    boardGroup.add(ball);

    // Portal goal
    const goal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.65, 0.18, 20),
      new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 1.3 })
    );
    boardGroup.add(goal);

    interface Pit {
      mesh: THREE.Mesh;
      x: number;
      z: number;
    }
    interface WallBox {
      mesh: THREE.Mesh;
      x: number;
      z: number;
      hw: number;
      hd: number;
    }
    const pits: Pit[] = [];
    const innerWalls: WallBox[] = [];

    let bx = -3.8;
    let bz = 3.8;
    let vx = 0;
    let vz = 0;

    const buildLevel = () => {
      pits.forEach((p) => boardGroup.remove(p.mesh));
      innerWalls.forEach((w) => boardGroup.remove(w.mesh));
      pits.length = 0;
      innerWalls.length = 0;

      bx = -3.8;
      bz = 3.8;
      vx = 0;
      vz = 0;
      ball.position.set(bx, 0.42, bz);
      goal.position.set(3.6, 0.09, -3.6);
      boardGroup.rotation.set(0, 0, 0);

      const pitCount = Math.min(7, 3 + levelRef.current);
      for (let i = 0; i < pitCount; i++) {
        const px = ((i * 2.3 + levelRef.current * 1.1) % 6.6) - 3.3;
        const pz = (((i + 1) * 1.9 + levelRef.current * 0.7) % 6.6) - 3.3;
        if (Math.hypot(px - bx, pz - bz) < 1.6 || Math.hypot(px - 3.6, pz + 3.6) < 1.6) continue;
        const m = new THREE.Mesh(
          new THREE.CylinderGeometry(0.55, 0.55, 0.14, 18),
          new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xe11d48, emissiveIntensity: 1.1 })
        );
        m.position.set(px, 0.05, pz);
        boardGroup.add(m);
        pits.push({ mesh: m, x: px, z: pz });
      }

      const wallConfigs: [number, number, number, number][] = [
        [-1.5, 1.8, 3.4, 0.45],
        [1.5, -1.6, 3.4, 0.45],
        [0, 0, 0.45, 3.2],
      ];
      for (const [wx, wz, ww, wd] of wallConfigs) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(ww, 0.7, wd), wallMat);
        m.position.set(wx, 0.35, wz);
        boardGroup.add(m);
        innerWalls.push({ mesh: m, x: wx, z: wz, hw: ww / 2, hd: wd / 2 });
      }
    };

    buildLevel();
    resetLevelRef.current = buildLevel;

    const stopLoop = studio.start((delta) => {
      const dt = Math.min(delta, 0.05);

      const targetRotZ = -tiltInputRef.current.x * 0.22;
      const targetRotX = tiltInputRef.current.z * 0.22;
      boardGroup.rotation.z = THREE.MathUtils.damp(boardGroup.rotation.z, targetRotZ, 10, dt);
      boardGroup.rotation.x = THREE.MathUtils.damp(boardGroup.rotation.x, targetRotX, 10, dt);

      if (!runningRef.current) return;

      vx = (vx + tiltInputRef.current.x * 16 * dt) * 0.96;
      vz = (vz + tiltInputRef.current.z * 16 * dt) * 0.96;
      bx += vx * dt;
      bz += vz * dt;

      if (bx < -4.38) { bx = -4.38; vx = Math.abs(vx) * 0.5; }
      if (bx > 4.38) { bx = 4.38; vx = -Math.abs(vx) * 0.5; }
      if (bz < -4.38) { bz = -4.38; vz = Math.abs(vz) * 0.5; }
      if (bz > 4.38) { bz = 4.38; vz = -Math.abs(vz) * 0.5; }

      for (const w of innerWalls) {
        const cx = THREE.MathUtils.clamp(bx, w.x - w.hw, w.x + w.hw);
        const cz = THREE.MathUtils.clamp(bz, w.z - w.hd, w.z + w.hd);
        const dx = bx - cx;
        const dz = bz - cz;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.42 && dist > 0.0001) {
          const nx = dx / dist;
          const nz = dz / dist;
          bx = cx + nx * 0.42;
          bz = cz + nz * 0.42;
          if (Math.abs(nx) > Math.abs(nz)) vx *= -0.45;
          else vz *= -0.45;
        }
      }

      ball.position.set(bx, 0.42, bz);

      for (const p of pits) {
        if (Math.hypot(bx - p.x, bz - p.z) < 0.62) {
          runningRef.current = false;
          setGameOver(true);
          sound.playHit();
          onGameOverRef.current(scoreRef.current, Math.max(1, Math.floor(scoreRef.current / 25)));
          return;
        }
      }

      if (Math.hypot(bx - 3.6, bz + 3.6) < 0.78) {
        scoreRef.current += 50;
        levelRef.current += 1;
        setScore(scoreRef.current);
        setLevel(levelRef.current);
        sound.playVictory();
        buildLevel();
      }
    });

    return () => {
      stopLoop();
      studio.cleanup();
    };
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') tiltInputRef.current.x = -1;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') tiltInputRef.current.x = 1;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') tiltInputRef.current.z = -1;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') tiltInputRef.current.z = 1;
    };
    const up = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(e.code)) tiltInputRef.current.x = 0;
      if (['ArrowUp', 'KeyW', 'ArrowDown', 'KeyS'].includes(e.code)) tiltInputRef.current.z = 0;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-md mx-auto">
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-emerald-500/30 rounded-xl text-sm font-mono tabular-nums">
        <span className="text-emerald-400 font-bold">3D Labyrinth · Lvl {level}</span>
        <span className="text-amber-400">Score: {score}</span>
      </div>

      <div className="relative w-full h-[320px] rounded-2xl overflow-hidden border-2 border-emerald-500/40 bg-[#090814] touch-none select-none">
        <div
          ref={mountRef}
          className="w-full h-full touch-none"
          onPointerDown={(e) => {
            if (!runningRef.current) return;
            const rect = e.currentTarget.getBoundingClientRect();
            tiltInputRef.current.x = THREE.MathUtils.clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
            tiltInputRef.current.z = THREE.MathUtils.clamp(((e.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
          }}
          onPointerMove={(e) => {
            if (!runningRef.current || e.buttons === 0) return;
            const rect = e.currentTarget.getBoundingClientRect();
            tiltInputRef.current.x = THREE.MathUtils.clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
            tiltInputRef.current.z = THREE.MathUtils.clamp(((e.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
          }}
          onPointerUp={() => { tiltInputRef.current = { x: 0, z: 0 }; }}
          onPointerCancel={() => { tiltInputRef.current = { x: 0, z: 0 }; }}
        />

        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black text-rose-500 mb-1">FELL IN HAZARD!</h3>
                <p className="text-slate-300 text-sm mb-3">
                  Score: <span className="text-emerald-400 font-bold">{score}</span> · +{Math.max(1, Math.floor(score / 25))} Coins
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 text-black font-extrabold rounded-xl active:scale-95"
                >
                  <RotateCcw size={18} /> Retry Maze
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black text-emerald-400 mb-1">3D Tilt Labyrinth</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[240px]">
                  Tilt the 3D board to roll the chrome sphere into the green portal while dodging red traps!
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-7 py-3 bg-emerald-500 text-black font-extrabold rounded-xl shadow-lg shadow-emerald-500/30 active:scale-95"
                >
                  <Play size={18} fill="currentColor" /> Start Labyrinth
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 w-44">
        <div />
        <button
          onPointerDown={(e) => { e.preventDefault(); tiltInputRef.current.z = -1; }}
          onPointerUp={() => { tiltInputRef.current.z = 0; }}
          onPointerLeave={() => { tiltInputRef.current.z = 0; }}
          className="h-12 bg-slate-800 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-400 active:bg-emerald-500 active:text-black touch-none select-none"
        ><ArrowUp size={20} /></button>
        <div />
        <button
          onPointerDown={(e) => { e.preventDefault(); tiltInputRef.current.x = -1; }}
          onPointerUp={() => { tiltInputRef.current.x = 0; }}
          onPointerLeave={() => { tiltInputRef.current.x = 0; }}
          className="h-12 bg-slate-800 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-400 active:bg-emerald-500 active:text-black touch-none select-none"
        ><ArrowLeft size={20} /></button>
        <button
          onPointerDown={(e) => { e.preventDefault(); tiltInputRef.current.z = 1; }}
          onPointerUp={() => { tiltInputRef.current.z = 0; }}
          onPointerLeave={() => { tiltInputRef.current.z = 0; }}
          className="h-12 bg-slate-800 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-400 active:bg-emerald-500 active:text-black touch-none select-none"
        ><ArrowDown size={20} /></button>
        <button
          onPointerDown={(e) => { e.preventDefault(); tiltInputRef.current.x = 1; }}
          onPointerUp={() => { tiltInputRef.current.x = 0; }}
          onPointerLeave={() => { tiltInputRef.current.x = 0; }}
          className="h-12 bg-slate-800 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-400 active:bg-emerald-500 active:text-black touch-none select-none"
        ><ArrowRight size={20} /></button>
      </div>
    </div>
  );
};
