import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../../services/audio';
import { build3DCoin, createStudioContext, makeCanvasTexture } from '../threeUtils';
import { ArrowLeft, ArrowRight, ArrowUp, Play, RotateCcw } from 'lucide-react';

export type RacerVariant =
  | 'moto'
  | 'boat'
  | 'jet'
  | 'heli'
  | 'kart'
  | 'ski'
  | 'hover'
  | 'monster'
  | 'pod'
  | 'subway';

interface Props {
  variant: RacerVariant;
  onGameOver: (score: number, coinsEarned: number) => void;
}

const RACER_CFG: Record<
  RacerVariant,
  { title: string; subtitle: string; bg: number; track: string; laneLine: string; accent: number; css: string; hasJump?: boolean; crushCrates?: boolean }
> = {
  moto: { title: '3D Cyber Bike GP', subtitle: 'Lean-steer your superbike across 3 neon lanes dodging traffic cones & barriers!', bg: 0x070919, track: '#0f172a', laneLine: '#22d3ee', accent: 0x06b6d4, css: '#06b6d4' },
  boat: { title: '3D Speedboat Rush', subtitle: 'Plane a hydro-speedboat over glowing ocean lanes dodging floating naval mines!', bg: 0x04192b, track: '#0c4a6e', laneLine: '#7dd3fc', accent: 0x38bdf8, css: '#38bdf8' },
  jet: { title: '3D Jet Canyon', subtitle: 'Bank your supersonic delta jet through canyon pillars and leap low energy walls!', bg: 0x160a08, track: '#451a03', laneLine: '#f97316', accent: 0xf97316, css: '#f97316', hasJump: true },
  heli: { title: '3D Chopper Rescue', subtitle: 'Pilot a rescue helicopter between sky towers and climb above street blockades!', bg: 0x071512, track: '#064e3b', laneLine: '#34d399', accent: 0x10b981, css: '#10b981', hasJump: true },
  kart: { title: '3D Turbo Kart', subtitle: 'Drift a championship go-kart grabbing gold boosts and dodging track barriers!', bg: 0x14081e, track: '#1e1b4b', laneLine: '#facc15', accent: 0xfacc15, css: '#facc15' },
  ski: { title: '3D Alpine Slalom', subtitle: 'Carve down a frosty 3D mountain slope weaving around alpine pines & ice boulders!', bg: 0x0c1a2e, track: '#e2e8f0', laneLine: '#38bdf8', accent: 0x60a5fa, css: '#60a5fa' },
  hover: { title: '3D Hoverboard Rush', subtitle: 'Surf an antigravity neon hoverboard, jumping low laser bars and snagging orbs!', bg: 0x12061c, track: '#1e1b4b', laneLine: '#e879f9', accent: 0xe879f9, css: '#e879f9', hasJump: true },
  monster: { title: '3D Monster Crush', subtitle: 'Drive an oversized 3D monster truck smashing blue crates for +40 pts while avoiding red TNT!', bg: 0x180a08, track: '#292524', laneLine: '#fb923c', accent: 0xef4444, css: '#ef4444', crushCrates: true },
  pod: { title: '3D Twin-Pod Racer', subtitle: 'Pilot a high-speed desert canyon twin-pod through rock pillars at blistering speed!', bg: 0x1a0e05, track: '#78350f', laneLine: '#fde047', accent: 0xf59e0b, css: '#f59e0b' },
  subway: { title: '3D Metro Dash', subtitle: 'Sprint across 3 metro rails! Jump over yellow turnstiles and dodge incoming 3D trains!', bg: 0x090d18, track: '#1e293b', laneLine: '#f43f5e', accent: 0xf43f5e, css: '#f43f5e', hasJump: true },
};

function buildVehicle(variant: RacerVariant, accent: number): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: accent, metalness: 0.45, roughness: 0.2, clearcoat: 1 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.4 });
  const glowMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 1.4 });

  if (variant === 'moto') {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.45, 1.9), bodyMat);
    frame.position.y = 0.42;
    const wGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.16, 16);
    wGeo.rotateZ(Math.PI / 2);
    const fw = new THREE.Mesh(wGeo, darkMat);
    fw.position.set(0, 0.28, -0.7);
    const rw = new THREE.Mesh(wGeo, darkMat);
    rw.position.set(0, 0.28, 0.7);
    const rider = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), glowMat);
    rider.position.set(0, 0.85, 0.1);
    g.add(frame, fw, rw, rider);
  } else if (variant === 'boat') {
    const hull = new THREE.Mesh(new THREE.ConeGeometry(0.65, 2.4, 4), bodyMat);
    hull.rotation.x = -Math.PI / 2;
    hull.rotation.y = Math.PI / 4;
    hull.scale.set(1, 1, 0.55);
    hull.position.y = 0.3;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.9), darkMat);
    cabin.position.set(0, 0.55, 0.2);
    g.add(hull, cabin);
  } else if (variant === 'jet' || variant === 'pod') {
    const fuselage = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.2, 8), bodyMat);
    fuselage.rotation.x = -Math.PI / 2;
    fuselage.position.y = 0.45;
    const wings = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 0.75), darkMat);
    wings.position.set(0, 0.42, 0.35);
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.5, 10), glowMat);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(0, 0.42, 1.05);
    g.add(fuselage, wings, engine);
  } else if (variant === 'heli') {
    const pod = new THREE.Mesh(new THREE.SphereGeometry(0.52, 16, 16), bodyMat);
    pod.scale.set(0.9, 0.8, 1.35);
    pod.position.y = 0.55;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 1.2), darkMat);
    tail.position.set(0, 0.6, 0.9);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.14), glowMat);
    rotor.position.set(0, 1.05, 0);
    rotor.userData.isRotor = true;
    g.add(pod, tail, rotor);
  } else if (variant === 'monster') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.65, 2.0), bodyMat);
    cab.position.y = 0.78;
    const wGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.36, 16);
    wGeo.rotateZ(Math.PI / 2);
    for (const [wx, wz] of [[-0.68, -0.7], [0.68, -0.7], [-0.68, 0.7], [0.68, 0.7]]) {
      const w = new THREE.Mesh(wGeo, darkMat);
      w.position.set(wx, 0.42, wz);
      g.add(w);
    }
    g.add(cab);
  } else if (variant === 'ski' || variant === 'subway') {
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.75, 0.35), bodyMat);
    torso.position.y = 0.65;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), glowMat);
    head.position.y = 1.2;
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 1.5), darkMat);
    board.position.y = 0.1;
    g.add(torso, head, board);
  } else {
    // Kart / Hoverboard
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.28, 1.9), bodyMat);
    deck.position.y = 0.32;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.36, 0.75), darkMat);
    seat.position.set(0, 0.62, 0.15);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.1, 0.18), glowMat);
    bar.position.set(0, 0.38, 0.95);
    g.add(deck, seat, bar);
  }
  return g;
}

const LANES = [-2.5, 0, 2.5];

export const ThreeLaneRacerPack: React.FC<Props> = ({ variant, onGameOver }) => {
  const cfg = RACER_CFG[variant];
  const mountRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const laneRef = useRef(1);
  const jumpYRef = useRef(0);
  const jumpVyRef = useRef(0);
  const runningRef = useRef(false);
  const scoreRef = useRef(0);
  const resetWorldRef = useRef<() => void>(() => {});
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;
  const touchXRef = useRef<number | null>(null);
  const touchYRef = useRef<number | null>(null);

  const moveLane = useCallback((delta: number) => {
    if (!runningRef.current) return;
    laneRef.current = Math.max(0, Math.min(2, laneRef.current + delta));
    sound.playMove();
  }, []);

  const triggerJump = useCallback(() => {
    if (!runningRef.current || !cfg.hasJump) return;
    if (jumpYRef.current <= 0.05) {
      jumpVyRef.current = 12.2;
      sound.playJump();
    }
  }, [cfg.hasJump]);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    laneRef.current = 1;
    jumpYRef.current = 0;
    jumpVyRef.current = 0;
    runningRef.current = true;
    resetWorldRef.current();
    setScore(0);
    setGameOver(false);
    setStarted(true);
    sound.playClick();
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, { fov: 60, bgColor: cfg.bg, fogNear: 22, fogFar: 88 });
    const { scene, camera, renderer } = studio;
    camera.position.set(0, 4.2, 7.6);
    camera.lookAt(0, 0.9, -10);

    const roadTex = makeCanvasTexture(
      renderer,
      256,
      512,
      (ctx, w, h) => {
        ctx.fillStyle = cfg.track;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = cfg.laneLine;
        ctx.fillRect(0, 0, 10, h);
        ctx.fillRect(w - 10, 0, 10, h);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        for (let y = 0; y < h; y += 64) {
          ctx.fillRect(w / 3 - 4, y, 8, 34);
          ctx.fillRect((2 * w) / 3 - 4, y, 8, 34);
        }
      },
      1,
      8
    );

    const track = new THREE.Mesh(
      new THREE.PlaneGeometry(8.5, 160),
      new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.55 })
    );
    track.rotation.x = -Math.PI / 2;
    track.position.set(0, 0, -68);
    scene.add(track);

    const player = buildVehicle(variant, cfg.accent);
    player.position.set(0, 0, 1.5);
    scene.add(player);

    interface Obstacle {
      mesh: THREE.Mesh;
      lane: number;
      lowJumpable: boolean;
      crushable: boolean;
      active: boolean;
    }
    interface Coin {
      group: THREE.Group;
      lane: number;
      active: boolean;
    }

    const obsPool: Obstacle[] = [];
    const obsMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35, metalness: 0.3 });
    const lowMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0x9a3412, emissiveIntensity: 0.45 });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.35 });

    for (let i = 0; i < 10; i++) {
      const low = Boolean(cfg.hasJump) && i % 2 === 1;
      const crush = Boolean(cfg.crushCrates) && i % 2 === 1;
      const geo = low
        ? new THREE.BoxGeometry(2.0, 0.65, 0.7)
        : crush
        ? new THREE.BoxGeometry(1.2, 1.1, 1.2)
        : new THREE.BoxGeometry(1.45, 1.2, 2.2);
      const mesh = new THREE.Mesh(geo, crush ? crateMat : low ? lowMat : obsMat);
      mesh.visible = false;
      scene.add(mesh);
      obsPool.push({ mesh, lane: 1, lowJumpable: low, crushable: crush, active: false });
    }

    const coinPool: Coin[] = [];
    for (let i = 0; i < 8; i++) {
      const g = build3DCoin();
      g.visible = false;
      scene.add(g);
      coinPool.push({ group: g, lane: 1, active: false });
    }

    let spawnTimer = 0;
    let coinTimer = 0;
    let speed = 23;
    let dist = 0;

    resetWorldRef.current = () => {
      speed = 23;
      dist = 0;
      spawnTimer = 0.5;
      coinTimer = 0.3;
      player.position.set(0, 0, 1.5);
      obsPool.forEach((o) => { o.active = false; o.mesh.visible = false; });
      coinPool.forEach((c) => { c.active = false; c.group.visible = false; });
    };

    const stopLoop = studio.start((delta, elapsed) => {
      const dt = Math.min(delta, 0.05);
      roadTex.offset.y -= dt * (runningRef.current ? speed * 0.055 : 0.35);

      player.traverse((o) => {
        if (o.userData.isRotor) o.rotation.y += dt * 18;
      });

      if (!runningRef.current) {
        player.rotation.y = Math.sin(elapsed * 0.9) * 0.14;
        return;
      }

      speed = Math.min(46, speed + dt * 0.45);
      dist += speed * dt;

      const targetX = LANES[laneRef.current];
      const prevX = player.position.x;
      player.position.x = THREE.MathUtils.damp(prevX, targetX, 13, dt);
      player.rotation.z = THREE.MathUtils.clamp((prevX - player.position.x) * 0.35, -0.35, 0.35);
      player.rotation.y = 0;

      if (jumpYRef.current > 0 || jumpVyRef.current > 0) {
        jumpVyRef.current -= 30 * dt;
        jumpYRef.current = Math.max(0, jumpYRef.current + jumpVyRef.current * dt);
        if (jumpYRef.current <= 0) jumpVyRef.current = 0;
      }
      player.position.y = jumpYRef.current;

      const newScore = Math.floor(dist * 0.5);
      if (newScore > scoreRef.current) {
        scoreRef.current = newScore;
        setScore(newScore);
      }

      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnTimer = Math.max(0.45, 1.05 - (speed - 23) * 0.02);
        const slot = obsPool.find((o) => !o.active);
        if (slot) {
          slot.active = true;
          slot.lane = Math.floor(Math.random() * 3);
          slot.mesh.position.set(LANES[slot.lane], slot.lowJumpable ? 0.35 : 0.65, -80);
          slot.mesh.visible = true;
        }
      }

      coinTimer -= dt;
      if (coinTimer <= 0) {
        coinTimer = 0.72;
        const cSlot = coinPool.find((c) => !c.active);
        if (cSlot) {
          cSlot.active = true;
          cSlot.lane = Math.floor(Math.random() * 3);
          cSlot.group.position.set(LANES[cSlot.lane], 0.85, -80);
          cSlot.group.visible = true;
        }
      }

      for (const o of obsPool) {
        if (!o.active) continue;
        o.mesh.position.z += speed * dt;
        if (Math.abs(o.mesh.position.z - player.position.z) < 1.35 && Math.abs(o.mesh.position.x - player.position.x) < 1.05) {
          if (o.lowJumpable && jumpYRef.current > 0.72) continue;
          if (o.crushable) {
            o.active = false;
            o.mesh.visible = false;
            scoreRef.current += 40;
            setScore(scoreRef.current);
            sound.playPaddle();
            continue;
          }
          runningRef.current = false;
          setGameOver(true);
          sound.playHit();
          onGameOverRef.current(scoreRef.current, Math.max(2, Math.floor(scoreRef.current / 22)));
          return;
        }
        if (o.mesh.position.z > 10) {
          o.active = false;
          o.mesh.visible = false;
        }
      }

      for (const c of coinPool) {
        if (!c.active) continue;
        c.group.position.z += speed * dt;
        c.group.rotation.y += dt * 4;
        if (Math.abs(c.group.position.z - player.position.z) < 1.3 && Math.abs(c.group.position.x - player.position.x) < 1.05) {
          c.active = false;
          c.group.visible = false;
          scoreRef.current += 25;
          setScore(scoreRef.current);
          sound.playCoin();
        } else if (c.group.position.z > 10) {
          c.active = false;
          c.group.visible = false;
        }
      }
    });

    return () => {
      stopLoop();
      roadTex.dispose();
      studio.cleanup();
    };
  }, [cfg.accent, cfg.bg, cfg.crushCrates, cfg.hasJump, cfg.laneLine, cfg.track, variant]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyA', 'KeyD', 'KeyW'].includes(e.code)) e.preventDefault();
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') moveLane(-1);
      if (e.code === 'ArrowRight' || e.code === 'KeyD') moveLane(1);
      if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') triggerJump();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moveLane, triggerJump]);

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-md mx-auto">
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-white/15 rounded-xl text-sm font-mono tabular-nums">
        <span className="font-bold" style={{ color: cfg.css }}>{cfg.title}</span>
        <span className="text-amber-400 font-bold">Score: {score}</span>
      </div>

      <div
        className="relative w-full h-[360px] rounded-2xl overflow-hidden border-2 bg-[#050816] touch-none select-none"
        style={{ borderColor: `${cfg.css}66` }}
        onPointerDown={(e) => {
          touchXRef.current = e.clientX;
          touchYRef.current = e.clientY;
        }}
        onPointerUp={(e) => {
          if (touchXRef.current === null || touchYRef.current === null) return;
          const dx = e.clientX - touchXRef.current;
          const dy = e.clientY - touchYRef.current;
          touchXRef.current = null;
          touchYRef.current = null;
          if (cfg.hasJump && dy < -28) triggerJump();
          else if (Math.abs(dx) > 22) moveLane(dx > 0 ? 1 : -1);
          else {
            const rect = e.currentTarget.getBoundingClientRect();
            moveLane(e.clientX - rect.left < rect.width / 2 ? -1 : 1);
          }
        }}
      >
        <div ref={mountRef} className="w-full h-full touch-none" />
        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black text-rose-400 mb-1">WIPEOUT!</h3>
                <p className="text-slate-300 text-sm mb-3">
                  Score: <span className="text-white font-bold">{score}</span> · +{Math.max(2, Math.floor(score / 22))} Coins
                </p>
                <button onClick={startGame} className="flex items-center gap-2 px-6 py-2.5 text-black font-extrabold rounded-xl active:scale-95" style={{ backgroundColor: cfg.css }}>
                  <RotateCcw size={18} /> Race Again
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black mb-1" style={{ color: cfg.css }}>{cfg.title}</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[250px]">{cfg.subtitle}</p>
                <button onClick={startGame} className="flex items-center gap-2 px-7 py-3 text-black font-extrabold rounded-xl shadow-lg active:scale-95" style={{ backgroundColor: cfg.css }}>
                  <Play size={18} fill="currentColor" /> Start 3D Race
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className={`grid ${cfg.hasJump ? 'grid-cols-3' : 'grid-cols-2'} gap-3 w-full max-w-[280px]`}>
        <button onPointerDown={(e) => { e.preventDefault(); moveLane(-1); }} className="h-14 rounded-2xl bg-slate-800 border border-white/15 flex items-center justify-center text-white active:scale-95 touch-none select-none">
          <ArrowLeft size={24} />
        </button>
        {cfg.hasJump && (
          <button onPointerDown={(e) => { e.preventDefault(); triggerJump(); }} className="h-14 rounded-2xl text-black font-extrabold flex items-center justify-center active:scale-95 touch-none select-none" style={{ backgroundColor: cfg.css }}>
            <ArrowUp size={24} />
          </button>
        )}
        <button onPointerDown={(e) => { e.preventDefault(); moveLane(1); }} className="h-14 rounded-2xl bg-slate-800 border border-white/15 flex items-center justify-center text-white active:scale-95 touch-none select-none">
          <ArrowRight size={24} />
        </button>
      </div>
    </div>
  );
};
