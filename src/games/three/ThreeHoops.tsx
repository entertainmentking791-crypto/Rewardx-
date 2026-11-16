import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../services/audio';
import { createStudioContext } from './threeUtils';
import { ArrowLeft, ArrowRight, Play, RotateCcw } from 'lucide-react';

interface Props {
  onGameOver: (score: number, coinsEarned: number) => void;
}

export const ThreeHoops: React.FC<Props> = ({ onGameOver }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [shotsLeft, setShotsLeft] = useState(7);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [powerDisplay, setPowerDisplay] = useState(50);

  const aimXRef = useRef(0);
  const shootQueuedRef = useRef(false);
  const shootingRef = useRef(false);
  const runningRef = useRef(false);
  const scoreRef = useRef(0);
  const shotsRef = useRef(7);
  const powerRef = useRef(0.5);
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;
  const resetBallRef = useRef<() => void>(() => {});

  const nudgeAim = useCallback((dx: number) => {
    if (!runningRef.current || shootingRef.current) return;
    aimXRef.current = THREE.MathUtils.clamp(aimXRef.current + dx, -1.8, 1.8);
    sound.playMove();
  }, []);

  const shoot = useCallback(() => {
    if (!runningRef.current || shootingRef.current) return;
    shootQueuedRef.current = true;
  }, []);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    shotsRef.current = 7;
    aimXRef.current = 0;
    shootingRef.current = false;
    shootQueuedRef.current = false;
    runningRef.current = true;
    resetBallRef.current();
    setScore(0);
    setShotsLeft(7);
    setGameOver(false);
    setStarted(true);
    sound.playClick();
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, {
      fov: 54,
      bgColor: 0x0a0918,
      fogNear: 20,
      fogFar: 65,
    });
    const { scene, camera } = studio;
    camera.position.set(0, 3.6, 8.6);
    camera.lookAt(0, 2.8, -6);

    // Court floor
    const court = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 26),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.1 })
    );
    court.rotation.x = -Math.PI / 2;
    court.position.z = -3;
    court.receiveShadow = true;
    scene.add(court);

    // Hoop stand (composite 5-part)
    const hoopGroup = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.2, 5.2, 12),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 })
    );
    pole.position.set(0, 2.6, -7.8);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 2.1, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.3 })
    );
    board.position.set(0, 4.4, -7.0);
    const boardFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.9, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.8 })
    );
    boardFrame.position.set(0, 4.2, -6.99);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.68, 0.06, 10, 24),
      new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.3 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 3.7, -6.15);
    const net = new THREE.Mesh(
      new THREE.CylinderGeometry(0.64, 0.42, 0.9, 12, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, wireframe: true })
    );
    net.position.set(0, 3.25, -6.15);
    hoopGroup.add(pole, board, boardFrame, rim, net);
    scene.add(hoopGroup);

    // 3D Basketball
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 22, 22),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45, metalness: 0.05 })
    );
    ball.castShadow = true;
    ball.position.set(0, 1.4, 3.5);
    scene.add(ball);

    const vel = new THREE.Vector3();
    let scoredThisShot = false;
    let shotClock = 0;

    resetBallRef.current = () => {
      ball.position.set(aimXRef.current, 1.4, 3.5);
      vel.set(0, 0, 0);
      shootingRef.current = false;
      scoredThisShot = false;
      shotClock = 0;
    };

    const stopLoop = studio.start((delta, elapsed) => {
      const dt = Math.min(delta, 0.05);

      if (runningRef.current && !shootingRef.current) {
        const p = (Math.sin(elapsed * 3.4) + 1) / 2;
        powerRef.current = p;
        setPowerDisplay(Math.round(p * 100));
        ball.position.x = THREE.MathUtils.damp(ball.position.x, aimXRef.current, 14, dt);
        ball.position.y = 1.4 + Math.sin(elapsed * 4) * 0.06;

        // Move hoop slightly after 20+ points
        const sway = scoreRef.current >= 20 ? Math.sin(elapsed * 1.4) * 1.3 : 0;
        hoopGroup.position.x = sway;
      } else if (runningRef.current && shootingRef.current) {
        const sway = scoreRef.current >= 20 ? Math.sin(elapsed * 1.4) * 1.3 : 0;
        hoopGroup.position.x = sway;
      }

      if (shootQueuedRef.current && !shootingRef.current) {
        shootQueuedRef.current = false;
        shootingRef.current = true;
        scoredThisShot = false;
        shotClock = 0;
        const p = powerRef.current;
        const speedZ = -(7.4 + p * 3.6);
        const speedY = 7.8 + p * 3.8;
        vel.set((0 - ball.position.x) * 0.25, speedY, speedZ);
        sound.playJump();
      }

      if (shootingRef.current) {
        shotClock += dt;
        vel.y -= 13.5 * dt;
        ball.position.addScaledVector(vel, dt);
        ball.rotation.x -= dt * 8;

        // Rim center in world space
        const rimX = hoopGroup.position.x;
        const rimY = 3.7;
        const rimZ = -6.15;

        const dx = ball.position.x - rimX;
        const dz = ball.position.z - rimZ;
        const horizDist = Math.hypot(dx, dz);

        if (!scoredThisShot && vel.y < 0 && Math.abs(ball.position.y - rimY) < 0.36 && horizDist < 0.56) {
          scoredThisShot = true;
          scoreRef.current += 10;
          setScore(scoreRef.current);
          sound.playCoin();
        } else if (Math.abs(ball.position.y - rimY) < 0.32 && horizDist > 0.52 && horizDist < 0.85) {
          vel.z *= -0.45;
          vel.y = Math.abs(vel.y) * 0.5;
          sound.playPaddle();
        }

        if (ball.position.y < 0.38) {
          ball.position.y = 0.38;
          vel.y = Math.abs(vel.y) * 0.55;
        }

        if (shotClock > 2.3 || ball.position.z < -10) {
          shotsRef.current -= 1;
          setShotsLeft(shotsRef.current);
          if (shotsRef.current <= 0) {
            shootingRef.current = false;
            runningRef.current = false;
            setGameOver(true);
            onGameOverRef.current(scoreRef.current, Math.max(2, Math.floor(scoreRef.current / 5)));
          } else {
            resetBallRef.current();
          }
        }
      }
    });

    return () => {
      stopLoop();
      studio.cleanup();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'Space', 'KeyA', 'KeyD'].includes(e.code)) e.preventDefault();
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') nudgeAim(-0.35);
      if (e.code === 'ArrowRight' || e.code === 'KeyD') nudgeAim(0.35);
      if (e.code === 'Space') shoot();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nudgeAim, shoot]);

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-md mx-auto">
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-orange-500/30 rounded-xl text-sm font-mono tabular-nums">
        <span className="text-orange-400 font-bold">3D Dunk · {score}</span>
        <span className="text-cyan-400">Shots: {shotsLeft}</span>
      </div>

      <div className="relative w-full h-[360px] rounded-2xl overflow-hidden border-2 border-orange-500/40 bg-[#0a0918] touch-none select-none">
        <div
          ref={mountRef}
          className="w-full h-full touch-none"
          onPointerDown={(e) => {
            if (!runningRef.current || shootingRef.current) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const norm = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            aimXRef.current = THREE.MathUtils.clamp(norm * 1.8, -1.8, 1.8);
            shoot();
          }}
        />

        {started && !gameOver && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-44 bg-black/70 border border-white/15 rounded-full p-1 pointer-events-none">
            <div className="h-2.5 rounded-full bg-gradient-to-r from-rose-500 via-emerald-400 to-rose-500 relative overflow-hidden">
              <div
                className="absolute top-0 bottom-0 w-1.5 bg-white shadow"
                style={{ left: `calc(${powerDisplay}% - 3px)` }}
              />
            </div>
          </div>
        )}

        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black text-orange-400 mb-1">BUZZER!</h3>
                <p className="text-slate-300 text-sm mb-3">
                  Final Score: <span className="text-white font-bold">{score}</span> · +{Math.max(2, Math.floor(score / 5))} Coins
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 text-black font-extrabold rounded-xl active:scale-95"
                >
                  <RotateCcw size={18} /> Play Again
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black text-orange-400 mb-1">3D Street Dunk</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[240px]">
                  Time the green center of the power bar and tap SHOOT to sink 3D baskets!
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-7 py-3 bg-orange-500 text-black font-extrabold rounded-xl shadow-lg shadow-orange-500/30 active:scale-95"
                >
                  <Play size={18} fill="currentColor" /> Start Shooting
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5 w-full max-w-[300px]">
        <button
          onPointerDown={(e) => { e.preventDefault(); nudgeAim(-0.35); }}
          className="h-14 rounded-xl bg-slate-800 border border-orange-500/30 flex items-center justify-center text-orange-300 active:bg-orange-500 active:text-black touch-none select-none"
        >
          <ArrowLeft size={22} />
        </button>
        <button
          onPointerDown={(e) => { e.preventDefault(); shoot(); }}
          className="h-14 rounded-xl bg-orange-500 text-black font-extrabold text-sm active:scale-95 touch-none select-none"
        >
          SHOOT!
        </button>
        <button
          onPointerDown={(e) => { e.preventDefault(); nudgeAim(0.35); }}
          className="h-14 rounded-xl bg-slate-800 border border-orange-500/30 flex items-center justify-center text-orange-300 active:bg-orange-500 active:text-black touch-none select-none"
        >
          <ArrowRight size={22} />
        </button>
      </div>
    </div>
  );
};
