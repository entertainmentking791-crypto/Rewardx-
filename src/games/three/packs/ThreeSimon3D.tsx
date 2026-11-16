import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../../services/audio';
import { createStudioContext } from '../threeUtils';
import { Play, RotateCcw } from 'lucide-react';

interface Props {
  onGameOver: (score: number, coinsEarned: number) => void;
}

const PADS = [
  { id: 0, label: 'CYAN', color: 0x06b6d4, pos: [-1.15, -1.15] as [number, number] },
  { id: 1, label: 'ROSE', color: 0xf43f5e, pos: [1.15, -1.15] as [number, number] },
  { id: 2, label: 'GOLD', color: 0xfacc15, pos: [-1.15, 1.15] as [number, number] },
  { id: 3, label: 'MINT', color: 0x10b981, pos: [1.15, 1.15] as [number, number] },
];

export const ThreeSimon3D: React.FC<Props> = ({ onGameOver }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState('Watch the 3D crystal pattern!');

  const padMeshesRef = useRef<THREE.Mesh[]>([]);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const stateRef = useRef({
    started: false,
    gameOver: false,
    playingSeq: false,
    seq: [] as number[],
    step: 0,
    score: 0,
    timers: [] as number[],
    litPad: -1,
  });
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const clearTimers = () => {
    stateRef.current.timers.forEach((t) => clearTimeout(t));
    stateRef.current.timers = [];
  };

  const flashPad = (padId: number, duration = 320) => {
    stateRef.current.litPad = padId;
    if (padId === 0) sound.playClick();
    else if (padId === 1) sound.playMove();
    else if (padId === 2) sound.playPaddle();
    else sound.playCoin();

    const t = window.setTimeout(() => {
      if (stateRef.current.litPad === padId) stateRef.current.litPad = -1;
    }, duration);
    stateRef.current.timers.push(t);
  };

  const playSequenceRef = useRef<(seq: number[]) => void>(() => {});
  playSequenceRef.current = (seq: number[]) => {
    const s = stateRef.current;
    s.playingSeq = true;
    s.step = 0;
    setStatus(`Watch Round ${seq.length} (${seq.length} notes)...`);
    seq.forEach((padId, idx) => {
      const t = window.setTimeout(() => {
        flashPad(padId, 340);
        if (idx === seq.length - 1) {
          const endT = window.setTimeout(() => {
            s.playingSeq = false;
            setStatus('Your turn! Repeat the glowing crystals.');
          }, 420);
          s.timers.push(endT);
        }
      }, 500 + idx * 540);
      s.timers.push(t);
    });
  };

  const handlePadInput = useCallback((padId: number) => {
    const s = stateRef.current;
    if (!s.started || s.gameOver || s.playingSeq) return;

    flashPad(padId, 240);
    if (s.seq[s.step] === padId) {
      s.step += 1;
      s.score += 15;
      setScore(s.score);
      if (s.step >= s.seq.length) {
        s.score += s.seq.length * 10;
        setScore(s.score);
        sound.playScore();
        const nextSeq = [...s.seq, Math.floor(Math.random() * 4)];
        s.seq = nextSeq;
        setLevel(nextSeq.length);
        s.playingSeq = true;
        setStatus('Nice! Next crystal added...');
        const t = window.setTimeout(() => playSequenceRef.current(nextSeq), 750);
        s.timers.push(t);
      }
    } else {
      s.gameOver = true;
      setGameOver(true);
      sound.playGameOver();
      onGameOverRef.current(s.score, Math.max(3, Math.floor(s.score / 25)));
    }
  }, []);

  const startGame = useCallback(() => {
    clearTimers();
    const s = stateRef.current;
    s.started = true;
    s.gameOver = false;
    s.seq = [Math.floor(Math.random() * 4)];
    s.step = 0;
    s.score = 0;
    setLevel(1);
    setScore(0);
    setGameOver(false);
    setStarted(true);
    playSequenceRef.current(s.seq);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, { fov: 45, bgColor: 0x070917, fogNear: 18, fogFar: 50 });
    const { scene, camera } = studio;
    camera.position.set(0, 6.2, 5.2);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const discBase = new THREE.Mesh(
      new THREE.CylinderGeometry(2.8, 3.0, 0.3, 32),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.55, roughness: 0.35 })
    );
    discBase.position.y = -0.15;
    scene.add(discBase);

    padMeshesRef.current = [];
    const padGeo = new THREE.BoxGeometry(1.8, 0.42, 1.8);
    PADS.forEach((p) => {
      const mat = new THREE.MeshPhysicalMaterial({
        color: p.color,
        emissive: p.color,
        emissiveIntensity: 0.18,
        roughness: 0.2,
        metalness: 0.3,
        clearcoat: 1,
      });
      const mesh = new THREE.Mesh(padGeo, mat);
      mesh.position.set(p.pos[0], 0.22, p.pos[1]);
      mesh.userData = { padId: p.id };
      mesh.castShadow = true;
      scene.add(mesh);
      padMeshesRef.current.push(mesh);
    });

    const stopLoop = studio.start((delta) => {
      const dt = Math.min(delta, 0.05);
      const lit = stateRef.current.litPad;
      padMeshesRef.current.forEach((m, idx) => {
        const isLit = lit === idx;
        const mat = m.material as THREE.MeshPhysicalMaterial;
        mat.emissiveIntensity = THREE.MathUtils.damp(mat.emissiveIntensity, isLit ? 1.8 : 0.16, 16, dt);
        m.position.y = THREE.MathUtils.damp(m.position.y, isLit ? 0.38 : 0.22, 16, dt);
      });
    });

    return () => {
      clearTimers();
      stopLoop();
      studio.cleanup();
    };
  }, []);

  const handleTap = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!cameraRef.current || !mountRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, cameraRef.current);
    const hits = raycaster.intersectObjects(padMeshesRef.current, false);
    if (hits.length > 0) {
      const id = hits[0].object.userData?.padId;
      if (typeof id === 'number') handlePadInput(id);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2.5 w-full max-w-md mx-auto">
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-purple-500/30 rounded-xl text-xs font-mono tabular-nums">
        <span className="text-purple-400 font-bold">Sequence: {level}</span>
        <span className="text-amber-400 font-bold">Score: {score}</span>
      </div>
      <div className="relative w-full h-[335px] rounded-2xl overflow-hidden border-2 border-purple-500/40 bg-[#070917] touch-none select-none" onPointerDown={handleTap}>
        <div ref={mountRef} className="w-full h-full touch-none" />
        {started && !gameOver && (
          <div className="absolute top-2 left-2 right-2 pointer-events-none">
            <span className="px-2.5 py-1 rounded-lg bg-black/75 border border-white/10 text-[11px] font-semibold text-slate-200">{status}</span>
          </div>
        )}
        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black text-purple-400 mb-1">SEQUENCE BROKEN!</h3>
                <p className="text-slate-300 text-sm mb-3">Reached Level {level} · +{Math.max(3, Math.floor(score / 25))} Coins</p>
                <button onClick={(e) => { e.stopPropagation(); startGame(); }} className="flex items-center gap-2 px-6 py-2.5 bg-purple-500 text-white font-extrabold rounded-xl active:scale-95">
                  <RotateCcw size={18} /> Try Again
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black text-purple-400 mb-1">3D Neon Simon</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[250px]">Watch the 4 glowing 3D crystal pads light up and repeat the growing memory sequence!</p>
                <button onClick={(e) => { e.stopPropagation(); startGame(); }} className="flex items-center gap-2 px-7 py-3 bg-purple-500 text-white font-extrabold rounded-xl shadow-lg active:scale-95">
                  <Play size={18} fill="currentColor" /> Start Memory
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2 w-full">
        {PADS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handlePadInput(p.id)}
            className="h-11 rounded-xl font-black text-[11px] text-black active:scale-95"
            style={{ backgroundColor: `#${p.color.toString(16).padStart(6, '0')}` }}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
};
