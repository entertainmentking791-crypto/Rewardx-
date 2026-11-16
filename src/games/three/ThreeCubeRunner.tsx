import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../services/audio';
import { build3DCoin, createStudioContext, makeCanvasTexture } from './threeUtils';
import { ArrowLeft, ArrowRight, ArrowUp, Play, RotateCcw } from 'lucide-react';

interface Props {
  onGameOver: (score: number, coinsEarned: number) => void;
}

const LANE_X = [-2.2, 0, 2.2];

export const ThreeCubeRunner: React.FC<Props> = ({ onGameOver }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const laneRef = useRef(1);
  const jumpQueuedRef = useRef(false);
  const runningRef = useRef(false);
  const scoreRef = useRef(0);
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;
  const resetRef = useRef<() => void>(() => {});
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const shiftLane = useCallback((delta: number) => {
    if (!runningRef.current) return;
    const next = Math.max(0, Math.min(2, laneRef.current + delta));
    if (next !== laneRef.current) {
      laneRef.current = next;
      sound.playMove();
    }
  }, []);

  const triggerJump = useCallback(() => {
    if (!runningRef.current) return;
    jumpQueuedRef.current = true;
  }, []);

  const startGame = useCallback(() => {
    resetRef.current();
    laneRef.current = 1;
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
      fov: 58,
      bgColor: 0x071020,
      fogNear: 20,
      fogFar: 82,
    });
    const { scene, camera, renderer } = studio;
    camera.position.set(0, 4.6, 7.2);
    camera.lookAt(0, 1.2, -10);

    const trackTex = makeCanvasTexture(
      renderer,
      256,
      256,
      (ctx, w, h) => {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(w / 3, 0);
        ctx.lineTo(w / 3, h);
        ctx.moveTo((2 * w) / 3, 0);
        ctx.lineTo((2 * w) / 3, h);
        ctx.stroke();
      },
      1,
      14
    );

    const track = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 0.5, 130),
      new THREE.MeshStandardMaterial({ map: trackTex, roughness: 0.45, metalness: 0.2 })
    );
    track.position.set(0, -0.25, -48);
    track.receiveShadow = true;
    scene.add(track);

    // Sky hover-bot runner (composite 5-part grounded at y=0)
    const runner = new THREE.Group();
    const botMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, metalness: 0.6, roughness: 0.25 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.65 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.9, 0.8), botMat);
    torso.position.y = 0.72;
    torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.5, 0.65), botMat);
    head.position.y = 1.45;
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.22, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 1.5 })
    );
    visor.position.set(0, 1.48, -0.32);
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.16, 1.35), trimMat);
    board.position.y = 0.12;
    const thruster = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.18, 0.2, 12),
      new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xf43f5e, emissiveIntensity: 1.6 })
    );
    thruster.position.set(0, 0.12, 0.62);
    thruster.rotation.x = Math.PI / 2;
    runner.add(torso, head, visor, board, thruster);
    runner.position.set(0, 0, 1.2);
    scene.add(runner);

    interface Obstacle {
      mesh: THREE.Mesh;
      lane: number;
      z: number;
      tall: boolean;
    }
    interface Orb {
      mesh: THREE.Group;
      lane: number;
      z: number;
    }

    const obstacles: Obstacle[] = [];
    const orbs: Orb[] = [];
    let vy = 0;
    let grounded = true;
    let speed = 20;
    let spawnTimer = 0.8;
    let orbTimer = 0.5;
    let dist = 0;

    resetRef.current = () => {
      obstacles.forEach((o) => scene.remove(o.mesh));
      orbs.forEach((o) => scene.remove(o.mesh));
      obstacles.length = 0;
      orbs.length = 0;
      runner.position.set(0, 0, 1.2);
      vy = 0;
      grounded = true;
      speed = 20;
      spawnTimer = 0.8;
      orbTimer = 0.5;
      dist = 0;
    };

    const stopLoop = studio.start((delta, elapsed) => {
      const dt = Math.min(delta, 0.05);
      runner.position.x = THREE.MathUtils.damp(runner.position.x, LANE_X[laneRef.current], 15, dt);

      if (!runningRef.current) {
        trackTex.offset.y -= dt * 1.5;
        runner.position.y = Math.sin(elapsed * 4) * 0.08 + 0.08;
        return;
      }

      if (jumpQueuedRef.current && grounded) {
        vy = 12.8;
        grounded = false;
        sound.playJump();
      }
      jumpQueuedRef.current = false;

      vy -= 34 * dt;
      runner.position.y += vy * dt;
      if (runner.position.y <= 0) {
        runner.position.y = 0;
        vy = 0;
        grounded = true;
      }

      speed = Math.min(38, speed + dt * 0.65);
      trackTex.offset.y -= dt * (speed / 7.5);
      dist += dt * 10;
      const nextScore = Math.floor(dist);
      if (nextScore !== scoreRef.current) {
        scoreRef.current = nextScore;
        setScore(nextScore);
      }

      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        const lane = Math.floor(Math.random() * 3);
        const tall = Math.random() > 0.55;
        const h = tall ? 2.4 : 1.05;
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.55, h, 1.15),
          new THREE.MeshStandardMaterial({
            color: tall ? 0xf43f5e : 0xf97316,
            emissive: tall ? 0x9f1239 : 0x9a3412,
            emissiveIntensity: 0.6,
            roughness: 0.3,
          })
        );
        mesh.position.set(LANE_X[lane], h / 2, -72);
        mesh.castShadow = true;
        scene.add(mesh);
        obstacles.push({ mesh, lane, z: -72, tall });
        spawnTimer = Math.max(0.55, 1.25 - (speed - 20) * 0.028);
      }

      orbTimer -= dt;
      if (orbTimer <= 0) {
        const lane = Math.floor(Math.random() * 3);
        const orb = build3DCoin();
        orb.position.set(LANE_X[lane], 0.85, -72);
        scene.add(orb);
        orbs.push({ mesh: orb, lane, z: -72 });
        orbTimer = 0.7;
      }

      for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        o.z += speed * dt;
        o.mesh.position.z = o.z;

        const hitZ = Math.abs(o.z - runner.position.z) < 0.95;
        const hitX = Math.abs(LANE_X[o.lane] - runner.position.x) < 1.05;
        const clearY = !o.tall && runner.position.y > 0.95;

        if (hitZ && hitX && !clearY) {
          runningRef.current = false;
          setGameOver(true);
          sound.playHit();
          const earned = Math.max(1, Math.floor(scoreRef.current / 20));
          onGameOverRef.current(scoreRef.current, earned);
          break;
        }

        if (o.z > 10) {
          scene.remove(o.mesh);
          obstacles.splice(i, 1);
        }
      }

      for (let i = orbs.length - 1; i >= 0; i--) {
        const c = orbs[i];
        c.z += speed * dt;
        c.mesh.position.z = c.z;
        c.mesh.rotation.y += dt * 4;

        if (
          Math.abs(c.z - runner.position.z) < 1.2 &&
          Math.abs(LANE_X[c.lane] - runner.position.x) < 1.2 &&
          runner.position.y < 1.7
        ) {
          dist += 20;
          scoreRef.current = Math.floor(dist);
          setScore(scoreRef.current);
          sound.playCoin();
          scene.remove(c.mesh);
          orbs.splice(i, 1);
          continue;
        }

        if (c.z > 10) {
          scene.remove(c.mesh);
          orbs.splice(i, 1);
        }
      }
    });

    return () => {
      stopLoop();
      trackTex.dispose();
      studio.cleanup();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyA', 'KeyD', 'KeyW'].includes(e.code)) {
        e.preventDefault();
      }
      if (!runningRef.current) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') shiftLane(-1);
      if (e.code === 'ArrowRight' || e.code === 'KeyD') shiftLane(1);
      if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') triggerJump();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shiftLane, triggerJump]);

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-md mx-auto">
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-cyan-500/30 rounded-xl text-sm font-mono tabular-nums">
        <span className="text-cyan-400 font-bold">3D Sky Surfer · {score}</span>
        <span className="text-amber-400">+{Math.floor(score / 20)} Coins</span>
      </div>

      <div className="relative w-full h-[360px] rounded-2xl overflow-hidden border-2 border-cyan-500/40 bg-[#071020] touch-none select-none">
        <div
          ref={mountRef}
          className="w-full h-full touch-none"
          onPointerDown={(e) => {
            swipeStartRef.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            if (!runningRef.current || !swipeStartRef.current) return;
            const dx = e.clientX - swipeStartRef.current.x;
            const dy = e.clientY - swipeStartRef.current.y;
            swipeStartRef.current = null;
            if (Math.abs(dy) > Math.abs(dx) && dy < -20) {
              triggerJump();
            } else if (Math.abs(dx) > 22) {
              shiftLane(dx > 0 ? 1 : -1);
            } else {
              triggerJump();
            }
          }}
        />

        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black text-rose-500 mb-1">WIPEOUT!</h3>
                <p className="text-slate-300 text-sm mb-3">
                  Score: <span className="text-cyan-400 font-bold">{score}</span> · +{Math.max(1, Math.floor(score / 20))} Coins
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-6 py-2.5 bg-cyan-500 text-black font-extrabold rounded-xl active:scale-95"
                >
                  <RotateCcw size={18} /> Run Again
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black text-cyan-400 mb-1">3D Sky Surfer</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[240px]">
                  Swipe or tap buttons to dodge tall red walls and leap over orange low barriers!
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-7 py-3 bg-cyan-500 text-black font-extrabold rounded-xl shadow-lg shadow-cyan-500/30 active:scale-95"
                >
                  <Play size={18} fill="currentColor" /> Start 3D Run
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5 w-full max-w-[300px]">
        <button
          onPointerDown={(e) => { e.preventDefault(); shiftLane(-1); }}
          className="h-14 rounded-xl bg-slate-800 border border-cyan-500/30 flex items-center justify-center text-cyan-400 active:bg-cyan-500 active:text-black touch-none select-none"
        >
          <ArrowLeft size={22} />
        </button>
        <button
          onPointerDown={(e) => { e.preventDefault(); triggerJump(); }}
          className="h-14 rounded-xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center gap-1 text-cyan-300 font-bold text-xs active:bg-cyan-500 active:text-black touch-none select-none"
        >
          <ArrowUp size={20} /> JUMP
        </button>
        <button
          onPointerDown={(e) => { e.preventDefault(); shiftLane(1); }}
          className="h-14 rounded-xl bg-slate-800 border border-cyan-500/30 flex items-center justify-center text-cyan-400 active:bg-cyan-500 active:text-black touch-none select-none"
        >
          <ArrowRight size={22} />
        </button>
      </div>
    </div>
  );
};
