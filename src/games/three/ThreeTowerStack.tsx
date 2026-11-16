import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../services/audio';
import { createStudioContext } from './threeUtils';
import { Layers, Play, RotateCcw } from 'lucide-react';

interface Props {
  onGameOver: (score: number, coinsEarned: number) => void;
}

const SLAB_H = 0.55;

export const ThreeTowerStack: React.FC<Props> = ({ onGameOver }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const dropQueuedRef = useRef(false);
  const runningRef = useRef(false);
  const scoreRef = useRef(0);
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;
  const resetTowerRef = useRef<() => void>(() => {});

  const dropSlab = useCallback(() => {
    if (!runningRef.current) return;
    dropQueuedRef.current = true;
  }, []);

  const startGame = useCallback(() => {
    resetTowerRef.current();
    scoreRef.current = 0;
    runningRef.current = true;
    dropQueuedRef.current = false;
    setScore(0);
    setGameOver(false);
    setStarted(true);
    sound.playClick();
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, {
      fov: 48,
      bgColor: 0x050e17,
      fogNear: 20,
      fogFar: 60,
    });
    const { scene, camera } = studio;

    interface StackLayer {
      mesh: THREE.Mesh;
      x: number;
      z: number;
      w: number;
      d: number;
    }
    interface Debris {
      mesh: THREE.Mesh;
      vy: number;
    }

    const layers: StackLayer[] = [];
    const debris: Debris[] = [];
    let movingMesh: THREE.Mesh | null = null;
    let axis: 'x' | 'z' = 'x';
    let dir = 1;
    let curW = 3.2;
    let curD = 3.2;
    let curX = 0;
    let curZ = 0;
    let targetCamY = 4.5;

    const spawnColor = (idx: number) => {
      const hue = (150 + idx * 14) % 360;
      return new THREE.Color(`hsl(${hue}, 82%, 56%)`);
    };

    const spawnMovingLayer = (level: number) => {
      axis = level % 2 === 0 ? 'x' : 'z';
      dir = 1;
      const mat = new THREE.MeshStandardMaterial({
        color: spawnColor(level),
        roughness: 0.28,
        metalness: 0.25,
      });
      movingMesh = new THREE.Mesh(new THREE.BoxGeometry(curW, SLAB_H, curD), mat);
      movingMesh.castShadow = true;
      movingMesh.receiveShadow = true;
      const startPos = -4.2;
      movingMesh.position.set(
        axis === 'x' ? startPos : curX,
        level * SLAB_H + SLAB_H / 2,
        axis === 'z' ? startPos : curZ
      );
      scene.add(movingMesh);
    };

    const initTower = () => {
      layers.forEach((l) => scene.remove(l.mesh));
      debris.forEach((d) => scene.remove(d.mesh));
      if (movingMesh) scene.remove(movingMesh);
      layers.length = 0;
      debris.length = 0;
      movingMesh = null;

      curW = 3.2;
      curD = 3.2;
      curX = 0;
      curZ = 0;

      const base = new THREE.Mesh(
        new THREE.BoxGeometry(curW, SLAB_H * 4, curD),
        new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.35, metalness: 0.2 })
      );
      base.position.set(0, -SLAB_H * 1.5, 0);
      base.receiveShadow = true;
      scene.add(base);
      layers.push({ mesh: base, x: 0, z: 0, w: curW, d: curD });

      targetCamY = 4.6;
      camera.position.set(6.2, 4.6, 6.2);
      camera.lookAt(0, 0.8, 0);
      spawnMovingLayer(1);
    };

    initTower();
    resetTowerRef.current = initTower;

    const stopLoop = studio.start((delta) => {
      const dt = Math.min(delta, 0.05);

      camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamY, 6, dt);
      camera.lookAt(0, targetCamY - 3.6, 0);

      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i];
        d.vy -= 22 * dt;
        d.mesh.position.y += d.vy * dt;
        d.mesh.rotation.x += dt * 3;
        d.mesh.rotation.z += dt * 2;
        if (d.mesh.position.y < targetCamY - 14) {
          scene.remove(d.mesh);
          debris.splice(i, 1);
        }
      }

      if (!runningRef.current || !movingMesh) return;

      const speed = Math.min(8.5, 3.8 + scoreRef.current * 0.14);
      movingMesh.position[axis] += dir * speed * dt;
      if (movingMesh.position[axis] > 4.2) dir = -1;
      if (movingMesh.position[axis] < -4.2) dir = 1;

      if (dropQueuedRef.current) {
        dropQueuedRef.current = false;
        const prev = layers[layers.length - 1];
        const pos = movingMesh.position[axis];
        const prevPos = axis === 'x' ? prev.x : prev.z;
        const size = axis === 'x' ? curW : curD;
        const diff = pos - prevPos;
        const overlap = size - Math.abs(diff);

        if (overlap <= 0.08) {
          debris.push({ mesh: movingMesh, vy: -2 });
          movingMesh = null;
          runningRef.current = false;
          setGameOver(true);
          sound.playHit();
          onGameOverRef.current(scoreRef.current, Math.max(1, Math.floor(scoreRef.current / 2)));
          return;
        }

        const isPerfect = Math.abs(diff) < 0.16;
        const finalSize = isPerfect ? size : overlap;
        const finalCenter = isPerfect ? prevPos : prevPos + diff / 2;

        const mat = movingMesh.material as THREE.MeshStandardMaterial;
        const placed = new THREE.Mesh(
          new THREE.BoxGeometry(axis === 'x' ? finalSize : curW, SLAB_H, axis === 'z' ? finalSize : curD),
          mat.clone()
        );
        placed.castShadow = true;
        placed.receiveShadow = true;
        const y = movingMesh.position.y;
        placed.position.set(axis === 'x' ? finalCenter : curX, y, axis === 'z' ? finalCenter : curZ);
        scene.add(placed);

        if (!isPerfect) {
          const cutSize = size - overlap;
          const cutCenter = finalCenter + (diff > 0 ? 1 : -1) * (overlap / 2 + cutSize / 2);
          const cutMesh = new THREE.Mesh(
            new THREE.BoxGeometry(axis === 'x' ? cutSize : curW, SLAB_H, axis === 'z' ? cutSize : curD),
            mat.clone()
          );
          cutMesh.position.set(axis === 'x' ? cutCenter : curX, y, axis === 'z' ? cutCenter : curZ);
          scene.add(cutMesh);
          debris.push({ mesh: cutMesh, vy: 0 });
        }

        scene.remove(movingMesh);
        movingMesh = null;

        if (axis === 'x') {
          curW = finalSize;
          curX = finalCenter;
        } else {
          curD = finalSize;
          curZ = finalCenter;
        }

        layers.push({ mesh: placed, x: curX, z: curZ, w: curW, d: curD });
        scoreRef.current += 1;
        setScore(scoreRef.current);
        targetCamY = 4.6 + scoreRef.current * SLAB_H;
        if (isPerfect) sound.playCoin();
        else sound.playPaddle();

        spawnMovingLayer(layers.length);
      }
    });

    return () => {
      stopLoop();
      studio.cleanup();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowDown') {
        e.preventDefault();
        dropSlab();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dropSlab]);

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-md mx-auto">
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-emerald-500/30 rounded-xl text-sm font-mono tabular-nums">
        <span className="text-emerald-400 font-bold">3D Stack · Floor {score}</span>
        <span className="text-amber-400">+{Math.floor(score / 2)} Coins</span>
      </div>

      <div className="relative w-full h-[360px] rounded-2xl overflow-hidden border-2 border-emerald-500/40 bg-[#050e17] touch-none select-none">
        <div
          ref={mountRef}
          className="w-full h-full touch-none"
          onPointerDown={(e) => {
            e.preventDefault();
            dropSlab();
          }}
        />

        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black text-rose-500 mb-1">TOWER COLLAPSED!</h3>
                <p className="text-slate-300 text-sm mb-3">
                  Floors Stacked: <span className="text-emerald-400 font-bold">{score}</span> · +{Math.max(1, Math.floor(score / 2))} Coins
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 text-black font-extrabold rounded-xl active:scale-95"
                >
                  <RotateCcw size={18} /> Stack Again
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black text-emerald-400 mb-1">3D Skyline Stack</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[240px]">
                  Tap the screen right when the sliding 3D slab lines up with the tower below!
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-7 py-3 bg-emerald-500 text-black font-extrabold rounded-xl shadow-lg shadow-emerald-500/30 active:scale-95"
                >
                  <Play size={18} fill="currentColor" /> Start Stacking
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <button
        onPointerDown={(e) => { e.preventDefault(); dropSlab(); }}
        className="w-full max-w-[260px] h-14 rounded-xl bg-emerald-500 text-black font-extrabold text-sm flex items-center justify-center gap-2 active:scale-95 touch-none select-none shadow-lg shadow-emerald-500/20"
      >
        <Layers size={18} /> DROP SLAB
      </button>
    </div>
  );
};
