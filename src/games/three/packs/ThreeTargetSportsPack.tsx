import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../../services/audio';
import { createStudioContext, makeCanvasTexture } from '../threeUtils';
import { ArrowLeft, ArrowRight, Play, RotateCcw } from 'lucide-react';

export type TargetSportsVariant = 'penalty' | 'golf' | 'archery' | 'darts' | 'pool' | 'skeeball';

interface Props {
  variant: TargetSportsVariant;
  onGameOver: (score: number, coinsEarned: number) => void;
}

const META: Record<TargetSportsVariant, { title: string; sub: string; accent: string; actionLabel: string }> = {
  penalty: { title: '3D Penalty Striker', sub: 'Aim left/right and strike the 3D soccer ball past the diving goalkeeper!', accent: '#22c55e', actionLabel: 'KICK!' },
  golf: { title: '3D Neon Mini-Golf', sub: 'Line up your putt angle & power meter to sink the 3D ball into the glowing flag cup!', accent: '#10b981', actionLabel: 'PUTT!' },
  archery: { title: '3D Cyber Archery', sub: 'Aim horizontally and release 3D arrows into the moving bullseye ring!', accent: '#f97316', actionLabel: 'LOOSE!' },
  darts: { title: '3D Bullseye Darts', sub: 'Line up your dart aim and hit the center bullseye on the spinning 3D dartboard!', accent: '#ef4444', actionLabel: 'THROW!' },
  pool: { title: '3D Billiards Shot', sub: 'Aim cue angle & shoot to sink the colored object balls into the glowing corner pockets!', accent: '#06b6d4', actionLabel: 'SHOOT!' },
  skeeball: { title: '3D Skee-Ball Arena', sub: 'Aim & roll the ball up the neon ramp into the center 100-pt glowing ring!', accent: '#eab308', actionLabel: 'ROLL!' },
};

export const ThreeTargetSportsPack: React.FC<Props> = ({ variant, onGameOver }) => {
  const m = META[variant];
  const mountRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [shotsLeft, setShotsLeft] = useState(7);
  const [power, setPower] = useState(50);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [feedback, setFeedback] = useState('');

  const aimXRef = useRef(0);
  const flyingRef = useRef(false);
  const shootReqRef = useRef(false);
  const runningRef = useRef(false);
  const scoreRef = useRef(0);
  const shotsRef = useRef(7);
  const powerRef = useRef(50);
  const resetRoundRef = useRef<() => void>(() => {});
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const nudgeAim = useCallback((dx: number) => {
    if (!runningRef.current || flyingRef.current) return;
    aimXRef.current = THREE.MathUtils.clamp(aimXRef.current + dx, -2.1, 2.1);
    sound.playMove();
  }, []);

  const shoot = useCallback(() => {
    if (!runningRef.current || flyingRef.current) return;
    shootReqRef.current = true;
  }, []);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    shotsRef.current = 7;
    aimXRef.current = 0;
    flyingRef.current = false;
    shootReqRef.current = false;
    runningRef.current = true;
    resetRoundRef.current();
    setScore(0);
    setShotsLeft(7);
    setFeedback('');
    setGameOver(false);
    setStarted(true);
    sound.playClick();
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, { fov: 50, bgColor: 0x060b16, fogNear: 22, fogFar: 65 });
    const { scene, camera, renderer } = studio;
    camera.position.set(0, 3.6, 8.2);
    camera.lookAt(0, 1.1, -6);

    // Arena floor
    const floorTex = makeCanvasTexture(renderer, 256, 256, (ctx, w, h) => {
      ctx.fillStyle = variant === 'penalty' || variant === 'golf' ? '#064e3b' : variant === 'pool' ? '#0c4a6e' : '#111827';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);
    }, 3, 6);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 26),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.6 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -5);
    scene.add(floor);

    // Target Assembly at z = -10
    const targetGroup = new THREE.Group();
    targetGroup.position.set(0, 0, -10);
    scene.add(targetGroup);

    const keeperMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.8, 0.35),
      new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0x9f1239, emissiveIntensity: 0.4 })
    );
    keeperMesh.position.set(0, 0.9, 0.5);
    keeperMesh.visible = variant === 'penalty';
    targetGroup.add(keeperMesh);

    if (variant === 'penalty') {
      const postMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.3, roughness: 0.25 });
      const leftP = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.7, 12), postMat);
      leftP.position.set(-2.6, 1.35, 0);
      const rightP = leftP.clone();
      rightP.position.x = 2.6;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5.4, 12), postMat);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, 2.7, 0);
      targetGroup.add(leftP, rightP, bar);
    } else if (variant === 'golf' || variant === 'pool') {
      const hole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.62, 0.62, 0.08, 22),
        new THREE.MeshStandardMaterial({ color: 0x020617 })
      );
      hole.position.set(0, 0.04, 0);
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.64, 0.06, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 0.8 })
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.set(0, 0.06, 0);
      const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
      flagPole.position.set(0, 1.1, 0);
      targetGroup.add(hole, rim, flagPole);
    } else {
      // Bulls-eye / Dartboard / Skee-Ball Rings
      const rings = [
        { r: 1.6, c: 0x1e293b },
        { r: 1.15, c: 0x3b82f6 },
        { r: 0.72, c: 0xef4444 },
        { r: 0.34, c: 0xfacc15 },
      ];
      rings.forEach((rg, idx) => {
        const disc = new THREE.Mesh(
          new THREE.CylinderGeometry(rg.r, rg.r, 0.12, 26),
          new THREE.MeshStandardMaterial({ color: rg.c, emissive: idx === 3 ? 0xca8a04 : 0x000000, emissiveIntensity: 0.7 })
        );
        disc.rotation.x = Math.PI / 2;
        disc.position.set(0, 1.6, idx * 0.04);
        targetGroup.add(disc);
      });
    }

    // Projectile (Ball / Arrow / Dart)
    const projGroup = new THREE.Group();
    const projMat = new THREE.MeshPhysicalMaterial({
      color: variant === 'golf' ? 0xf8fafc : variant === 'archery' || variant === 'darts' ? 0xf97316 : 0x22d3ee,
      roughness: 0.2,
      clearcoat: 1,
    });
    const projMesh =
      variant === 'archery' || variant === 'darts'
        ? new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.1, 10), projMat)
        : new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 20), projMat);
    if (variant === 'archery' || variant === 'darts') projMesh.rotation.x = -Math.PI / 2;
    projGroup.add(projMesh);
    projGroup.position.set(0, 0.4, 3.8);
    scene.add(projGroup);

    // Aim guide line
    const guide = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.04, 4.5),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.65 })
    );
    guide.position.set(0, 0.05, 1.2);
    scene.add(guide);

    let vx = 0, vy = 0, vz = 0;
    let targetOffsetX = 0;

    resetRoundRef.current = () => {
      flyingRef.current = false;
      projGroup.position.set(0, variant === 'archery' || variant === 'darts' ? 1.3 : 0.36, 3.8);
      targetOffsetX = (Math.random() - 0.5) * 2.2;
      if (variant === 'penalty') targetOffsetX = 0;
      targetGroup.position.x = targetOffsetX;
      guide.visible = true;
    };

    const stopLoop = studio.start((delta, elapsed) => {
      const dt = Math.min(delta, 0.05);

      if (!flyingRef.current) {
        const pNorm = (Math.sin(elapsed * 3.1) + 1) * 50;
        powerRef.current = pNorm;
        setPower(Math.round(pNorm));

        guide.position.x = aimXRef.current * 0.5;
        guide.rotation.y = -aimXRef.current * 0.14;

        if (variant === 'archery' || variant === 'darts') {
          targetGroup.position.x = Math.sin(elapsed * 1.8) * 1.9;
        }
        if (variant === 'penalty') {
          keeperMesh.position.x = Math.sin(elapsed * 2.4) * 1.75;
        }

        if (shootReqRef.current) {
          shootReqRef.current = false;
          flyingRef.current = true;
          guide.visible = false;
          const spd = 15 + (powerRef.current / 100) * 9;
          vx = aimXRef.current * 4.4;
          vy = variant === 'golf' || variant === 'pool' ? 0 : 4.2 + (powerRef.current / 100) * 2.5;
          vz = -spd;
          sound.playJump();
        }
      } else {
        if (variant !== 'golf' && variant !== 'pool') vy -= 9.5 * dt;
        projGroup.position.x += vx * dt;
        projGroup.position.y = Math.max(0.36, projGroup.position.y + vy * dt);
        projGroup.position.z += vz * dt;
        if (variant === 'penalty') {
          keeperMesh.position.x += Math.sin(elapsed * 5) * dt * 2.2;
        }

        if (projGroup.position.z <= -9.8) {
          flyingRef.current = false;
          const dx = Math.abs(projGroup.position.x - targetGroup.position.x);
          let pts = 0;
          let msg = 'Missed!';

          if (variant === 'penalty') {
            const hitKeeper = Math.abs(projGroup.position.x - keeperMesh.position.x) < 0.72;
            if (!hitKeeper && Math.abs(projGroup.position.x) < 2.45) {
              pts = 75;
              msg = 'GOAL! +75';
            } else if (hitKeeper) {
              msg = 'Saved by Keeper!';
            }
          } else if (variant === 'golf' || variant === 'pool') {
            if (dx < 0.78) {
              pts = dx < 0.35 ? 100 : 60;
              msg = dx < 0.35 ? 'ACE SINK! +100' : 'SUNK IT! +60';
            }
          } else {
            if (dx < 0.45) { pts = 100; msg = 'BULLSEYE! +100'; }
            else if (dx < 0.95) { pts = 60; msg = 'INNER RING! +60'; }
            else if (dx < 1.55) { pts = 30; msg = 'HIT! +30'; }
          }

          if (pts > 0) {
            scoreRef.current += pts;
            setScore(scoreRef.current);
            sound.playCoin();
          } else {
            sound.playHit();
          }
          setFeedback(msg);

          shotsRef.current -= 1;
          setShotsLeft(shotsRef.current);
          if (shotsRef.current <= 0) {
            runningRef.current = false;
            setGameOver(true);
            onGameOverRef.current(scoreRef.current, Math.max(3, Math.floor(scoreRef.current / 28)));
          } else {
            window.setTimeout(() => {
              if (runningRef.current) resetRoundRef.current();
            }, 420);
          }
        }
      }
    });

    return () => {
      stopLoop();
      floorTex.dispose();
      studio.cleanup();
    };
  }, [variant]);

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-md mx-auto">
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-white/15 rounded-xl text-xs font-mono tabular-nums">
        <span className="font-bold" style={{ color: m.accent }}>Shots: {shotsLeft}/7</span>
        {feedback && <span className="text-amber-300 font-bold">{feedback}</span>}
        <span className="text-cyan-400 font-bold">Pts: {score}</span>
      </div>

      <div className="relative w-full h-[340px] rounded-2xl overflow-hidden border-2 bg-[#060b16] touch-none select-none" style={{ borderColor: `${m.accent}66` }}>
        <div ref={mountRef} className="w-full h-full touch-none" />
        {started && !gameOver && (
          <div className="absolute bottom-2 left-3 right-3 pointer-events-none">
            <div className="h-2.5 w-full bg-slate-900/90 rounded-full overflow-hidden border border-white/15">
              <div className="h-full bg-gradient-to-r from-emerald-400 via-yellow-400 to-rose-500 transition-all duration-75" style={{ width: `${power}%` }} />
            </div>
          </div>
        )}
        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black mb-1" style={{ color: m.accent }}>ROUND COMPLETE!</h3>
                <p className="text-slate-300 text-sm mb-3">Total Score: {score} · +{Math.max(3, Math.floor(score / 28))} Coins</p>
                <button onClick={startGame} className="flex items-center gap-2 px-6 py-2.5 text-black font-extrabold rounded-xl active:scale-95" style={{ backgroundColor: m.accent }}>
                  <RotateCcw size={18} /> Play Again
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black mb-1" style={{ color: m.accent }}>{m.title}</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[250px]">{m.sub}</p>
                <button onClick={startGame} className="flex items-center gap-2 px-7 py-3 text-black font-extrabold rounded-xl shadow-lg active:scale-95" style={{ backgroundColor: m.accent }}>
                  <Play size={18} fill="currentColor" /> Start 7 Shots
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5 w-full max-w-[300px]">
        <button onPointerDown={(e) => { e.preventDefault(); nudgeAim(-0.35); }} className="h-14 rounded-xl bg-slate-800 border border-white/15 flex items-center justify-center text-white active:scale-95 touch-none select-none">
          <ArrowLeft size={22} />
        </button>
        <button onPointerDown={(e) => { e.preventDefault(); shoot(); }} className="h-14 rounded-xl text-black font-black text-sm active:scale-95 touch-none select-none" style={{ backgroundColor: m.accent }}>
          {m.actionLabel}
        </button>
        <button onPointerDown={(e) => { e.preventDefault(); nudgeAim(0.35); }} className="h-14 rounded-xl bg-slate-800 border border-white/15 flex items-center justify-center text-white active:scale-95 touch-none select-none">
          <ArrowRight size={22} />
        </button>
      </div>
    </div>
  );
};
