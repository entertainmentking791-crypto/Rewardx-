import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../services/audio';
import { build3DCoin, buildSportsCar, createStudioContext, makeCanvasTexture } from './threeUtils';
import { ArrowLeft, ArrowRight, Play, RotateCcw } from 'lucide-react';

interface Props {
  onGameOver: (score: number, coinsEarned: number) => void;
}

const LANE_X = [-2.5, 0, 2.5];

export const ThreeCarDrift: React.FC<Props> = ({ onGameOver }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const laneRef = useRef(1);
  const runningRef = useRef(false);
  const gameOverRef = useRef(false);
  const scoreRef = useRef(0);
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;
  const resetSceneRef = useRef<() => void>(() => {});
  const pointerStartXRef = useRef<number | null>(null);

  const shiftLane = useCallback((delta: number) => {
    if (!runningRef.current) return;
    const next = Math.max(0, Math.min(2, laneRef.current + delta));
    if (next !== laneRef.current) {
      laneRef.current = next;
      sound.playMove();
    }
  }, []);

  const startGame = useCallback(() => {
    resetSceneRef.current();
    laneRef.current = 1;
    scoreRef.current = 0;
    runningRef.current = true;
    gameOverRef.current = false;
    setScore(0);
    setGameOver(false);
    setStarted(true);
    sound.playClick();
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, {
      fov: 60,
      bgColor: 0x050816,
      fogNear: 20,
      fogFar: 85,
    });
    const { scene, camera, renderer } = studio;
    camera.position.set(0, 4.4, 6.8);
    camera.lookAt(0, 1.0, -8);

    // Asphalt highway texture
    const roadTex = makeCanvasTexture(
      renderer,
      256,
      256,
      (ctx, w, h) => {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#22d3ee';
        ctx.fillRect(0, 0, 8, h);
        ctx.fillRect(w - 8, 0, 8, h);
        ctx.fillStyle = 'rgba(248, 250, 252, 0.55)';
        ctx.fillRect(w * 0.33 - 2, 16, 4, 88);
        ctx.fillRect(w * 0.66 - 2, 16, 4, 88);
        ctx.fillRect(w * 0.33 - 2, 144, 4, 88);
        ctx.fillRect(w * 0.66 - 2, 144, 4, 88);
      },
      1,
      10
    );

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(8.6, 140),
      new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.72, metalness: 0.1 })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.z = -50;
    road.receiveShadow = true;
    scene.add(road);

    // Extended dark terrain outside road
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 160),
      new THREE.MeshStandardMaterial({ color: 0x030712, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.04, -50);
    scene.add(ground);

    // Roadside neon light pillars
    const pillarGeo = new THREE.BoxGeometry(0.28, 3.2, 0.28);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.4,
    });
    const pillars: THREE.Mesh[] = [];
    for (let i = 0; i < 12; i++) {
      const pL = new THREE.Mesh(pillarGeo, pillarMat);
      pL.position.set(-5.0, 1.6, -i * 10);
      const pR = new THREE.Mesh(pillarGeo, pillarMat);
      pR.position.set(5.0, 1.6, -i * 10);
      scene.add(pL, pR);
      pillars.push(pL, pR);
    }

    const playerCar = buildSportsCar(0x0ea5e9, 0x22d3ee);
    playerCar.position.set(0, 0, 1.2);
    scene.add(playerCar);

    interface TrafficItem {
      mesh: THREE.Group;
      lane: number;
      z: number;
    }
    interface CoinItem {
      mesh: THREE.Group;
      lane: number;
      z: number;
    }

    const traffic: TrafficItem[] = [];
    const coins: CoinItem[] = [];
    let spawnTimer = 0;
    let coinTimer = 0.5;
    let speed = 22;
    let distScore = 0;

    resetSceneRef.current = () => {
      traffic.forEach((t) => scene.remove(t.mesh));
      coins.forEach((c) => scene.remove(c.mesh));
      traffic.length = 0;
      coins.length = 0;
      spawnTimer = 0;
      coinTimer = 0.5;
      speed = 22;
      distScore = 0;
      playerCar.position.set(0, 0, 1.2);
      playerCar.rotation.z = 0;
    };

    const stopLoop = studio.start((delta) => {
      const dt = Math.min(delta, 0.05);

      // Smooth car steering
      const targetX = LANE_X[laneRef.current];
      const prevX = playerCar.position.x;
      playerCar.position.x = THREE.MathUtils.damp(playerCar.position.x, targetX, 14, dt);
      playerCar.rotation.z = THREE.MathUtils.clamp((prevX - playerCar.position.x) * 1.6, -0.25, 0.25);

      if (!runningRef.current) {
        roadTex.offset.y -= dt * 1.4;
        return;
      }

      speed = Math.min(48, speed + dt * 0.85);
      roadTex.offset.y -= dt * (speed / 7.5);

      distScore += dt * 10;
      const nextScore = Math.floor(distScore);
      if (nextScore !== scoreRef.current) {
        scoreRef.current = nextScore;
        setScore(nextScore);
      }

      for (const p of pillars) {
        p.position.z += speed * dt;
        if (p.position.z > 10) p.position.z -= 120;
      }

      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        const lane = Math.floor(Math.random() * 3);
        const colors = [0xef4444, 0xa855f7, 0xf97316];
        const car = buildSportsCar(colors[Math.floor(Math.random() * colors.length)], 0xfacc15);
        car.rotation.y = Math.PI;
        car.position.set(LANE_X[lane], 0, -82);
        scene.add(car);
        traffic.push({ mesh: car, lane, z: -82 });
        spawnTimer = Math.max(0.48, 1.25 - (speed - 22) * 0.024);
      }

      coinTimer -= dt;
      if (coinTimer <= 0) {
        const lane = Math.floor(Math.random() * 3);
        const coin = build3DCoin();
        coin.position.set(LANE_X[lane], 0.75, -82);
        scene.add(coin);
        coins.push({ mesh: coin, lane, z: -82 });
        coinTimer = 0.85;
      }

      for (let i = traffic.length - 1; i >= 0; i--) {
        const t = traffic[i];
        t.z += speed * 0.82 * dt;
        t.mesh.position.z = t.z;

        if (
          Math.abs(t.z - playerCar.position.z) < 2.25 &&
          Math.abs(LANE_X[t.lane] - playerCar.position.x) < 1.2
        ) {
          runningRef.current = false;
          gameOverRef.current = true;
          setGameOver(true);
          sound.playHit();
          const earned = Math.max(1, Math.floor(scoreRef.current / 20));
          onGameOverRef.current(scoreRef.current, earned);
          break;
        }

        if (t.z > 12) {
          scene.remove(t.mesh);
          traffic.splice(i, 1);
        }
      }

      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i];
        c.z += speed * dt;
        c.mesh.position.z = c.z;
        c.mesh.rotation.y += dt * 4;

        if (
          Math.abs(c.z - playerCar.position.z) < 1.65 &&
          Math.abs(LANE_X[c.lane] - playerCar.position.x) < 1.3
        ) {
          distScore += 25;
          scoreRef.current = Math.floor(distScore);
          setScore(scoreRef.current);
          sound.playCoin();
          scene.remove(c.mesh);
          coins.splice(i, 1);
          continue;
        }

        if (c.z > 12) {
          scene.remove(c.mesh);
          coins.splice(i, 1);
        }
      }
    });

    return () => {
      stopLoop();
      roadTex.dispose();
      studio.cleanup();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) {
        e.preventDefault();
      }
      if (!runningRef.current) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') shiftLane(-1);
      if (e.code === 'ArrowRight' || e.code === 'KeyD') shiftLane(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shiftLane]);

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-md mx-auto">
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-blue-500/30 rounded-xl text-sm font-mono tabular-nums">
        <span className="text-cyan-400 font-bold">3D Highway · {score}</span>
        <span className="text-amber-400">+{Math.floor(score / 20)} Coins</span>
      </div>

      <div className="relative w-full h-[360px] rounded-2xl overflow-hidden border-2 border-cyan-500/40 bg-[#050816] touch-none select-none">
        <div
          ref={mountRef}
          className="w-full h-full touch-none"
          onPointerDown={(e) => { pointerStartXRef.current = e.clientX; }}
          onPointerUp={(e) => {
            if (!runningRef.current || pointerStartXRef.current === null) return;
            const dx = e.clientX - pointerStartXRef.current;
            pointerStartXRef.current = null;
            if (Math.abs(dx) > 22) {
              shiftLane(dx > 0 ? 1 : -1);
            } else {
              const rect = e.currentTarget.getBoundingClientRect();
              shiftLane(e.clientX - rect.left < rect.width / 2 ? -1 : 1);
            }
          }}
        />

        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black text-rose-500 mb-1">CRASHED!</h3>
                <p className="text-slate-300 text-sm mb-3">
                  Score: <span className="text-cyan-400 font-bold">{score}</span> · +{Math.max(1, Math.floor(score / 20))} Coins
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-6 py-2.5 bg-cyan-500 text-black font-extrabold rounded-xl active:scale-95"
                >
                  <RotateCcw size={18} /> Race Again
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black text-cyan-400 mb-1">3D Neon Highway</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[240px]">
                  Swipe left/right or tap lanes to dodge 3D traffic and collect spinning coins!
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-7 py-3 bg-cyan-500 text-black font-extrabold rounded-xl shadow-lg shadow-cyan-500/30 active:scale-95"
                >
                  <Play size={18} fill="currentColor" /> Start 3D Race
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-[280px]">
        <button
          onPointerDown={(e) => { e.preventDefault(); shiftLane(-1); }}
          className="h-14 rounded-xl bg-slate-800 border border-cyan-500/30 flex items-center justify-center gap-2 text-cyan-400 font-bold active:bg-cyan-500 active:text-black touch-none select-none"
        >
          <ArrowLeft size={22} /> LEFT
        </button>
        <button
          onPointerDown={(e) => { e.preventDefault(); shiftLane(1); }}
          className="h-14 rounded-xl bg-slate-800 border border-cyan-500/30 flex items-center justify-center gap-2 text-cyan-400 font-bold active:bg-cyan-500 active:text-black touch-none select-none"
        >
          RIGHT <ArrowRight size={22} />
        </button>
      </div>
    </div>
  );
};
