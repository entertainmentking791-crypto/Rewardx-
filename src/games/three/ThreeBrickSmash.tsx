import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../services/audio';
import { createStudioContext } from './threeUtils';
import { ArrowLeft, ArrowRight, Play, RotateCcw } from 'lucide-react';

interface Props {
  onGameOver: (score: number, coinsEarned: number) => void;
}

export const ThreeBrickSmash: React.FC<Props> = ({ onGameOver }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const paddleTargetXRef = useRef(0);
  const steerRef = useRef(0);
  const runningRef = useRef(false);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;
  const resetArenaRef = useRef<() => void>(() => {});

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    livesRef.current = 3;
    paddleTargetXRef.current = 0;
    runningRef.current = true;
    resetArenaRef.current();
    setScore(0);
    setLives(3);
    setGameOver(false);
    setStarted(true);
    sound.playClick();
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, {
      fov: 52,
      bgColor: 0x0b0518,
      fogNear: 20,
      fogFar: 65,
    });
    const { scene, camera } = studio;
    camera.position.set(0, 12.2, 9.8);
    camera.lookAt(0, 0, -0.5);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(11.6, 15.5),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.55, metalness: 0.2 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -0.5;
    floor.receiveShadow = true;
    scene.add(floor);

    // Arena side rails
    const railMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x7e22ce, emissiveIntensity: 0.8 });
    const leftRail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 15.5), railMat);
    leftRail.position.set(-5.8, 0.35, -0.5);
    const rightRail = leftRail.clone();
    rightRail.position.x = 5.8;
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(11.9, 0.7, 0.3), railMat);
    topRail.position.set(0, 0.35, -8.25);
    scene.add(leftRail, rightRail, topRail);

    // 3D Paddle (composite)
    const paddle = new THREE.Group();
    const padCore = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.45, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0891b2, emissiveIntensity: 0.8, metalness: 0.5, roughness: 0.2 })
    );
    padCore.castShadow = true;
    paddle.add(padCore);
    paddle.position.set(0, 0.25, 5.8);
    scene.add(paddle);

    // Energy ball
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 18, 18),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 1.4 })
    );
    ball.position.set(0, 0.32, 4.2);
    scene.add(ball);

    interface Brick {
      mesh: THREE.Mesh;
      x: number;
      z: number;
      alive: boolean;
    }

    const bricks: Brick[] = [];
    const brickGeo = new THREE.BoxGeometry(1.55, 0.55, 0.75);
    const rowColors = [0xf43f5e, 0xa855f7, 0x3b82f6, 0x10b981];

    let vx = 4.6;
    let vz = -6.8;

    const buildBricks = () => {
      bricks.forEach((b) => scene.remove(b.mesh));
      bricks.length = 0;

      for (let r = 0; r < 4; r++) {
        const mat = new THREE.MeshStandardMaterial({
          color: rowColors[r],
          emissive: rowColors[r],
          emissiveIntensity: 0.35,
          roughness: 0.25,
          metalness: 0.3,
        });
        for (let c = 0; c < 6; c++) {
          const x = -4.35 + c * 1.74;
          const z = -6.4 + r * 1.05;
          const m = new THREE.Mesh(brickGeo, mat);
          m.position.set(x, 0.28, z);
          m.castShadow = true;
          scene.add(m);
          bricks.push({ mesh: m, x, z, alive: true });
        }
      }
      ball.position.set(0, 0.32, 4.2);
      vx = (Math.random() > 0.5 ? 1 : -1) * 4.8;
      vz = -6.8;
    };

    buildBricks();
    resetArenaRef.current = buildBricks;

    const stopLoop = studio.start((delta) => {
      const dt = Math.min(delta, 0.05);

      if (!runningRef.current) return;

      if (steerRef.current !== 0) {
        paddleTargetXRef.current = THREE.MathUtils.clamp(paddleTargetXRef.current + steerRef.current * dt * 11, -4.3, 4.3);
      }
      paddle.position.x = THREE.MathUtils.damp(paddle.position.x, paddleTargetXRef.current, 18, dt);

      ball.position.x += vx * dt;
      ball.position.z += vz * dt;

      if (ball.position.x < -5.3) { ball.position.x = -5.3; vx = Math.abs(vx); sound.playPaddle(); }
      if (ball.position.x > 5.3) { ball.position.x = 5.3; vx = -Math.abs(vx); sound.playPaddle(); }
      if (ball.position.z < -7.75) { ball.position.z = -7.75; vz = Math.abs(vz); sound.playPaddle(); }

      // Paddle collision
      if (
        vz > 0 &&
        Math.abs(ball.position.z - paddle.position.z) < 0.55 &&
        Math.abs(ball.position.x - paddle.position.x) < 1.55
      ) {
        const hitOffset = (ball.position.x - paddle.position.x) / 1.3;
        vx = hitOffset * 8.2;
        vz = -Math.min(11.5, Math.abs(vz) + 0.18);
        sound.playPaddle();
      }

      // Brick collisions
      let remaining = 0;
      for (const b of bricks) {
        if (!b.alive) continue;
        remaining++;
        if (Math.abs(ball.position.x - b.x) < 1.0 && Math.abs(ball.position.z - b.z) < 0.62) {
          b.alive = false;
          scene.remove(b.mesh);
          vz = -vz;
          scoreRef.current += 15;
          setScore(scoreRef.current);
          sound.playCoin();
          remaining--;
          break;
        }
      }

      if (remaining === 0) {
        scoreRef.current += 50;
        setScore(scoreRef.current);
        sound.playVictory();
        buildBricks();
      }

      if (ball.position.z > 7.4) {
        livesRef.current -= 1;
        setLives(livesRef.current);
        sound.playHit();
        if (livesRef.current <= 0) {
          runningRef.current = false;
          setGameOver(true);
          onGameOverRef.current(scoreRef.current, Math.max(1, Math.floor(scoreRef.current / 20)));
        } else {
          ball.position.set(paddle.position.x, 0.32, 4.2);
          vx = 4.6;
          vz = -6.8;
        }
      }
    });

    return () => {
      stopLoop();
      brickGeo.dispose();
      studio.cleanup();
    };
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) e.preventDefault();
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') steerRef.current = -1;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') steerRef.current = 1;
    };
    const up = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(e.code)) steerRef.current = 0;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const handleTouchPaddle = (clientX: number, rect: DOMRect) => {
    const norm = ((clientX - rect.left) / rect.width) * 2 - 1;
    paddleTargetXRef.current = THREE.MathUtils.clamp(norm * 4.4, -4.3, 4.3);
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-md mx-auto">
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-fuchsia-500/30 rounded-xl text-sm font-mono tabular-nums">
        <span className="text-fuchsia-400 font-bold">3D Breaker · {score}</span>
        <span className="text-rose-400">{'♥'.repeat(Math.max(0, lives))}</span>
      </div>

      <div className="relative w-full h-[360px] rounded-2xl overflow-hidden border-2 border-fuchsia-500/40 bg-[#0b0518] touch-none select-none">
        <div
          ref={mountRef}
          className="w-full h-full touch-none"
          onPointerDown={(e) => {
            if (!runningRef.current) return;
            handleTouchPaddle(e.clientX, e.currentTarget.getBoundingClientRect());
          }}
          onPointerMove={(e) => {
            if (!runningRef.current || e.buttons === 0) return;
            handleTouchPaddle(e.clientX, e.currentTarget.getBoundingClientRect());
          }}
        />

        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black text-rose-500 mb-1">ARENA CLEARED?</h3>
                <p className="text-slate-300 text-sm mb-3">
                  Score: <span className="text-fuchsia-400 font-bold">{score}</span> · +{Math.max(1, Math.floor(score / 20))} Coins
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-6 py-2.5 bg-fuchsia-500 text-white font-extrabold rounded-xl active:scale-95"
                >
                  <RotateCcw size={18} /> Play Again
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black text-fuchsia-400 mb-1">3D Breaker Arena</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[240px]">
                  Slide your 3D cyber paddle left and right to smash all 24 glowing 3D blocks!
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-7 py-3 bg-fuchsia-500 text-white font-extrabold rounded-xl shadow-lg shadow-fuchsia-500/30 active:scale-95"
                >
                  <Play size={18} fill="currentColor" /> Start 3D Arena
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-[280px]">
        <button
          onPointerDown={(e) => { e.preventDefault(); steerRef.current = -1; }}
          onPointerUp={() => { steerRef.current = 0; }}
          onPointerLeave={() => { steerRef.current = 0; }}
          className="h-14 rounded-xl bg-slate-800 border border-fuchsia-500/30 flex items-center justify-center gap-2 text-fuchsia-300 font-bold active:bg-fuchsia-500 active:text-white touch-none select-none"
        >
          <ArrowLeft size={22} /> LEFT
        </button>
        <button
          onPointerDown={(e) => { e.preventDefault(); steerRef.current = 1; }}
          onPointerUp={() => { steerRef.current = 0; }}
          onPointerLeave={() => { steerRef.current = 0; }}
          className="h-14 rounded-xl bg-slate-800 border border-fuchsia-500/30 flex items-center justify-center gap-2 text-fuchsia-300 font-bold active:bg-fuchsia-500 active:text-white touch-none select-none"
        >
          RIGHT <ArrowRight size={22} />
        </button>
      </div>
    </div>
  );
};
