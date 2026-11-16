import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../../services/audio';
import { createStudioContext } from '../threeUtils';
import { ArrowLeft, ArrowRight, ArrowUp, Play, RotateCcw } from 'lucide-react';

export type ReflexVariant = 'helix' | 'color-ring' | 'flappy' | 'sky-hop' | 'crossy';

interface Props {
  variant: ReflexVariant;
  onGameOver: (score: number, coinsEarned: number) => void;
}

const META: Record<ReflexVariant, { title: string; sub: string; accent: string }> = {
  helix: { title: '3D Helix Spiral', sub: 'Rotate the 3D helix tower so the bouncing sphere drops cleanly through open green gaps!', accent: '#8b5cf6' },
  'color-ring': { title: '3D Chroma Ring', sub: 'Tap to hop your glowing orb through rotating rainbow gates matching your orb color!', accent: '#f43f5e' },
  flappy: { title: '3D Flappy Drone', sub: 'Tap to pulse your quadcopter thrusters and weave between neon vertical laser pillars!', accent: '#06b6d4' },
  'sky-hop': { title: '3D Sky Hopper', sub: 'Steer left/right as the sphere auto-bounces from one floating 3D sky pad to the next!', accent: '#10b981' },
  crossy: { title: '3D Crossy Hop', sub: 'Tap Hop Forward and Left/Right to cross busy neon traffic lanes without getting hit!', accent: '#f59e0b' },
};

export const ThreeReflexPack: React.FC<Props> = ({ variant, onGameOver }) => {
  const m = META[variant];
  const mountRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const runningRef = useRef(false);
  const scoreRef = useRef(0);
  const inputXRef = useRef(0);
  const pulseTriggerRef = useRef(false);
  const resetRef = useRef<() => void>(() => {});
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const triggerAction = useCallback(() => {
    if (!runningRef.current) return;
    pulseTriggerRef.current = true;
    sound.playJump();
  }, []);

  const nudgeX = useCallback((dx: number) => {
    if (!runningRef.current) return;
    inputXRef.current = THREE.MathUtils.clamp(inputXRef.current + dx, -3.2, 3.2);
    sound.playMove();
  }, []);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    inputXRef.current = 0;
    pulseTriggerRef.current = false;
    runningRef.current = true;
    resetRef.current();
    setScore(0);
    setGameOver(false);
    setStarted(true);
    sound.playClick();
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, { fov: 55, bgColor: 0x070815, fogNear: 18, fogFar: 60 });
    const { scene, camera } = studio;
    camera.position.set(0, variant === 'crossy' ? 6.5 : 3.2, 9.2);
    camera.lookAt(0, variant === 'crossy' ? 0 : 0.8, 0);

    const player = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 20, 20),
      new THREE.MeshPhysicalMaterial({ color: 0x22d3ee, emissive: 0x0891b2, emissiveIntensity: 0.7, clearcoat: 1 })
    );
    scene.add(player);

    // Variant pools
    const pipes: { top: THREE.Mesh; bot: THREE.Mesh; x: number; scored: boolean }[] = [];
    const pads: { mesh: THREE.Mesh; y: number; passed: boolean }[] = [];
    const cars: { mesh: THREE.Mesh; z: number; speed: number }[] = [];

    if (variant === 'flappy') {
      const pMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x065f46, emissiveIntensity: 0.5 });
      for (let i = 0; i < 4; i++) {
        const top = new THREE.Mesh(new THREE.BoxGeometry(1.0, 5.0, 1.0), pMat);
        const bot = new THREE.Mesh(new THREE.BoxGeometry(1.0, 5.0, 1.0), pMat);
        scene.add(top, bot);
        pipes.push({ top, bot, x: 7 + i * 5.2, scored: false });
      }
    } else if (variant === 'crossy') {
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 60), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(0, -0.35, -18);
      scene.add(floor);
      const carMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0x881337, emissiveIntensity: 0.45 });
      for (let i = 0; i < 8; i++) {
        const car = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 0.9), carMat);
        scene.add(car);
        cars.push({ mesh: car, z: -4 - i * 3.5, speed: (i % 2 === 0 ? 1 : -1) * (3.2 + (i % 3) * 1.1) });
      }
    } else {
      // helix / color-ring / sky-hop floating rings/platforms
      for (let i = 0; i < 6; i++) {
        const isRing = variant === 'color-ring' || variant === 'helix';
        const mesh = isRing
          ? new THREE.Mesh(
              new THREE.TorusGeometry(1.4, 0.18, 10, 24, variant === 'helix' ? Math.PI * 1.45 : Math.PI * 2),
              new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0xa855f7 : 0x22d3ee, emissive: 0x3b0764, emissiveIntensity: 0.5 })
            )
          : new THREE.Mesh(
              new THREE.BoxGeometry(2.0, 0.25, 1.4),
              new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x065f46, emissiveIntensity: 0.4 })
            );
        if (isRing) mesh.rotation.x = Math.PI / 2;
        scene.add(mesh);
        pads.push({ mesh, y: 0, passed: false });
      }
    }

    let py = 1.2, pvy = 0, pz = 4;

    resetRef.current = () => {
      py = variant === 'flappy' ? 1.2 : 0.4;
      pvy = 0;
      pz = 4;
      player.position.set(variant === 'flappy' ? -2.2 : 0, py, variant === 'crossy' ? pz : 0);
      pipes.forEach((p, i) => {
        p.x = 7 + i * 5.2;
        p.scored = false;
        const gapY = (Math.random() - 0.5) * 2.4 + 1.0;
        p.top.position.set(p.x, gapY + 3.9, 0);
        p.bot.position.set(p.x, gapY - 3.9, 0);
      });
      cars.forEach((c, i) => {
        c.mesh.position.set((Math.random() - 0.5) * 7, 0.1, c.z);
        c.z = -3 - i * 3.5;
        c.mesh.position.z = c.z;
      });
      pads.forEach((pd, i) => {
        pd.passed = false;
        if (variant === 'helix') {
          pd.mesh.position.set(0, -i * 2.2, 0);
          pd.mesh.rotation.z = i * 0.9;
        } else if (variant === 'color-ring') {
          pd.mesh.position.set(0, 2.5 + i * 3.4, 0);
        } else {
          pd.mesh.position.set((Math.random() - 0.5) * 3.8, i * 2.1, 0);
        }
      });
    };

    resetRef.current();

    const stopLoop = studio.start((delta, elapsed) => {
      const dt = Math.min(delta, 0.05);
      if (!runningRef.current) return;

      if (variant === 'flappy') {
        if (pulseTriggerRef.current) {
          pulseTriggerRef.current = false;
          pvy = 7.4;
        }
        pvy -= 18 * dt;
        py += pvy * dt;
        player.position.set(-2.2, py, 0);
        if (py < -3.6 || py > 5.4) {
          runningRef.current = false;
          setGameOver(true);
          sound.playHit();
          onGameOverRef.current(scoreRef.current, Math.max(2, Math.floor(scoreRef.current / 20)));
          return;
        }
        for (const p of pipes) {
          p.x -= 4.6 * dt;
          p.top.position.x = p.x;
          p.bot.position.x = p.x;
          if (!p.scored && p.x < -2.2) {
            p.scored = true;
            scoreRef.current += 20;
            setScore(scoreRef.current);
            sound.playCoin();
          }
          if (Math.abs(p.x - -2.2) < 0.8) {
            const gapMid = (p.top.position.y + p.bot.position.y) / 2;
            if (Math.abs(py - gapMid) > 1.05) {
              runningRef.current = false;
              setGameOver(true);
              sound.playHit();
              onGameOverRef.current(scoreRef.current, Math.max(2, Math.floor(scoreRef.current / 20)));
              return;
            }
          }
          if (p.x < -9.5) {
            p.x += 4 * 5.2;
            p.scored = false;
            const gapY = (Math.random() - 0.5) * 2.4 + 1.0;
            p.top.position.y = gapY + 3.9;
            p.bot.position.y = gapY - 3.9;
          }
        }
      } else if (variant === 'crossy') {
        if (pulseTriggerRef.current) {
          pulseTriggerRef.current = false;
          pz -= 3.5;
          scoreRef.current += 25;
          setScore(scoreRef.current);
          sound.playCoin();
          camera.position.z = pz + 6.8;
          camera.lookAt(0, 0, pz - 2);
        }
        player.position.x = THREE.MathUtils.damp(player.position.x, inputXRef.current, 14, dt);
        player.position.z = THREE.MathUtils.damp(player.position.z, pz, 14, dt);
        player.position.y = 0.25 + Math.abs(Math.sin(elapsed * 5)) * 0.12;

        for (const c of cars) {
          c.mesh.position.x += c.speed * dt;
          if (c.mesh.position.x > 6.5) c.mesh.position.x = -6.5;
          if (c.mesh.position.x < -6.5) c.mesh.position.x = 6.5;
          if (c.mesh.position.z > pz + 8) {
            c.z -= 28;
            c.mesh.position.z = c.z;
          }
          if (Math.abs(c.mesh.position.z - player.position.z) < 0.72 && Math.abs(c.mesh.position.x - player.position.x) < 1.0) {
            runningRef.current = false;
            setGameOver(true);
            sound.playHit();
            onGameOverRef.current(scoreRef.current, Math.max(2, Math.floor(scoreRef.current / 22)));
            return;
          }
        }
      } else {
        // helix / color-ring / sky-hop
        if (variant === 'color-ring') {
          if (pulseTriggerRef.current) {
            pulseTriggerRef.current = false;
            pvy = 7.2;
          }
          pvy -= 17 * dt;
          py += pvy * dt;
          player.position.y = py;
          camera.position.y = THREE.MathUtils.damp(camera.position.y, py + 1.4, 6, dt);
          camera.lookAt(0, py + 0.4, 0);
          for (const pd of pads) {
            pd.mesh.rotation.z += dt * 1.4;
            if (!pd.passed && py > pd.mesh.position.y) {
              pd.passed = true;
              scoreRef.current += 25;
              setScore(scoreRef.current);
              sound.playCoin();
            }
            if (pd.mesh.position.y < py - 5) {
              pd.mesh.position.y += 6 * 3.4;
              pd.passed = false;
            }
          }
          if (py < camera.position.y - 6.5) {
            runningRef.current = false;
            setGameOver(true);
            sound.playHit();
            onGameOverRef.current(scoreRef.current, Math.max(2, Math.floor(scoreRef.current / 22)));
          }
        } else if (variant === 'helix') {
          py -= 2.2 * dt;
          player.position.set(0, py + Math.abs(Math.sin(elapsed * 6)) * 0.55, 0.9);
          camera.position.y = py + 3.2;
          camera.lookAt(0, py - 1, 0);
          for (const pd of pads) {
            pd.mesh.rotation.z = inputXRef.current * 0.9 + elapsed * 0.4;
            if (!pd.passed && py < pd.mesh.position.y) {
              pd.passed = true;
              scoreRef.current += 20;
              setScore(scoreRef.current);
              sound.playCoin();
            }
            if (pd.mesh.position.y > py + 4) {
              pd.mesh.position.y -= 6 * 2.2;
              pd.passed = false;
            }
          }
        } else {
          // sky-hop
          pvy -= 15 * dt;
          py += pvy * dt;
          player.position.x = THREE.MathUtils.damp(player.position.x, inputXRef.current, 12, dt);
          player.position.y = py;
          camera.position.y = Math.max(2.5, py + 1.5);
          camera.lookAt(0, Math.max(0.5, py), 0);

          for (const pd of pads) {
            if (pvy < 0 && Math.abs(py - pd.mesh.position.y) < 0.55 && Math.abs(player.position.x - pd.mesh.position.x) < 1.2) {
              pvy = 8.4;
              sound.playJump();
              if (!pd.passed) {
                pd.passed = true;
                scoreRef.current += 25;
                setScore(scoreRef.current);
              }
            }
            if (pd.mesh.position.y < py - 5) {
              pd.mesh.position.y += 6 * 2.1;
              pd.mesh.position.x = (Math.random() - 0.5) * 4.2;
              pd.passed = false;
            }
          }
          if (py < camera.position.y - 6.5) {
            runningRef.current = false;
            setGameOver(true);
            sound.playHit();
            onGameOverRef.current(scoreRef.current, Math.max(2, Math.floor(scoreRef.current / 22)));
          }
        }
      }
    });

    return () => {
      stopLoop();
      studio.cleanup();
    };
  }, [variant]);

  const needsTapAction = variant === 'flappy' || variant === 'color-ring' || variant === 'crossy';
  const needsLR = variant === 'helix' || variant === 'sky-hop' || variant === 'crossy';

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-md mx-auto">
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-white/15 rounded-xl text-xs font-mono tabular-nums">
        <span className="font-bold" style={{ color: m.accent }}>{m.title}</span>
        <span className="text-amber-400 font-bold">Score: {score}</span>
      </div>

      <div
        className="relative w-full h-[350px] rounded-2xl overflow-hidden border-2 bg-[#070815] touch-none select-none"
        style={{ borderColor: `${m.accent}66` }}
        onPointerDown={() => { if (needsTapAction) triggerAction(); }}
      >
        <div ref={mountRef} className="w-full h-full touch-none" />
        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black mb-1" style={{ color: m.accent }}>GAME OVER!</h3>
                <p className="text-slate-300 text-sm mb-3">Score: {score} · +{Math.max(2, Math.floor(score / 22))} Coins</p>
                <button onClick={(e) => { e.stopPropagation(); startGame(); }} className="flex items-center gap-2 px-6 py-2.5 text-black font-extrabold rounded-xl active:scale-95" style={{ backgroundColor: m.accent }}>
                  <RotateCcw size={18} /> Try Again
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black mb-1" style={{ color: m.accent }}>{m.title}</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[250px]">{m.sub}</p>
                <button onClick={(e) => { e.stopPropagation(); startGame(); }} className="flex items-center gap-2 px-7 py-3 text-black font-extrabold rounded-xl shadow-lg active:scale-95" style={{ backgroundColor: m.accent }}>
                  <Play size={18} fill="currentColor" /> Start 3D Reflex
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className={`grid ${needsLR && needsTapAction ? 'grid-cols-3' : needsLR ? 'grid-cols-2' : 'grid-cols-1'} gap-2.5 w-full max-w-[300px]`}>
        {needsLR && (
          <button onPointerDown={(e) => { e.preventDefault(); nudgeX(-0.85); }} className="h-14 rounded-xl bg-slate-800 border border-white/15 flex items-center justify-center text-white active:scale-95 touch-none">
            <ArrowLeft size={22} />
          </button>
        )}
        {needsTapAction && (
          <button onPointerDown={(e) => { e.preventDefault(); triggerAction(); }} className="h-14 rounded-xl text-black font-black text-sm flex items-center justify-center gap-1 active:scale-95 touch-none" style={{ backgroundColor: m.accent }}>
            <ArrowUp size={20} /> {variant === 'crossy' ? 'HOP' : 'BOOST'}
          </button>
        )}
        {needsLR && (
          <button onPointerDown={(e) => { e.preventDefault(); nudgeX(0.85); }} className="h-14 rounded-xl bg-slate-800 border border-white/15 flex items-center justify-center text-white active:scale-95 touch-none">
            <ArrowRight size={22} />
          </button>
        )}
      </div>
    </div>
  );
};
