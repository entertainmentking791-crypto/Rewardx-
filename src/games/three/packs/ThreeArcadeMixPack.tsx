import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../../services/audio';
import { build3DCoin, createStudioContext, makeCanvasTexture } from '../threeUtils';
import { ArrowLeft, ArrowRight, ArrowUp, Play, RotateCcw } from 'lucide-react';

export type ArcadeMixVariant = 'coin-magnet' | 'orb-catcher' | 'meteor-dodge' | 'cube-2048' | 'bubble-pop';

interface Props {
  variant: ArcadeMixVariant;
  onGameOver: (score: number, coinsEarned: number) => void;
}

const META: Record<ArcadeMixVariant, { title: string; sub: string; accent: string; isShooter?: boolean }> = {
  'coin-magnet': { title: '3D Coin Rush', sub: 'Slide your magnet cart catching raining 3D gold coins and dodging explosive skull bombs!', accent: '#f59e0b' },
  'orb-catcher': { title: '3D Star Catcher', sub: 'Catch glowing cosmic orbs in your 3D energy bowl while avoiding dark matter hazards!', accent: '#ec4899' },
  'meteor-dodge': { title: '3D Meteor Dodge', sub: 'Steer your cyber drone dodging falling flaming 3D meteors & grabbing blue shields!', accent: '#ef4444' },
  'cube-2048': { title: '3D Merge Cubes', sub: 'Aim lane and launch numbered 3D cubes forward to collide & merge matching values!', accent: '#eab308', isShooter: true },
  'bubble-pop': { title: '3D Bubble Blaster', sub: 'Aim & fire glowing 3D energy spheres upward to pop matching colored target clusters!', accent: '#d946ef', isShooter: true },
};

export const ThreeArcadeMixPack: React.FC<Props> = ({ variant, onGameOver }) => {
  const m = META[variant];
  const mountRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const playerXRef = useRef(0);
  const fireReqRef = useRef(false);
  const runningRef = useRef(false);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const resetRef = useRef<() => void>(() => {});
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const nudgeX = useCallback((dx: number) => {
    if (!runningRef.current) return;
    playerXRef.current = THREE.MathUtils.clamp(playerXRef.current + dx, -3.2, 3.2);
    sound.playMove();
  }, []);

  const triggerFire = useCallback(() => {
    if (!runningRef.current || !m.isShooter) return;
    fireReqRef.current = true;
  }, [m.isShooter]);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    livesRef.current = 3;
    playerXRef.current = 0;
    fireReqRef.current = false;
    runningRef.current = true;
    resetRef.current();
    setScore(0);
    setLives(3);
    setGameOver(false);
    setStarted(true);
    sound.playClick();
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, { fov: 54, bgColor: 0x070a15, fogNear: 18, fogFar: 55 });
    const { scene, camera, renderer } = studio;
    camera.position.set(0, m.isShooter ? 5.6 : 2.6, 8.6);
    camera.lookAt(0, m.isShooter ? 0.5 : 1.0, 0);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(8.4, 0.25, 13),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.55 })
    );
    floor.position.set(0, -1.2, -2);
    scene.add(floor);

    const player = new THREE.Mesh(
      m.isShooter ? new THREE.BoxGeometry(1.1, 0.55, 1.1) : new THREE.BoxGeometry(1.65, 0.42, 0.9),
      new THREE.MeshPhysicalMaterial({ color: 0x22d3ee, emissive: 0x0891b2, emissiveIntensity: 0.5, clearcoat: 1 })
    );
    player.position.set(0, -0.7, m.isShooter ? 3.5 : 0);
    scene.add(player);

    // Falling objects pool (for catcher/dodge)
    interface DropItem { obj: THREE.Object3D; isHazard: boolean; active: boolean; vy: number }
    const drops: DropItem[] = [];
    if (!m.isShooter) {
      const hazMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x991b1b, emissiveIntensity: 0.65 });
      for (let i = 0; i < 12; i++) {
        const isHaz = variant === 'meteor-dodge' ? i % 4 !== 0 : i % 3 === 2;
        const obj = isHaz
          ? new THREE.Mesh(new THREE.DodecahedronGeometry(0.45), hazMat)
          : build3DCoin();
        obj.visible = false;
        scene.add(obj);
        drops.push({ obj, isHazard: isHaz, active: false, vy: 4.5 });
      }
    }

    // Shooter / 2048 targets & projectile
    const targets: { mesh: THREE.Mesh; val: number; colorIdx: number; active: boolean }[] = [];
    const projColors = [0x22d3ee, 0xfacc15, 0xf43f5e, 0x10b981];
    let projColorIdx = 0;
    const projMesh = new THREE.Mesh(
      variant === 'cube-2048' ? new THREE.BoxGeometry(0.85, 0.85, 0.85) : new THREE.SphereGeometry(0.42, 18, 18),
      new THREE.MeshPhysicalMaterial({ color: projColors[0], clearcoat: 1 })
    );
    projMesh.visible = false;
    scene.add(projMesh);
    let projFlying = false;

    const numTexCache: Record<number, THREE.CanvasTexture> = {};
    const getNumTex = (v: number) => {
      if (numTexCache[v]) return numTexCache[v];
      const tex = makeCanvasTexture(renderer, 128, 128, (ctx, w, h) => {
        ctx.fillStyle = v >= 16 ? '#eab308' : v >= 8 ? '#f97316' : '#0284c7';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, w - 8, h - 8);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 52px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(v), w / 2, h / 2 + 3);
      });
      numTexCache[v] = tex;
      return tex;
    };

    if (m.isShooter) {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          const val = variant === 'cube-2048' ? 2 : 0;
          const colorIdx = (r + c) % 4;
          const mesh = new THREE.Mesh(
            variant === 'cube-2048' ? new THREE.BoxGeometry(1.1, 0.85, 1.1) : new THREE.SphereGeometry(0.48, 16, 16),
            variant === 'cube-2048'
              ? new THREE.MeshStandardMaterial({ map: getNumTex(val) })
              : new THREE.MeshPhysicalMaterial({ color: projColors[colorIdx], clearcoat: 1 })
          );
          mesh.position.set((c - 1.5) * 1.45, -0.6, -4.5 + r * 1.5);
          scene.add(mesh);
          targets.push({ mesh, val, colorIdx, active: true });
        }
      }
    }

    let spawnCd = 0;

    resetRef.current = () => {
      spawnCd = 0.2;
      projFlying = false;
      projMesh.visible = false;
      drops.forEach((d) => { d.active = false; d.obj.visible = false; });
      targets.forEach((t, idx) => {
        t.active = true;
        t.mesh.visible = true;
        t.val = 2;
        if (variant === 'cube-2048') {
          (t.mesh.material as THREE.MeshStandardMaterial).map = getNumTex(2);
          (t.mesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
        }
        const r = Math.floor(idx / 4), c = idx % 4;
        t.mesh.position.set((c - 1.5) * 1.45, -0.6, -4.5 + r * 1.5);
      });
    };

    const stopLoop = studio.start((delta) => {
      const dt = Math.min(delta, 0.05);
      if (!runningRef.current) return;

      player.position.x = THREE.MathUtils.damp(player.position.x, playerXRef.current, 14, dt);

      if (!m.isShooter) {
        spawnCd -= dt;
        if (spawnCd <= 0) {
          spawnCd = 0.45;
          const slot = drops.find((d) => !d.active);
          if (slot) {
            slot.active = true;
            slot.vy = 4.2 + Math.random() * 2.5;
            slot.obj.position.set((Math.random() - 0.5) * 6.4, 4.6, 0);
            slot.obj.visible = true;
          }
        }

        for (const d of drops) {
          if (!d.active) continue;
          d.obj.position.y -= d.vy * dt;
          d.obj.rotation.y += dt * 3;
          if (Math.abs(d.obj.position.y - player.position.y) < 0.72 && Math.abs(d.obj.position.x - player.position.x) < 1.15) {
            d.active = false;
            d.obj.visible = false;
            if (d.isHazard) {
              livesRef.current -= 1;
              setLives(livesRef.current);
              sound.playExplosion();
              if (livesRef.current <= 0) {
                runningRef.current = false;
                setGameOver(true);
                onGameOverRef.current(scoreRef.current, Math.max(2, Math.floor(scoreRef.current / 22)));
                return;
              }
            } else {
              scoreRef.current += 25;
              setScore(scoreRef.current);
              sound.playCoin();
            }
          } else if (d.obj.position.y < -1.8) {
            d.active = false;
            d.obj.visible = false;
            if (variant === 'meteor-dodge' && d.isHazard) {
              scoreRef.current += 10;
              setScore(scoreRef.current);
            }
          }
        }
      } else {
        // Cube 2048 / Bubble Blaster
        if (fireReqRef.current && !projFlying) {
          fireReqRef.current = false;
          projFlying = true;
          projMesh.position.set(player.position.x, -0.6, 2.5);
          projMesh.visible = true;
          sound.playLaser();
        }
        if (projFlying) {
          projMesh.position.z -= 16 * dt;
          for (const t of targets) {
            if (!t.active) continue;
            if (projMesh.position.distanceTo(t.mesh.position) < 1.05) {
              projFlying = false;
              projMesh.visible = false;
              if (variant === 'cube-2048') {
                t.val *= 2;
                scoreRef.current += t.val * 5;
                setScore(scoreRef.current);
                (t.mesh.material as THREE.MeshStandardMaterial).map = getNumTex(t.val);
                (t.mesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
                sound.playCoin();
              } else {
                t.active = false;
                t.mesh.visible = false;
                scoreRef.current += 35;
                setScore(scoreRef.current);
                sound.playCoin();
                projColorIdx = (projColorIdx + 1) % 4;
                (projMesh.material as THREE.MeshPhysicalMaterial).color.setHex(projColors[projColorIdx]);
                if (targets.every((x) => !x.active)) {
                  scoreRef.current += 120;
                  setScore(scoreRef.current);
                  sound.playVictory();
                  resetRef.current();
                }
              }
              break;
            }
          }
          if (projMesh.position.z < -7) {
            projFlying = false;
            projMesh.visible = false;
          }
        }
      }
    });

    return () => {
      stopLoop();
      Object.values(numTexCache).forEach((t) => t.dispose());
      studio.cleanup();
    };
  }, [m.isShooter, variant]);

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-md mx-auto">
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-white/15 rounded-xl text-xs font-mono tabular-nums">
        <span className="text-rose-400 font-bold">{m.isShooter ? m.title : `Lives: ${'♥'.repeat(Math.max(0, lives))}`}</span>
        <span className="text-amber-400 font-bold">Score: {score}</span>
      </div>

      <div
        className="relative w-full h-[350px] rounded-2xl overflow-hidden border-2 bg-[#070a15] touch-none select-none"
        style={{ borderColor: `${m.accent}66` }}
        onPointerMove={(e) => {
          if (!runningRef.current || e.buttons === 0) return;
          const rect = e.currentTarget.getBoundingClientRect();
          playerXRef.current = THREE.MathUtils.clamp((((e.clientX - rect.left) / rect.width) * 2 - 1) * 3.2, -3.2, 3.2);
        }}
        onPointerDown={(e) => {
          if (!runningRef.current) return;
          const rect = e.currentTarget.getBoundingClientRect();
          playerXRef.current = THREE.MathUtils.clamp((((e.clientX - rect.left) / rect.width) * 2 - 1) * 3.2, -3.2, 3.2);
          if (m.isShooter) triggerFire();
        }}
      >
        <div ref={mountRef} className="w-full h-full touch-none" />
        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black mb-1" style={{ color: m.accent }}>ROUND COMPLETE!</h3>
                <p className="text-slate-300 text-sm mb-3">Score: {score} · +{Math.max(2, Math.floor(score / 22))} Coins</p>
                <button onClick={(e) => { e.stopPropagation(); startGame(); }} className="flex items-center gap-2 px-6 py-2.5 text-black font-extrabold rounded-xl active:scale-95" style={{ backgroundColor: m.accent }}>
                  <RotateCcw size={18} /> Play Again
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black mb-1" style={{ color: m.accent }}>{m.title}</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[250px]">{m.sub}</p>
                <button onClick={(e) => { e.stopPropagation(); startGame(); }} className="flex items-center gap-2 px-7 py-3 text-black font-extrabold rounded-xl shadow-lg active:scale-95" style={{ backgroundColor: m.accent }}>
                  <Play size={18} fill="currentColor" /> Start 3D Game
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className={`grid ${m.isShooter ? 'grid-cols-3' : 'grid-cols-2'} gap-2.5 w-full max-w-[280px]`}>
        <button onPointerDown={(e) => { e.preventDefault(); nudgeX(-0.75); }} className="h-14 rounded-xl bg-slate-800 border border-white/15 flex items-center justify-center text-white active:scale-95 touch-none">
          <ArrowLeft size={22} />
        </button>
        {m.isShooter && (
          <button onPointerDown={(e) => { e.preventDefault(); triggerFire(); }} className="h-14 rounded-xl text-black font-black text-xs flex items-center justify-center gap-1 active:scale-95 touch-none" style={{ backgroundColor: m.accent }}>
            <ArrowUp size={18} /> LAUNCH
          </button>
        )}
        <button onPointerDown={(e) => { e.preventDefault(); nudgeX(0.75); }} className="h-14 rounded-xl bg-slate-800 border border-white/15 flex items-center justify-center text-white active:scale-95 touch-none">
          <ArrowRight size={22} />
        </button>
      </div>
    </div>
  );
};
