import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../services/audio';
import { buildStarfighter, createStudioContext } from './threeUtils';
import { ArrowLeft, ArrowRight, Crosshair, Play, RotateCcw } from 'lucide-react';

interface Props {
  onGameOver: (score: number, coinsEarned: number) => void;
}

export const ThreeSpaceDogfight: React.FC<Props> = ({ onGameOver }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [hp, setHp] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const targetXRef = useRef(0);
  const steerRef = useRef(0);
  const firingRef = useRef(false);
  const runningRef = useRef(false);
  const scoreRef = useRef(0);
  const hpRef = useRef(3);
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;
  const resetRef = useRef<() => void>(() => {});

  const startGame = useCallback(() => {
    resetRef.current();
    scoreRef.current = 0;
    hpRef.current = 3;
    targetXRef.current = 0;
    runningRef.current = true;
    setScore(0);
    setHp(3);
    setGameOver(false);
    setStarted(true);
    sound.playClick();
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, {
      fov: 62,
      bgColor: 0x030512,
      fogNear: 25,
      fogFar: 95,
    });
    const { scene, camera } = studio;
    camera.position.set(0, 4.2, 6.8);
    camera.lookAt(0, 0.5, -14);

    // 3D Starfield using Points
    const starCount = 300;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 44;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 26 + 4;
      starPos[i * 3 + 2] = -Math.random() * 85;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xe0f2fe, size: 0.22 })
    );
    scene.add(stars);

    const playerShip = buildStarfighter(0x6366f1, 0x22d3ee);
    playerShip.position.set(0, 0.4, 1.4);
    scene.add(playerShip);

    interface Laser {
      mesh: THREE.Mesh;
      z: number;
      x: number;
    }
    interface Enemy {
      mesh: THREE.Group;
      x: number;
      z: number;
      hp: number;
    }

    const lasers: Laser[] = [];
    const enemies: Enemy[] = [];
    let fireCooldown = 0;
    let spawnTimer = 0.6;

    const laserGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8);
    laserGeo.rotateX(Math.PI / 2);
    const laserMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x22d3ee,
      emissiveIntensity: 2,
    });

    resetRef.current = () => {
      lasers.forEach((l) => scene.remove(l.mesh));
      enemies.forEach((e) => scene.remove(e.mesh));
      lasers.length = 0;
      enemies.length = 0;
      playerShip.position.set(0, 0.4, 1.4);
      fireCooldown = 0;
      spawnTimer = 0.6;
    };

    const stopLoop = studio.start((delta) => {
      const dt = Math.min(delta, 0.05);

      const posAttr = starGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < starCount; i++) {
        let z = posAttr.getZ(i) + (runningRef.current ? 24 : 8) * dt;
        if (z > 8) z = -82;
        posAttr.setZ(i, z);
      }
      posAttr.needsUpdate = true;

      if (!runningRef.current) return;

      if (steerRef.current !== 0) {
        targetXRef.current = THREE.MathUtils.clamp(targetXRef.current + steerRef.current * dt * 8.5, -4.4, 4.4);
      }
      const prevX = playerShip.position.x;
      playerShip.position.x = THREE.MathUtils.damp(playerShip.position.x, targetXRef.current, 14, dt);
      playerShip.rotation.z = THREE.MathUtils.clamp((prevX - playerShip.position.x) * 2.2, -0.45, 0.45);

      fireCooldown -= dt;
      if ((firingRef.current || fireCooldown <= -0.15) && fireCooldown <= 0) {
        const l1 = new THREE.Mesh(laserGeo, laserMat);
        l1.position.set(playerShip.position.x - 0.9, 0.6, 0.2);
        const l2 = new THREE.Mesh(laserGeo, laserMat);
        l2.position.set(playerShip.position.x + 0.9, 0.6, 0.2);
        scene.add(l1, l2);
        lasers.push({ mesh: l1, x: l1.position.x, z: l1.position.z });
        lasers.push({ mesh: l2, x: l2.position.x, z: l2.position.z });
        fireCooldown = firingRef.current ? 0.16 : 0.28;
        sound.playLaser();
      }

      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        const ex = (Math.random() - 0.5) * 8.2;
        const enemyShip = buildStarfighter(0xf43f5e, 0xfacc15);
        enemyShip.rotation.y = Math.PI;
        enemyShip.position.set(ex, 0.4, -70);
        scene.add(enemyShip);
        enemies.push({ mesh: enemyShip, x: ex, z: -70, hp: 2 });
        spawnTimer = Math.max(0.42, 1.05 - scoreRef.current * 0.002);
      }

      for (let i = lasers.length - 1; i >= 0; i--) {
        const l = lasers[i];
        l.z -= 52 * dt;
        l.mesh.position.z = l.z;
        if (l.z < -76) {
          scene.remove(l.mesh);
          lasers.splice(i, 1);
        }
      }

      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.z += (17 + Math.min(14, scoreRef.current * 0.04)) * dt;
        e.mesh.position.z = e.z;

        let destroyed = false;
        for (let j = lasers.length - 1; j >= 0; j--) {
          const l = lasers[j];
          if (Math.abs(l.z - e.z) < 1.6 && Math.abs(l.x - e.x) < 1.25) {
            scene.remove(l.mesh);
            lasers.splice(j, 1);
            e.hp -= 1;
            if (e.hp <= 0) {
              scene.remove(e.mesh);
              enemies.splice(i, 1);
              scoreRef.current += 20;
              setScore(scoreRef.current);
              sound.playExplosion();
              destroyed = true;
              break;
            }
          }
        }
        if (destroyed) continue;

        if (e.z > 0.2 && Math.abs(e.x - playerShip.position.x) < 1.35) {
          scene.remove(e.mesh);
          enemies.splice(i, 1);
          hpRef.current -= 1;
          setHp(hpRef.current);
          sound.playHit();
          if (hpRef.current <= 0) {
            runningRef.current = false;
            setGameOver(true);
            onGameOverRef.current(scoreRef.current, Math.max(1, Math.floor(scoreRef.current / 25)));
            break;
          }
        } else if (e.z > 6) {
          scene.remove(e.mesh);
          enemies.splice(i, 1);
        }
      }
    });

    return () => {
      stopLoop();
      laserGeo.dispose();
      laserMat.dispose();
      starGeo.dispose();
      studio.cleanup();
    };
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'Space', 'KeyA', 'KeyD'].includes(e.code)) e.preventDefault();
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') steerRef.current = -1;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') steerRef.current = 1;
      if (e.code === 'Space') firingRef.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(e.code)) steerRef.current = 0;
      if (e.code === 'Space') firingRef.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const handleTouchSteer = (clientX: number, rect: DOMRect) => {
    const norm = ((clientX - rect.left) / rect.width) * 2 - 1;
    targetXRef.current = THREE.MathUtils.clamp(norm * 4.4, -4.4, 4.4);
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-md mx-auto">
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-indigo-500/30 rounded-xl text-sm font-mono tabular-nums">
        <span className="text-indigo-400 font-bold">3D Starfighter · {score}</span>
        <span className="text-rose-400">{'♥'.repeat(Math.max(0, hp))}</span>
      </div>

      <div className="relative w-full h-[360px] rounded-2xl overflow-hidden border-2 border-indigo-500/40 bg-[#030512] touch-none select-none">
        <div
          ref={mountRef}
          className="w-full h-full touch-none"
          onPointerDown={(e) => {
            if (!runningRef.current) return;
            firingRef.current = true;
            handleTouchSteer(e.clientX, e.currentTarget.getBoundingClientRect());
          }}
          onPointerMove={(e) => {
            if (!runningRef.current || e.buttons === 0) return;
            handleTouchSteer(e.clientX, e.currentTarget.getBoundingClientRect());
          }}
          onPointerUp={() => { firingRef.current = false; }}
          onPointerCancel={() => { firingRef.current = false; }}
        />

        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black text-rose-500 mb-1">HULL DESTROYED!</h3>
                <p className="text-slate-300 text-sm mb-3">
                  Score: <span className="text-indigo-400 font-bold">{score}</span> · +{Math.max(1, Math.floor(score / 25))} Coins
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-500 text-white font-extrabold rounded-xl active:scale-95"
                >
                  <RotateCcw size={18} /> Launch Again
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black text-indigo-400 mb-1">3D Starfighter</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[240px]">
                  Drag across the cockpit to steer and unleash twin 3D plasma cannons at enemy raiders!
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-7 py-3 bg-indigo-500 text-white font-extrabold rounded-xl shadow-lg shadow-indigo-500/30 active:scale-95"
                >
                  <Play size={18} fill="currentColor" /> Launch Mission
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5 w-full max-w-[300px]">
        <button
          onPointerDown={(e) => { e.preventDefault(); steerRef.current = -1; }}
          onPointerUp={() => { steerRef.current = 0; }}
          onPointerLeave={() => { steerRef.current = 0; }}
          className="h-14 rounded-xl bg-slate-800 border border-indigo-500/30 flex items-center justify-center text-indigo-300 active:bg-indigo-500 active:text-white touch-none select-none"
        >
          <ArrowLeft size={22} />
        </button>
        <button
          onPointerDown={(e) => { e.preventDefault(); firingRef.current = true; }}
          onPointerUp={() => { firingRef.current = false; }}
          onPointerLeave={() => { firingRef.current = false; }}
          className="h-14 rounded-xl bg-indigo-500/20 border border-indigo-400/50 flex items-center justify-center gap-1 text-indigo-300 font-bold text-xs active:bg-indigo-500 active:text-white touch-none select-none"
        >
          <Crosshair size={18} /> FIRE
        </button>
        <button
          onPointerDown={(e) => { e.preventDefault(); steerRef.current = 1; }}
          onPointerUp={() => { steerRef.current = 0; }}
          onPointerLeave={() => { steerRef.current = 0; }}
          className="h-14 rounded-xl bg-slate-800 border border-indigo-500/30 flex items-center justify-center text-indigo-300 active:bg-indigo-500 active:text-white touch-none select-none"
        >
          <ArrowRight size={22} />
        </button>
      </div>
    </div>
  );
};
