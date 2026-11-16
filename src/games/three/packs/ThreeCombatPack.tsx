import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../../services/audio';
import { buildStarfighter, createStudioContext } from '../threeUtils';
import { ArrowLeft, ArrowRight, Crosshair, Play, RotateCcw } from 'lucide-react';

export type CombatVariant = 'tank' | 'turret' | 'asteroid' | 'alien' | 'boss' | 'zombie';

interface Props {
  variant: CombatVariant;
  onGameOver: (score: number, coinsEarned: number) => void;
}

const CFG: Record<CombatVariant, { title: string; sub: string; bg: number; accent: number; css: string }> = {
  tank: { title: '3D Tank Arena', sub: 'Drive your heavy 3D battle tank across the cyber grid and blast enemy armor units!', bg: 0x0c140e, accent: 0x22c55e, css: '#22c55e' },
  turret: { title: '3D Laser Turret', sub: 'Aim your twin-barrel 3D defense cannon to intercept incoming cyber drone swarms!', bg: 0x080c1c, accent: 0x38bdf8, css: '#38bdf8' },
  asteroid: { title: '3D Asteroid Belt', sub: 'Pilot your starfighter through tumbling 3D space rocks—blast boulders before impact!', bg: 0x030510, accent: 0xa855f7, css: '#a855f7' },
  alien: { title: '3D Alien Wave', sub: 'Defend Earth orbit! Strafe left/right and fire plasma bolts at descending alien saucers!', bg: 0x060416, accent: 0xf43f5e, css: '#f43f5e' },
  boss: { title: '3D Titan Boss', sub: 'Dodge sweeping red energy attacks and shatter the giant 3D Titan Boss core!', bg: 0x16050c, accent: 0xf97316, css: '#f97316' },
  zombie: { title: '3D Cyber Holdout', sub: 'Hold the laser barricade! Blast advancing rogue mechs before they breach your 3 shields!', bg: 0x0d0a16, accent: 0xeab308, css: '#eab308' },
};

function buildTank(color: number): THREE.Group {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color, metalness: 0.45, roughness: 0.35 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.45, 1.7), hullMat);
  hull.position.y = 0.28;
  const turret = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.35, 0.8), darkMat);
  turret.position.set(0, 0.65, 0);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.3, 10), hullMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.65, -0.8);
  g.add(hull, turret, barrel);
  return g;
}

export const ThreeCombatPack: React.FC<Props> = ({ variant, onGameOver }) => {
  const c = CFG[variant];
  const mountRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [shields, setShields] = useState(3);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const playerXRef = useRef(0);
  const moveDirRef = useRef(0);
  const firingRef = useRef(false);
  const runningRef = useRef(false);
  const scoreRef = useRef(0);
  const shieldsRef = useRef(3);
  const resetRef = useRef<() => void>(() => {});
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    shieldsRef.current = 3;
    playerXRef.current = 0;
    runningRef.current = true;
    resetRef.current();
    setScore(0);
    setShields(3);
    setGameOver(false);
    setStarted(true);
    sound.playClick();
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, { fov: 56, bgColor: c.bg, fogNear: 24, fogFar: 82 });
    const { scene, camera } = studio;
    camera.position.set(0, 5.2, 8.2);
    camera.lookAt(0, 0.8, -10);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 80),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.2, -30);
    scene.add(floor);

    const player =
      variant === 'tank' || variant === 'turret'
        ? buildTank(c.accent)
        : buildStarfighter(c.accent, 0xfef08a);
    player.position.set(0, 0.2, 3.2);
    scene.add(player);

    // Boss mesh (used for 'boss' variant)
    const bossGroup = new THREE.Group();
    const bossCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.5),
      new THREE.MeshPhysicalMaterial({ color: 0xf43f5e, emissive: 0x9f1239, emissiveIntensity: 0.9, clearcoat: 1 })
    );
    const bossRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.1, 0.18, 10, 24),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xca8a04, emissiveIntensity: 0.7 })
    );
    bossGroup.add(bossCore, bossRing);
    bossGroup.position.set(0, 1.4, -18);
    bossGroup.visible = variant === 'boss';
    scene.add(bossGroup);
    let bossHp = 12;

    interface Bolt { mesh: THREE.Mesh; active: boolean }
    const bolts: Bolt[] = [];
    const boltGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.95, 8);
    boltGeo.rotateX(Math.PI / 2);
    const boltMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(boltGeo, boltMat);
      m.visible = false;
      scene.add(m);
      bolts.push({ mesh: m, active: false });
    }

    interface Enemy { mesh: THREE.Mesh; active: boolean; hp: number; vx: number }
    const enemies: Enemy[] = [];
    const enemyGeo =
      variant === 'asteroid'
        ? new THREE.DodecahedronGeometry(0.78)
        : variant === 'alien'
        ? new THREE.ConeGeometry(0.75, 0.9, 6)
        : new THREE.BoxGeometry(1.15, 1.15, 1.15);
    const enemyMat = new THREE.MeshStandardMaterial({
      color: variant === 'asteroid' ? 0x94a3b8 : 0xf43f5e,
      emissive: variant === 'asteroid' ? 0x1e293b : 0x881337,
      emissiveIntensity: 0.4,
      roughness: 0.35,
    });
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(enemyGeo, enemyMat);
      m.visible = false;
      scene.add(m);
      enemies.push({ mesh: m, active: false, hp: 1, vx: 0 });
    }

    let fireCd = 0;
    let spawnCd = 0;

    resetRef.current = () => {
      fireCd = 0;
      spawnCd = 0.4;
      bossHp = 12;
      bossGroup.position.set(0, 1.4, -18);
      bolts.forEach((b) => { b.active = false; b.mesh.visible = false; });
      enemies.forEach((e) => { e.active = false; e.mesh.visible = false; });
    };

    const stopLoop = studio.start((delta, elapsed) => {
      const dt = Math.min(delta, 0.05);
      if (!runningRef.current) return;

      playerXRef.current = THREE.MathUtils.clamp(playerXRef.current + moveDirRef.current * 8.2 * dt, -4.6, 4.6);
      player.position.x = THREE.MathUtils.damp(player.position.x, playerXRef.current, 14, dt);

      if (variant === 'boss') {
        bossGroup.position.x = Math.sin(elapsed * 1.4) * 3.8;
        bossCore.rotation.y += dt * 1.8;
        bossRing.rotation.z -= dt * 2.2;
      }

      fireCd -= dt;
      if (firingRef.current && fireCd <= 0) {
        fireCd = 0.18;
        const b = bolts.find((x) => !x.active);
        if (b) {
          b.active = true;
          b.mesh.position.set(player.position.x, 0.85, player.position.z - 1.1);
          b.mesh.visible = true;
          sound.playLaser();
        }
      }

      spawnCd -= dt;
      if (spawnCd <= 0) {
        spawnCd = variant === 'boss' ? 0.72 : 0.65;
        const e = enemies.find((x) => !x.active);
        if (e) {
          e.active = true;
          e.hp = 1;
          e.vx = variant === 'alien' ? (Math.random() - 0.5) * 3 : 0;
          e.mesh.position.set(variant === 'boss' ? bossGroup.position.x : (Math.random() - 0.5) * 8.5, 0.85, variant === 'boss' ? -17 : -38);
          e.mesh.visible = true;
        }
      }

      for (const b of bolts) {
        if (!b.active) continue;
        b.mesh.position.z -= 32 * dt;

        if (variant === 'boss' && b.mesh.position.z < -16.5 && Math.abs(b.mesh.position.x - bossGroup.position.x) < 1.8) {
          b.active = false;
          b.mesh.visible = false;
          bossHp -= 1;
          scoreRef.current += 35;
          setScore(scoreRef.current);
          sound.playPaddle();
          if (bossHp <= 0) {
            bossHp = 14;
            scoreRef.current += 200;
            setScore(scoreRef.current);
            sound.playVictory();
          }
          continue;
        }

        for (const e of enemies) {
          if (!e.active) continue;
          if (b.mesh.position.distanceTo(e.mesh.position) < 1.15) {
            b.active = false;
            b.mesh.visible = false;
            e.active = false;
            e.mesh.visible = false;
            scoreRef.current += 25;
            setScore(scoreRef.current);
            sound.playExplosion();
            break;
          }
        }
        if (b.mesh.position.z < -42) {
          b.active = false;
          b.mesh.visible = false;
        }
      }

      for (const e of enemies) {
        if (!e.active) continue;
        e.mesh.position.z += (variant === 'boss' ? 14 : 11.5) * dt;
        e.mesh.position.x = THREE.MathUtils.clamp(e.mesh.position.x + e.vx * dt, -4.6, 4.6);
        e.mesh.rotation.y += dt * 2.5;
        e.mesh.rotation.x += dt * 1.4;

        const hitPlayer = e.mesh.position.distanceTo(player.position) < 1.35;
        const breached = e.mesh.position.z > 5.2;
        if (hitPlayer || breached) {
          e.active = false;
          e.mesh.visible = false;
          shieldsRef.current -= 1;
          setShields(shieldsRef.current);
          sound.playHit();
          if (shieldsRef.current <= 0) {
            runningRef.current = false;
            setGameOver(true);
            onGameOverRef.current(scoreRef.current, Math.max(3, Math.floor(scoreRef.current / 25)));
            return;
          }
        }
      }
    });

    return () => {
      stopLoop();
      studio.cleanup();
    };
  }, [c.accent, c.bg, variant]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'Space', 'KeyA', 'KeyD'].includes(e.code)) e.preventDefault();
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') moveDirRef.current = -1;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') moveDirRef.current = 1;
      if (e.code === 'Space') firingRef.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowRight' || e.code === 'KeyD') moveDirRef.current = 0;
      if (e.code === 'Space') firingRef.current = false;
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
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-white/15 rounded-xl text-xs font-mono tabular-nums">
        <span className="text-rose-400 font-bold">Shields: {'♥'.repeat(Math.max(0, shields))}</span>
        <span className="text-cyan-400 font-bold">Score: {score}</span>
      </div>

      <div
        className="relative w-full h-[350px] rounded-2xl overflow-hidden border-2 bg-[#050816] touch-none select-none"
        style={{ borderColor: `${c.css}66` }}
        onPointerDown={(e) => {
          if (!runningRef.current) return;
          firingRef.current = true;
          const rect = e.currentTarget.getBoundingClientRect();
          playerXRef.current = THREE.MathUtils.clamp((((e.clientX - rect.left) / rect.width) * 2 - 1) * 4.5, -4.5, 4.5);
        }}
        onPointerMove={(e) => {
          if (!runningRef.current || e.buttons === 0) return;
          const rect = e.currentTarget.getBoundingClientRect();
          playerXRef.current = THREE.MathUtils.clamp((((e.clientX - rect.left) / rect.width) * 2 - 1) * 4.5, -4.5, 4.5);
        }}
        onPointerUp={() => { firingRef.current = false; }}
        onPointerCancel={() => { firingRef.current = false; }}
      >
        <div ref={mountRef} className="w-full h-full touch-none" />
        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black text-rose-400 mb-1">SHIELDS DOWN!</h3>
                <p className="text-slate-300 text-sm mb-3">Score: {score} · +{Math.max(3, Math.floor(score / 25))} Coins</p>
                <button onClick={(e) => { e.stopPropagation(); startGame(); }} className="flex items-center gap-2 px-6 py-2.5 text-black font-extrabold rounded-xl active:scale-95" style={{ backgroundColor: c.css }}>
                  <RotateCcw size={18} /> Re-Deploy
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black mb-1" style={{ color: c.css }}>{c.title}</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[250px]">{c.sub}</p>
                <button onClick={(e) => { e.stopPropagation(); startGame(); }} className="flex items-center gap-2 px-7 py-3 text-black font-extrabold rounded-xl shadow-lg active:scale-95" style={{ backgroundColor: c.css }}>
                  <Play size={18} fill="currentColor" /> Launch Combat
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5 w-full max-w-[300px]">
        <button onPointerDown={(e) => { e.preventDefault(); moveDirRef.current = -1; }} onPointerUp={() => (moveDirRef.current = 0)} onPointerLeave={() => (moveDirRef.current = 0)} className="h-14 rounded-xl bg-slate-800 border border-white/15 flex items-center justify-center text-white active:scale-95 touch-none">
          <ArrowLeft size={22} />
        </button>
        <button onPointerDown={(e) => { e.preventDefault(); firingRef.current = true; }} onPointerUp={() => (firingRef.current = false)} onPointerLeave={() => (firingRef.current = false)} className="h-14 rounded-xl text-black font-black text-xs flex items-center justify-center gap-1 active:scale-95 touch-none" style={{ backgroundColor: c.css }}>
          <Crosshair size={16} /> FIRE
        </button>
        <button onPointerDown={(e) => { e.preventDefault(); moveDirRef.current = 1; }} onPointerUp={() => (moveDirRef.current = 0)} onPointerLeave={() => (moveDirRef.current = 0)} className="h-14 rounded-xl bg-slate-800 border border-white/15 flex items-center justify-center text-white active:scale-95 touch-none">
          <ArrowRight size={22} />
        </button>
      </div>
    </div>
  );
};
