import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../services/audio';
import { createStudioContext } from './threeUtils';
import { ArrowLeft, ArrowRight, Play, RotateCcw } from 'lucide-react';

interface Props {
  onGameOver: (score: number, coinsEarned: number) => void;
}

export const ThreeTunnelRush: React.FC<Props> = ({ onGameOver }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const steerInputRef = useRef(0);
  const runningRef = useRef(false);
  const scoreRef = useRef(0);
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;
  const resetRef = useRef<() => void>(() => {});
  const dragXRef = useRef<number | null>(null);

  const startGame = useCallback(() => {
    resetRef.current();
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
      fov: 72,
      bgColor: 0x060414,
      fogNear: 12,
      fogFar: 62,
    });
    const { scene, camera } = studio;
    camera.position.set(0, 0, 2);

    // Tunnel rings
    const ringGeo = new THREE.TorusGeometry(4.2, 0.14, 8, 8);
    const ringMats = [
      new THREE.MeshStandardMaterial({ color: 0x8b5cf6, emissive: 0x7c3aed, emissiveIntensity: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x0891b2, emissiveIntensity: 0.9 }),
    ];
    const tunnelRings: THREE.Mesh[] = [];
    for (let i = 0; i < 16; i++) {
      const ring = new THREE.Mesh(ringGeo, ringMats[i % 2]);
      ring.position.z = -i * 4.5;
      ring.rotation.z = i * 0.12;
      scene.add(ring);
      tunnelRings.push(ring);
    }

    // Player hover pod (composite 4-part)
    const pod = new THREE.Group();
    const podMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0ea5e9, emissiveIntensity: 0.9, metalness: 0.7, roughness: 0.2 });
    const podBody = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 6), podMat);
    podBody.rotation.x = -Math.PI / 2;
    const podWing = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.35), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 }));
    const podCore = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 1.5 }));
    podCore.position.z = 0.22;
    pod.add(podBody, podWing, podCore);
    scene.add(pod);

    interface GateBarrier {
      group: THREE.Group;
      z: number;
      angle: number;
      span: number;
      passed: boolean;
    }

    const barriers: GateBarrier[] = [];
    let playerAngle = -Math.PI / 2;
    let speed = 18;
    let spawnTimer = 0.6;
    let dist = 0;

    const createBarrier = (z: number, spinDir: number): GateBarrier => {
      const group = new THREE.Group();
      const angle = Math.random() * Math.PI * 2;
      const span = Math.PI * 0.85; // blocked arc ~153 degrees
      const barGeo = new THREE.BoxGeometry(2.8, 1.35, 0.55);
      const barMat = new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xe11d48,
        emissiveIntensity: 1.15,
        roughness: 0.3,
      });
      const panel1 = new THREE.Mesh(barGeo, barMat);
      panel1.position.set(Math.cos(angle) * 2.4, Math.sin(angle) * 2.4, 0);
      panel1.rotation.z = angle + Math.PI / 2;
      const panel2 = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 1.1, 0.55),
        barMat
      );
      const opp = angle + 0.72 * spinDir;
      panel2.position.set(Math.cos(opp) * 2.5, Math.sin(opp) * 2.5, 0);
      panel2.rotation.z = opp + Math.PI / 2;

      group.add(panel1, panel2);
      group.position.z = z;
      scene.add(group);
      return { group, z, angle: angle + 0.36 * spinDir, span, passed: false };
    };

    resetRef.current = () => {
      barriers.forEach((b) => scene.remove(b.group));
      barriers.length = 0;
      playerAngle = -Math.PI / 2;
      speed = 18;
      spawnTimer = 0.7;
      dist = 0;
    };

    const normalizeAngleDiff = (a: number, b: number) => {
      let diff = ((a - b + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (diff < -Math.PI) diff += Math.PI * 2;
      return Math.abs(diff);
    };

    const stopLoop = studio.start((delta) => {
      const dt = Math.min(delta, 0.05);

      for (const ring of tunnelRings) {
        ring.position.z += (runningRef.current ? speed : 8) * dt;
        ring.rotation.z += dt * 0.4;
        if (ring.position.z > 4) {
          ring.position.z -= 16 * 4.5;
        }
      }

      if (runningRef.current) {
        playerAngle += steerInputRef.current * dt * 3.1;
        speed = Math.min(36, speed + dt * 0.5);
        dist += dt * 12;
        const nextScore = Math.floor(dist);
        if (nextScore !== scoreRef.current) {
          scoreRef.current = nextScore;
          setScore(nextScore);
        }

        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          barriers.push(createBarrier(-64, Math.random() > 0.5 ? 1 : -1));
          spawnTimer = Math.max(0.55, 1.25 - (speed - 18) * 0.03);
        }

        for (let i = barriers.length - 1; i >= 0; i--) {
          const b = barriers[i];
          b.z += speed * dt;
          b.group.position.z = b.z;
          b.group.rotation.z += dt * 0.55;
          b.angle += dt * 0.55;

          if (!b.passed && b.z > -1.3 && b.z < -0.3) {
            if (normalizeAngleDiff(playerAngle, b.angle) < b.span * 0.52) {
              runningRef.current = false;
              setGameOver(true);
              sound.playHit();
              const earned = Math.max(1, Math.floor(scoreRef.current / 25));
              onGameOverRef.current(scoreRef.current, earned);
              break;
            }
          }

          if (!b.passed && b.z >= -0.2) {
            b.passed = true;
            dist += 15;
            sound.playMove();
          }

          if (b.z > 6) {
            scene.remove(b.group);
            barriers.splice(i, 1);
          }
        }
      }

      const r = 2.65;
      pod.position.set(Math.cos(playerAngle) * r, Math.sin(playerAngle) * r, -1.0);
      pod.rotation.z = playerAngle + Math.PI / 2;

      camera.position.x = THREE.MathUtils.damp(camera.position.x, pod.position.x * 0.48, 8, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, pod.position.y * 0.48, 8, dt);
      camera.lookAt(pod.position.x * 0.3, pod.position.y * 0.3, -16);
    });

    return () => {
      stopLoop();
      studio.cleanup();
    };
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) e.preventDefault();
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') steerInputRef.current = -1;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') steerInputRef.current = 1;
    };
    const up = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(e.code)) steerInputRef.current = 0;
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
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-purple-500/30 rounded-xl text-sm font-mono tabular-nums">
        <span className="text-purple-400 font-bold">3D Tunnel · {score}</span>
        <span className="text-amber-400">+{Math.floor(score / 25)} Coins</span>
      </div>

      <div className="relative w-full h-[360px] rounded-2xl overflow-hidden border-2 border-purple-500/40 bg-[#060414] touch-none select-none">
        <div
          ref={mountRef}
          className="w-full h-full touch-none"
          onPointerDown={(e) => {
            dragXRef.current = e.clientX;
            const rect = e.currentTarget.getBoundingClientRect();
            steerInputRef.current = e.clientX - rect.left < rect.width / 2 ? -1 : 1;
          }}
          onPointerMove={(e) => {
            if (dragXRef.current !== null) {
              const dx = e.clientX - dragXRef.current;
              if (Math.abs(dx) > 6) {
                steerInputRef.current = dx > 0 ? 1 : -1;
                dragXRef.current = e.clientX;
              }
            }
          }}
          onPointerUp={() => { dragXRef.current = null; steerInputRef.current = 0; }}
          onPointerCancel={() => { dragXRef.current = null; steerInputRef.current = 0; }}
        />

        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black text-rose-500 mb-1">GATE IMPACT!</h3>
                <p className="text-slate-300 text-sm mb-3">
                  Distance: <span className="text-purple-400 font-bold">{score}</span> · +{Math.max(1, Math.floor(score / 25))} Coins
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-6 py-2.5 bg-purple-500 text-white font-extrabold rounded-xl active:scale-95"
                >
                  <RotateCcw size={18} /> Fly Again
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black text-purple-400 mb-1">3D Cyber Tunnel</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[240px]">
                  Hold Left/Right or drag around the glowing 3D tunnel to dodge rotating laser barriers!
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-7 py-3 bg-purple-500 text-white font-extrabold rounded-xl shadow-lg shadow-purple-500/30 active:scale-95"
                >
                  <Play size={18} fill="currentColor" /> Enter Tunnel
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-[280px]">
        <button
          onPointerDown={(e) => { e.preventDefault(); steerInputRef.current = -1; }}
          onPointerUp={() => { steerInputRef.current = 0; }}
          onPointerLeave={() => { steerInputRef.current = 0; }}
          onPointerCancel={() => { steerInputRef.current = 0; }}
          className="h-14 rounded-xl bg-slate-800 border border-purple-500/30 flex items-center justify-center gap-2 text-purple-300 font-bold active:bg-purple-500 active:text-white touch-none select-none"
        >
          <ArrowLeft size={22} /> ROTATE L
        </button>
        <button
          onPointerDown={(e) => { e.preventDefault(); steerInputRef.current = 1; }}
          onPointerUp={() => { steerInputRef.current = 0; }}
          onPointerLeave={() => { steerInputRef.current = 0; }}
          onPointerCancel={() => { steerInputRef.current = 0; }}
          className="h-14 rounded-xl bg-slate-800 border border-purple-500/30 flex items-center justify-center gap-2 text-purple-300 font-bold active:bg-purple-500 active:text-white touch-none select-none"
        >
          ROTATE R <ArrowRight size={22} />
        </button>
      </div>
    </div>
  );
};
