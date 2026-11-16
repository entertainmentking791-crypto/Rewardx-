import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../../services/audio';
import { createStudioContext } from '../threeUtils';
import { ArrowLeft, ArrowRight, Play, RotateCcw } from 'lucide-react';

export type PaddleSportsVariant = 'table-tennis' | 'air-hockey' | 'baseball' | 'cricket';

interface Props {
  variant: PaddleSportsVariant;
  onGameOver: (score: number, coinsEarned: number) => void;
}

const CFG: Record<PaddleSportsVariant, { title: string; sub: string; accent: string; tableColor: number; isBat?: boolean }> = {
  'table-tennis': { title: '3D Cyber Ping Pong', sub: 'Slide your paddle left/right across the 3D table to smash returns past the AI!', accent: '#38bdf8', tableColor: 0x0f172a },
  'air-hockey': { title: '3D Neon Air Hockey', sub: 'Defend your glowing goal and smash the 3D puck past the Bot striker!', accent: '#f43f5e', tableColor: 0x1e1b4b },
  baseball: { title: '3D Home Run Derby', sub: 'Time your 3D bat swing as pitched fastballs cross home plate for monster Home Runs!', accent: '#f59e0b', tableColor: 0x064e3b, isBat: true },
  cricket: { title: '3D Cricket Sixer', sub: 'Watch the 3D cricket ball pitch down the track and tap SWING for huge Sixes!', accent: '#22c55e', tableColor: 0x065f46, isBat: true },
};

export const ThreePaddleSportsPack: React.FC<Props> = ({ variant, onGameOver }) => {
  const c = CFG[variant];
  const mountRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [secondary, setSecondary] = useState(variant === 'baseball' || variant === 'cricket' ? 8 : 0);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [note, setNote] = useState('');

  const playerXRef = useRef(0);
  const swingTimerRef = useRef(0);
  const runningRef = useRef(false);
  const scoreRef = useRef(0);
  const resetArenaRef = useRef<() => void>(() => {});
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const movePaddle = useCallback((dx: number) => {
    if (!runningRef.current) return;
    playerXRef.current = THREE.MathUtils.clamp(playerXRef.current + dx, -2.5, 2.5);
  }, []);

  const triggerSwing = useCallback(() => {
    if (!runningRef.current || !c.isBat) return;
    if (swingTimerRef.current <= 0) {
      swingTimerRef.current = 0.28;
      sound.playJump();
    }
  }, [c.isBat]);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    playerXRef.current = 0;
    swingTimerRef.current = 0;
    runningRef.current = true;
    resetArenaRef.current();
    setScore(0);
    setSecondary(c.isBat ? 8 : 0);
    setNote('');
    setGameOver(false);
    setStarted(true);
    sound.playClick();
  }, [c.isBat]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, { fov: 50, bgColor: 0x060a14, fogNear: 20, fogFar: 55 });
    const { scene, camera } = studio;
    camera.position.set(0, 5.2, 8.2);
    camera.lookAt(0, 0.3, -1);

    // Table / Pitch
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(6.4, 0.3, 12.5),
      new THREE.MeshStandardMaterial({ color: c.tableColor, roughness: 0.45 })
    );
    table.position.set(0, -0.15, -1);
    scene.add(table);

    const lineMat = new THREE.MeshBasicMaterial({ color: c.isBat ? 0xf8fafc : 0x38bdf8 });
    const centerLine = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.04, 0.12), lineMat);
    centerLine.position.set(0, 0.02, c.isBat ? 4.2 : -1);
    scene.add(centerLine);

    const playerPad = new THREE.Mesh(
      c.isBat ? new THREE.BoxGeometry(2.1, 0.24, 0.35) : new THREE.BoxGeometry(1.7, 0.35, 0.45),
      new THREE.MeshPhysicalMaterial({ color: 0x22d3ee, emissive: 0x0891b2, emissiveIntensity: 0.5, clearcoat: 1 })
    );
    playerPad.position.set(0, 0.25, 4.4);
    scene.add(playerPad);

    const aiPad = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.35, 0.45),
      new THREE.MeshPhysicalMaterial({ color: 0xf43f5e, emissive: 0x9f1239, emissiveIntensity: 0.5, clearcoat: 1 })
    );
    aiPad.position.set(0, 0.25, -6.4);
    aiPad.visible = !c.isBat;
    scene.add(aiPad);

    const ball = new THREE.Mesh(
      variant === 'air-hockey' ? new THREE.CylinderGeometry(0.35, 0.35, 0.2, 20) : new THREE.SphereGeometry(0.26, 18, 18),
      new THREE.MeshPhysicalMaterial({ color: 0xfacc15, emissive: 0xca8a04, emissiveIntensity: 0.5, clearcoat: 1 })
    );
    ball.position.set(0, 0.26, 0);
    scene.add(ball);

    let bx = 0, bz = 0, bvx = 3.2, bvz = 7.5;
    let aiGoals = 0;
    let ballsLeft = 8;
    let ballHitBack = false;

    const resetRally = (dir = 1) => {
      bx = (Math.random() - 0.5) * 2.4;
      bz = c.isBat ? -6.5 : 0;
      bvx = c.isBat ? (Math.random() - 0.5) * 1.4 : (Math.random() > 0.5 ? 3.5 : -3.5);
      bvz = c.isBat ? 9.5 + Math.random() * 4 : 7.8 * dir;
      ballHitBack = false;
    };

    resetArenaRef.current = () => {
      aiGoals = 0;
      ballsLeft = 8;
      resetRally(1);
    };

    const stopLoop = studio.start((delta) => {
      const dt = Math.min(delta, 0.05);
      if (!runningRef.current) return;

      playerPad.position.x = THREE.MathUtils.damp(playerPad.position.x, playerXRef.current, 16, dt);

      if (c.isBat) {
        if (swingTimerRef.current > 0) {
          swingTimerRef.current = Math.max(0, swingTimerRef.current - dt);
          playerPad.rotation.y = Math.sin((swingTimerRef.current / 0.28) * Math.PI) * 0.85;
          playerPad.position.z = 4.1;
        } else {
          playerPad.rotation.y = 0;
          playerPad.position.z = 4.5;
        }

        bx += bvx * dt;
        bz += bvz * dt;
        const bounceY = variant === 'cricket' && !ballHitBack ? Math.abs(Math.sin(bz * 0.4)) * 0.55 + 0.25 : 0.35;
        ball.position.set(bx, bounceY, bz);

        if (!ballHitBack && swingTimerRef.current > 0 && Math.abs(bz - 4.2) < 1.1 && Math.abs(bx - playerPad.position.x) < 1.6) {
          ballHitBack = true;
          const quality = 1 - Math.abs(bz - 4.2) / 1.1;
          const pts = quality > 0.65 ? (variant === 'cricket' ? 60 : 80) : 30;
          scoreRef.current += pts;
          setScore(scoreRef.current);
          setNote(pts >= 60 ? (variant === 'cricket' ? 'MASSIVE SIX! +60' : 'HOME RUN! +80') : 'NICE HIT! +30');
          bvz = -18;
          bvx = (bx - playerPad.position.x) * 4;
          sound.playCoin();
        }

        if (bz > 6.5 || bz < -9.5) {
          if (!ballHitBack && bz > 6.5) {
            setNote('Bowled / Strike!');
            sound.playHit();
          }
          ballsLeft -= 1;
          setSecondary(ballsLeft);
          if (ballsLeft <= 0) {
            runningRef.current = false;
            setGameOver(true);
            onGameOverRef.current(scoreRef.current, Math.max(3, Math.floor(scoreRef.current / 25)));
          } else {
            resetRally(1);
          }
        }
      } else {
        // Rally Sports (Table Tennis / Air Hockey)
        bx += bvx * dt;
        bz += bvz * dt;
        if (bx > 2.8 || bx < -2.8) {
          bvx = -bvx;
          bx = THREE.MathUtils.clamp(bx, -2.8, 2.8);
          sound.playClick();
        }
        aiPad.position.x = THREE.MathUtils.damp(aiPad.position.x, THREE.MathUtils.clamp(bx, -2.3, 2.3), 5.2, dt);

        if (bvz > 0 && bz > 4.0 && bz < 4.8 && Math.abs(bx - playerPad.position.x) < 1.15) {
          bvz = -Math.min(14.5, Math.abs(bvz) + 0.45);
          bvx = (bx - playerPad.position.x) * 4.5;
          scoreRef.current += 20;
          setScore(scoreRef.current);
          sound.playPaddle();
        }
        if (bvz < 0 && bz < -5.9 && bz > -6.8 && Math.abs(bx - aiPad.position.x) < 1.15) {
          bvz = Math.abs(bvz) + 0.35;
          bvx = (bx - aiPad.position.x) * 3.8;
          sound.playPaddle();
        }

        if (bz < -7.5) {
          scoreRef.current += 75;
          setScore(scoreRef.current);
          setNote('GOAL SCORED! +75');
          sound.playCoin();
          resetRally(1);
        } else if (bz > 6.2) {
          aiGoals += 1;
          setSecondary(aiGoals);
          setNote(`Bot Scored (${aiGoals}/5)`);
          sound.playHit();
          if (aiGoals >= 5) {
            runningRef.current = false;
            setGameOver(true);
            onGameOverRef.current(scoreRef.current, Math.max(2, Math.floor(scoreRef.current / 25)));
          } else {
            resetRally(-1);
          }
        }
        ball.position.set(bx, 0.28, bz);
      }
    });

    return () => {
      stopLoop();
      studio.cleanup();
    };
  }, [c.isBat, c.tableColor, variant]);

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-md mx-auto">
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-white/15 rounded-xl text-xs font-mono tabular-nums">
        <span className="font-bold" style={{ color: c.accent }}>
          {c.isBat ? `Balls: ${secondary}/8` : `Bot Goals: ${secondary}/5`}
        </span>
        {note && <span className="text-amber-300 font-bold">{note}</span>}
        <span className="text-cyan-400 font-bold">Pts: {score}</span>
      </div>

      <div
        className="relative w-full h-[350px] rounded-2xl overflow-hidden border-2 bg-[#060a14] touch-none select-none"
        style={{ borderColor: `${c.accent}66` }}
        onPointerMove={(e) => {
          if (!runningRef.current || e.buttons === 0) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const norm = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          playerXRef.current = THREE.MathUtils.clamp(norm * 2.5, -2.5, 2.5);
        }}
        onPointerDown={(e) => {
          if (c.isBat) triggerSwing();
          else {
            const rect = e.currentTarget.getBoundingClientRect();
            const norm = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            playerXRef.current = THREE.MathUtils.clamp(norm * 2.5, -2.5, 2.5);
          }
        }}
      >
        <div ref={mountRef} className="w-full h-full touch-none" />
        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black mb-1" style={{ color: c.accent }}>MATCH COMPLETE!</h3>
                <p className="text-slate-300 text-sm mb-3">Score: {score} · +{Math.max(2, Math.floor(score / 25))} Coins</p>
                <button onClick={(e) => { e.stopPropagation(); startGame(); }} className="flex items-center gap-2 px-6 py-2.5 text-black font-extrabold rounded-xl active:scale-95" style={{ backgroundColor: c.accent }}>
                  <RotateCcw size={18} /> Rematch
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black mb-1" style={{ color: c.accent }}>{c.title}</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[250px]">{c.sub}</p>
                <button onClick={(e) => { e.stopPropagation(); startGame(); }} className="flex items-center gap-2 px-7 py-3 text-black font-extrabold rounded-xl shadow-lg active:scale-95" style={{ backgroundColor: c.accent }}>
                  <Play size={18} fill="currentColor" /> Play 3D Match
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {c.isBat ? (
        <button onPointerDown={(e) => { e.preventDefault(); triggerSwing(); }} className="w-full h-14 rounded-2xl text-black font-black text-base active:scale-95 touch-none" style={{ backgroundColor: c.accent }}>
          SWING BAT!
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-3 w-full max-w-[260px]">
          <button onPointerDown={(e) => { e.preventDefault(); movePaddle(-0.65); }} className="h-14 rounded-2xl bg-slate-800 border border-white/15 flex items-center justify-center text-white active:scale-95 touch-none">
            <ArrowLeft size={24} />
          </button>
          <button onPointerDown={(e) => { e.preventDefault(); movePaddle(0.65); }} className="h-14 rounded-2xl bg-slate-800 border border-white/15 flex items-center justify-center text-white active:scale-95 touch-none">
            <ArrowRight size={24} />
          </button>
        </div>
      )}
    </div>
  );
};
