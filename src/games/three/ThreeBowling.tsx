import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../services/audio';
import { buildBowlingPin, createStudioContext, makeCanvasTexture } from './threeUtils';
import { ArrowLeft, ArrowRight, Play, RotateCcw } from 'lucide-react';

interface Props {
  onGameOver: (score: number, coinsEarned: number) => void;
}

export const ThreeBowling: React.FC<Props> = ({ onGameOver }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [frame, setFrame] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const aimXRef = useRef(0);
  const ballRollingRef = useRef(false);
  const rollTriggerRef = useRef(false);
  const runningRef = useRef(false);
  const scoreRef = useRef(0);
  const frameRef = useRef(1);
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;
  const resetPinsRef = useRef<() => void>(() => {});

  const nudgeAim = useCallback((dx: number) => {
    if (!runningRef.current || ballRollingRef.current) return;
    aimXRef.current = THREE.MathUtils.clamp(aimXRef.current + dx, -1.6, 1.6);
    sound.playMove();
  }, []);

  const bowl = useCallback(() => {
    if (!runningRef.current || ballRollingRef.current) return;
    rollTriggerRef.current = true;
  }, []);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    frameRef.current = 1;
    aimXRef.current = 0;
    ballRollingRef.current = false;
    rollTriggerRef.current = false;
    runningRef.current = true;
    resetPinsRef.current();
    setScore(0);
    setFrame(1);
    setGameOver(false);
    setStarted(true);
    sound.playClick();
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, {
      fov: 52,
      bgColor: 0x090b16,
      fogNear: 20,
      fogFar: 65,
    });
    const { scene, camera, renderer } = studio;
    camera.position.set(0, 3.6, 8.2);
    camera.lookAt(0, 0.7, -8);

    const laneTex = makeCanvasTexture(
      renderer,
      256,
      512,
      (ctx, w, h) => {
        ctx.fillStyle = '#92400e';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 8; i++) {
          ctx.fillStyle = i % 2 === 0 ? 'rgba(251, 191, 36, 0.14)' : 'rgba(120, 53, 15, 0.16)';
          ctx.fillRect((w / 8) * i, 0, w / 8, h);
        }
        ctx.fillStyle = '#22d3ee';
        ctx.fillRect(0, 0, 8, h);
        ctx.fillRect(w - 8, 0, 8, h);
      },
      1,
      2
    );

    const lane = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 0.25, 28),
      new THREE.MeshStandardMaterial({ map: laneTex, roughness: 0.25, metalness: 0.12 })
    );
    lane.position.set(0, -0.125, -6);
    lane.receiveShadow = true;
    scene.add(lane);

    // Gutters
    const gutterMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
    const gL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 28), gutterMat);
    gL.position.set(-2.45, -0.08, -6);
    const gR = gL.clone();
    gR.position.x = 2.45;
    scene.add(gL, gR);

    // Bowling ball (composite 3-part: sphere + finger holes)
    const ballGroup = new THREE.Group();
    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 24, 24),
      new THREE.MeshPhysicalMaterial({
        color: 0x0ea5e9,
        metalness: 0.35,
        roughness: 0.15,
        clearcoat: 1.0,
      })
    );
    ballMesh.castShadow = true;
    ballGroup.add(ballMesh);
    ballGroup.position.set(0, 0.45, 4.2);
    scene.add(ballGroup);

    interface PinState {
      group: THREE.Group;
      x: number;
      z: number;
      vx: number;
      vz: number;
      fallen: boolean;
      rotVelX: number;
      rotVelZ: number;
    }

    const pins: PinState[] = [];
    const pinPositions: [number, number][] = [];
    const rows = [0, 1, 2, 3];
    for (const r of rows) {
      for (let c = 0; c <= r; c++) {
        pinPositions.push([(c - r / 2) * 0.72, -13.5 - r * 0.65]);
      }
    }

    for (const [px, pz] of pinPositions) {
      const p = buildBowlingPin();
      p.position.set(px, 0, pz);
      scene.add(p);
      pins.push({ group: p, x: px, z: pz, vx: 0, vz: 0, fallen: false, rotVelX: 0, rotVelZ: 0 });
    }

    resetPinsRef.current = () => {
      pins.forEach((p, idx) => {
        const [px, pz] = pinPositions[idx];
        p.x = px;
        p.z = pz;
        p.vx = 0;
        p.vz = 0;
        p.fallen = false;
        p.rotVelX = 0;
        p.rotVelZ = 0;
        p.group.position.set(px, 0, pz);
        p.group.rotation.set(0, 0, 0);
      });
      ballGroup.position.set(aimXRef.current, 0.45, 4.2);
      ballGroup.rotation.set(0, 0, 0);
    };

    let ballVx = 0;
    let ballVz = 0;
    let settleTimer = 0;
    let settling = false;

    const stopLoop = studio.start((delta) => {
      const dt = Math.min(delta, 0.05);

      if (!ballRollingRef.current && !settling) {
        ballGroup.position.x = THREE.MathUtils.damp(ballGroup.position.x, aimXRef.current, 12, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, 8.2, 6, dt);
      }

      if (rollTriggerRef.current && !ballRollingRef.current) {
        rollTriggerRef.current = false;
        ballRollingRef.current = true;
        ballVx = 0;
        ballVz = -17.5;
        sound.playJump();
      }

      if (ballRollingRef.current) {
        ballGroup.position.x += ballVx * dt;
        ballGroup.position.z += ballVz * dt;
        ballMesh.rotation.x -= dt * 14;
        camera.position.z = THREE.MathUtils.damp(camera.position.z, Math.max(ballGroup.position.z + 6.5, -2.5), 5, dt);

        // Pin collision
        for (const p of pins) {
          if (!p.fallen) {
            const dx = p.x - ballGroup.position.x;
            const dz = p.z - ballGroup.position.z;
            if (dx * dx + dz * dz < 0.72 * 0.72) {
              p.fallen = true;
              p.vx = dx * 8 + (Math.random() - 0.5) * 3;
              p.vz = -10 - Math.random() * 4;
              p.rotVelX = -8 - Math.random() * 4;
              p.rotVelZ = (Math.random() - 0.5) * 10;
              sound.playPaddle();
            }
          }
        }

        if (ballGroup.position.z < -17.5) {
          ballRollingRef.current = false;
          settling = true;
          settleTimer = 1.0;
        }
      }

      // Pin-to-pin chain reaction + flying motion
      for (const p of pins) {
        if (p.fallen) {
          p.x += p.vx * dt;
          p.z += p.vz * dt;
          p.vx *= 0.96;
          p.vz *= 0.96;
          p.group.position.set(p.x, Math.min(0.4, p.group.position.y + dt * 0.5), p.z);
          p.group.rotation.x = THREE.MathUtils.clamp(p.group.rotation.x + p.rotVelX * dt, -1.5, 1.5);
          p.group.rotation.z = THREE.MathUtils.clamp(p.group.rotation.z + p.rotVelZ * dt, -1.5, 1.5);

          for (const other of pins) {
            if (!other.fallen) {
              const dx = other.x - p.x;
              const dz = other.z - p.z;
              if (dx * dx + dz * dz < 0.65 * 0.65) {
                other.fallen = true;
                other.vx = dx * 7;
                other.vz = -7;
                other.rotVelX = -7;
                other.rotVelZ = (Math.random() - 0.5) * 8;
              }
            }
          }
        }
      }

      if (settling) {
        settleTimer -= dt;
        if (settleTimer <= 0) {
          settling = false;
          const down = pins.filter((p) => p.fallen).length;
          const pts = down * 10 + (down === 10 ? 30 : 0);
          scoreRef.current += pts;
          setScore(scoreRef.current);
          if (down === 10) sound.playVictory();

          if (frameRef.current >= 5) {
            runningRef.current = false;
            setGameOver(true);
            onGameOverRef.current(scoreRef.current, Math.max(2, Math.floor(scoreRef.current / 25)));
          } else {
            frameRef.current += 1;
            setFrame(frameRef.current);
            resetPinsRef.current();
          }
        }
      }
    });

    return () => {
      stopLoop();
      laneTex.dispose();
      studio.cleanup();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'Space', 'KeyA', 'KeyD'].includes(e.code)) e.preventDefault();
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') nudgeAim(-0.35);
      if (e.code === 'ArrowRight' || e.code === 'KeyD') nudgeAim(0.35);
      if (e.code === 'Space') bowl();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nudgeAim, bowl]);

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-md mx-auto">
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-amber-500/30 rounded-xl text-sm font-mono tabular-nums">
        <span className="text-amber-400 font-bold">Frame {frame}/5</span>
        <span className="text-cyan-400 font-bold">Score: {score}</span>
      </div>

      <div className="relative w-full h-[360px] rounded-2xl overflow-hidden border-2 border-amber-500/40 bg-[#090b16] touch-none select-none">
        <div
          ref={mountRef}
          className="w-full h-full touch-none"
          onPointerMove={(e) => {
            if (!runningRef.current || ballRollingRef.current || e.buttons === 0) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const norm = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            aimXRef.current = THREE.MathUtils.clamp(norm * 1.6, -1.6, 1.6);
          }}
        />

        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black text-amber-400 mb-1">MATCH COMPLETE!</h3>
                <p className="text-slate-300 text-sm mb-3">
                  Total Score: <span className="text-white font-bold">{score}</span> · +{Math.max(2, Math.floor(score / 25))} Coins
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-black font-extrabold rounded-xl active:scale-95"
                >
                  <RotateCcw size={18} /> Bowl Again
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black text-amber-400 mb-1">3D Strike Bowling</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[240px]">
                  Line up your 3D bowling ball with Left/Right and tap BOWL to knock down all 10 pins!
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-7 py-3 bg-amber-500 text-black font-extrabold rounded-xl shadow-lg shadow-amber-500/30 active:scale-95"
                >
                  <Play size={18} fill="currentColor" /> Start 5 Frames
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5 w-full max-w-[300px]">
        <button
          onPointerDown={(e) => { e.preventDefault(); nudgeAim(-0.35); }}
          className="h-14 rounded-xl bg-slate-800 border border-amber-500/30 flex items-center justify-center text-amber-300 active:bg-amber-500 active:text-black touch-none select-none"
        >
          <ArrowLeft size={22} />
        </button>
        <button
          onPointerDown={(e) => { e.preventDefault(); bowl(); }}
          className="h-14 rounded-xl bg-amber-500 text-black font-extrabold text-sm active:scale-95 touch-none select-none shadow-lg shadow-amber-500/20"
        >
          BOWL!
        </button>
        <button
          onPointerDown={(e) => { e.preventDefault(); nudgeAim(0.35); }}
          className="h-14 rounded-xl bg-slate-800 border border-amber-500/30 flex items-center justify-center text-amber-300 active:bg-amber-500 active:text-black touch-none select-none"
        >
          <ArrowRight size={22} />
        </button>
      </div>
    </div>
  );
};
