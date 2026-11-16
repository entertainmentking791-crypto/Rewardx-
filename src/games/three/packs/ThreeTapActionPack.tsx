import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../../services/audio';
import { createStudioContext } from '../threeUtils';
import { Play, RotateCcw } from 'lucide-react';

export type TapActionVariant = 'sniper' | 'ninja' | 'whack' | 'piano';

interface Props {
  variant: TapActionVariant;
  onGameOver: (score: number, coinsEarned: number) => void;
}

const META: Record<TapActionVariant, { title: string; sub: string; accent: string }> = {
  sniper: { title: '3D Drone Sniper', sub: 'Tap hovering 3D target drones across the cyber range before the 35s timer ends!', accent: '#38bdf8' },
  ninja: { title: '3D Blade Slice', sub: 'Tap flying glowing 3D cyber fruits for combos—never tap the spiked red bombs!', accent: '#ec4899' },
  whack: { title: '3D Bot Whacker', sub: 'Tap popping 3D cyber bots & golden orbs out of the 9 neon pods before they hide!', accent: '#f59e0b' },
  piano: { title: '3D Rhythm Tiles', sub: 'Tap falling neon 3D rhythm blocks across the 4 lanes before they cross the bottom line!', accent: '#a855f7' },
};

export const ThreeTapActionPack: React.FC<Props> = ({ variant, onGameOver }) => {
  const m = META[variant];
  const mountRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(35);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const actorsRef = useRef<{ mesh: THREE.Mesh; active: boolean; isBomb: boolean; vx: number; vy: number; ttl: number; lane: number }[]>([]);
  const runningRef = useRef(false);
  const scoreRef = useRef(0);
  const timeRef = useRef(35);
  const resetRef = useRef<() => void>(() => {});
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    timeRef.current = 35;
    runningRef.current = true;
    resetRef.current();
    setScore(0);
    setTimeLeft(35);
    setGameOver(false);
    setStarted(true);
    sound.playClick();
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, { fov: 50, bgColor: 0x070915, fogNear: 18, fogFar: 55 });
    const { scene, camera } = studio;
    camera.position.set(0, variant === 'whack' ? 5.6 : variant === 'piano' ? 5.0 : 2.6, 8.2);
    camera.lookAt(0, variant === 'whack' ? 0 : 1.0, 0);
    cameraRef.current = camera;

    if (variant === 'whack') {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(5.6, 0.3, 5.6),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 })
      );
      base.position.y = -0.15;
      scene.add(base);
      const podGeo = new THREE.CylinderGeometry(0.62, 0.72, 0.25, 18);
      const podMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
      for (let i = 0; i < 9; i++) {
        const r = Math.floor(i / 3), c = i % 3;
        const pod = new THREE.Mesh(podGeo, podMat);
        pod.position.set((c - 1) * 1.75, 0.12, (r - 1) * 1.75);
        scene.add(pod);
      }
    } else if (variant === 'piano') {
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(5.6, 0.2, 11),
        new THREE.MeshStandardMaterial({ color: 0x0f172a })
      );
      board.position.set(0, -0.1, -1);
      scene.add(board);
      const hitBar = new THREE.Mesh(
        new THREE.BoxGeometry(5.6, 0.08, 0.25),
        new THREE.MeshBasicMaterial({ color: 0x22d3ee })
      );
      hitBar.position.set(0, 0.05, 3.2);
      scene.add(hitBar);
    }

    actorsRef.current = [];
    const count = variant === 'whack' ? 9 : 10;
    for (let i = 0; i < count; i++) {
      const isBomb = variant === 'ninja' && i % 4 === 3;
      const geo =
        variant === 'piano'
          ? new THREE.BoxGeometry(1.15, 0.32, 1.35)
          : variant === 'whack'
          ? new THREE.CylinderGeometry(0.45, 0.45, 0.8, 16)
          : isBomb
          ? new THREE.OctahedronGeometry(0.55)
          : new THREE.SphereGeometry(0.55, 18, 18);
      const mat = new THREE.MeshPhysicalMaterial({
        color: isBomb ? 0xef4444 : i % 2 === 0 ? 0x22d3ee : 0xfacc15,
        emissive: isBomb ? 0x991b1b : 0x0f172a,
        emissiveIntensity: 0.45,
        clearcoat: 1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.userData = { actorIdx: i };
      scene.add(mesh);
      actorsRef.current.push({ mesh, active: false, isBomb, vx: 0, vy: 0, ttl: 0, lane: i % 4 });
    }

    let spawnCd = 0;
    let secAcc = 0;

    resetRef.current = () => {
      spawnCd = 0.2;
      secAcc = 0;
      actorsRef.current.forEach((a) => {
        a.active = false;
        a.mesh.visible = false;
      });
    };

    const stopLoop = studio.start((delta) => {
      const dt = Math.min(delta, 0.05);
      if (!runningRef.current) return;

      secAcc += dt;
      if (secAcc >= 1) {
        secAcc -= 1;
        timeRef.current = Math.max(0, timeRef.current - 1);
        setTimeLeft(timeRef.current);
        if (timeRef.current <= 0) {
          runningRef.current = false;
          setGameOver(true);
          sound.playVictory();
          onGameOverRef.current(scoreRef.current, Math.max(3, Math.floor(scoreRef.current / 25)));
          return;
        }
      }

      spawnCd -= dt;
      if (spawnCd <= 0) {
        spawnCd = variant === 'piano' ? 0.55 : 0.62;
        if (variant === 'whack') {
          const idx = Math.floor(Math.random() * 9);
          const slot = actorsRef.current[idx];
          if (!slot.active) {
            slot.active = true;
            slot.ttl = 1.25;
            const r = Math.floor(idx / 3), c = idx % 3;
            slot.mesh.position.set((c - 1) * 1.75, 0.65, (r - 1) * 1.75);
            slot.mesh.visible = true;
          }
        } else {
          const slot = actorsRef.current.find((a) => !a.active);
          if (slot) {
            slot.active = true;
            slot.ttl = 3.5;
            if (variant === 'piano') {
              slot.lane = Math.floor(Math.random() * 4);
              slot.mesh.position.set((slot.lane - 1.5) * 1.32, 0.25, -5.8);
            } else if (variant === 'ninja') {
              slot.mesh.position.set((Math.random() - 0.5) * 4.5, -1.5, 0);
              slot.vx = (Math.random() - 0.5) * 2.4;
              slot.vy = 7.8 + Math.random() * 2.2;
            } else {
              // sniper
              slot.mesh.position.set((Math.random() - 0.5) * 5.2, 0.4 + Math.random() * 2.5, -2 - Math.random() * 3);
              slot.vx = (Math.random() > 0.5 ? 1 : -1) * (1.8 + Math.random() * 1.8);
            }
            slot.mesh.visible = true;
          }
        }
      }

      for (const a of actorsRef.current) {
        if (!a.active) continue;
        a.ttl -= dt;
        if (variant === 'piano') {
          a.mesh.position.z += 5.4 * dt;
          if (a.mesh.position.z > 4.2) {
            a.active = false;
            a.mesh.visible = false;
          }
        } else if (variant === 'ninja') {
          a.vy -= 10.5 * dt;
          a.mesh.position.x += a.vx * dt;
          a.mesh.position.y += a.vy * dt;
          a.mesh.rotation.y += dt * 4;
          if (a.mesh.position.y < -2.4) {
            a.active = false;
            a.mesh.visible = false;
          }
        } else if (variant === 'sniper') {
          a.mesh.position.x += a.vx * dt;
          if (Math.abs(a.mesh.position.x) > 3.2) a.vx = -a.vx;
          if (a.ttl <= 0) {
            a.active = false;
            a.mesh.visible = false;
          }
        } else if (variant === 'whack') {
          if (a.ttl <= 0) {
            a.active = false;
            a.mesh.visible = false;
          }
        }
      }
    });

    return () => {
      stopLoop();
      studio.cleanup();
    };
  }, [variant]);

  const handleTapActor = (actorIdx: number) => {
    const a = actorsRef.current[actorIdx];
    if (!a || !a.active || !runningRef.current) return;
    a.active = false;
    a.mesh.visible = false;
    if (a.isBomb) {
      scoreRef.current = Math.max(0, scoreRef.current - 30);
      setScore(scoreRef.current);
      sound.playExplosion();
    } else {
      scoreRef.current += 25;
      setScore(scoreRef.current);
      sound.playCoin();
    }
  };

  const handlePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!runningRef.current || !cameraRef.current || !mountRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, cameraRef.current);
    const activeMeshes = actorsRef.current.filter((a) => a.active).map((a) => a.mesh);
    const hits = raycaster.intersectObjects(activeMeshes, false);
    if (hits.length > 0) {
      const idx = hits[0].object.userData?.actorIdx;
      if (typeof idx === 'number') handleTapActor(idx);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2.5 w-full max-w-md mx-auto">
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-white/15 rounded-xl text-xs font-mono tabular-nums">
        <span className="font-bold" style={{ color: m.accent }}>{timeLeft}s Left</span>
        <span className="text-amber-400 font-bold">Score: {score}</span>
      </div>

      <div
        className="relative w-full h-[350px] rounded-2xl overflow-hidden border-2 bg-[#070915] touch-none select-none"
        style={{ borderColor: `${m.accent}66` }}
        onPointerDown={handlePointer}
      >
        <div ref={mountRef} className="w-full h-full touch-none" />
        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black mb-1" style={{ color: m.accent }}>TIME UP!</h3>
                <p className="text-slate-300 text-sm mb-3">Score: {score} · +{Math.max(3, Math.floor(score / 25))} Coins</p>
                <button onClick={(e) => { e.stopPropagation(); startGame(); }} className="flex items-center gap-2 px-6 py-2.5 text-black font-extrabold rounded-xl active:scale-95" style={{ backgroundColor: m.accent }}>
                  <RotateCcw size={18} /> Play Again
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black mb-1" style={{ color: m.accent }}>{m.title}</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[250px]">{m.sub}</p>
                <button onClick={(e) => { e.stopPropagation(); startGame(); }} className="flex items-center gap-2 px-7 py-3 text-black font-extrabold rounded-xl shadow-lg active:scale-95" style={{ backgroundColor: m.accent }}>
                  <Play size={18} fill="currentColor" /> Start 35s Rush
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {variant === 'piano' ? (
        <div className="grid grid-cols-4 gap-2 w-full">
          {[0, 1, 2, 3].map((lane) => (
            <button
              key={lane}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                const hit = actorsRef.current.find((a) => a.active && a.lane === lane && a.mesh.position.z > 0.2);
                if (hit) handleTapActor(hit.mesh.userData.actorIdx);
              }}
              className="h-12 rounded-xl bg-purple-600/80 active:bg-purple-400 text-white font-black text-xs touch-none"
            >
              LANE {lane + 1}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400">Tap targets directly in the 3D arena!</p>
      )}
    </div>
  );
};
