import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../services/audio';
import { createStudioContext, makeCanvasTexture } from './threeUtils';
import { Play, RotateCcw } from 'lucide-react';

interface Props {
  onGameOver: (score: number, coinsEarned: number) => void;
}

const SYMBOLS = [
  { id: 0, color: 0x22d3ee, shape: 'torus' },
  { id: 1, color: 0xfacc15, shape: 'octa' },
  { id: 2, color: 0xf43f5e, shape: 'cone' },
  { id: 3, color: 0x10b981, shape: 'cube' },
  { id: 4, color: 0xa855f7, shape: 'dodeca' },
  { id: 5, color: 0xf97316, shape: 'sphere' },
  { id: 6, color: 0x3b82f6, shape: 'knot' },
  { id: 7, color: 0xec4899, shape: 'diamond' },
] as const;

function createSymbolMesh(shape: string, color: number): THREE.Mesh {
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.45,
    metalness: 0.35,
    roughness: 0.2,
    clearcoat: 1,
  });
  let geo: THREE.BufferGeometry;
  switch (shape) {
    case 'torus':
      geo = new THREE.TorusGeometry(0.24, 0.08, 12, 24);
      break;
    case 'octa':
      geo = new THREE.OctahedronGeometry(0.28);
      break;
    case 'cone':
      geo = new THREE.ConeGeometry(0.26, 0.45, 16);
      break;
    case 'cube':
      geo = new THREE.BoxGeometry(0.38, 0.38, 0.38);
      break;
    case 'dodeca':
      geo = new THREE.DodecahedronGeometry(0.26);
      break;
    case 'sphere':
      geo = new THREE.SphereGeometry(0.25, 18, 18);
      break;
    case 'knot':
      geo = new THREE.TorusKnotGeometry(0.18, 0.055, 36, 8);
      break;
    default:
      geo = new THREE.OctahedronGeometry(0.26, 0);
      geo.scale(1, 1.4, 0.7);
      break;
  }
  const m = new THREE.Mesh(geo, mat);
  m.position.y = -0.15;
  m.rotation.x = Math.PI / 2;
  return m;
}

interface CardSlot {
  group: THREE.Group;
  hitMesh: THREE.Mesh;
  symbolId: number;
  flipped: boolean;
  matched: boolean;
  targetRotZ: number;
}

export const ThreeMemoryCards: React.FC<Props> = ({ onGameOver }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [score, setScore] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(60);

  const cardsRef = useRef<CardSlot[]>([]);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const backTexRef = useRef<THREE.CanvasTexture | null>(null);
  const stateRef = useRef({
    started: false,
    gameOver: false,
    locked: false,
    firstIdx: null as number | null,
    moves: 0,
    matches: 0,
    streak: 0,
    score: 0,
    timeLeft: 60,
    flipTimer: null as number | null,
  });
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const endGame = useCallback((won: boolean) => {
    const s = stateRef.current;
    if (s.gameOver) return;
    s.gameOver = true;
    if (s.flipTimer) clearTimeout(s.flipTimer);
    const timeBonus = won ? Math.floor(s.timeLeft * 5) : 0;
    s.score += timeBonus;
    setScore(s.score);
    setGameOver(true);
    if (won) sound.playVictory();
    else sound.playGameOver();
    const coins = Math.max(3, Math.floor(s.score / 30));
    onGameOverRef.current(s.score, coins);
  }, []);

  const setupDeck = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    cardsRef.current.forEach((c) => scene.remove(c.group));
    cardsRef.current = [];

    const pairIds = [...Array(8).keys(), ...Array(8).keys()];
    for (let i = pairIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pairIds[i], pairIds[j]] = [pairIds[j], pairIds[i]];
    }

    const cardGeo = new THREE.BoxGeometry(1.15, 0.12, 1.35);
    const topMat = new THREE.MeshStandardMaterial({
      map: backTexRef.current || undefined,
      color: 0x0f172a,
      roughness: 0.35,
      metalness: 0.4,
    });
    const faceMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.25, metalness: 0.2 });

    pairIds.forEach((symId, idx) => {
      const row = Math.floor(idx / 4);
      const col = idx % 4;
      const x = (col - 1.5) * 1.38;
      const z = (row - 1.5) * 1.55;

      const group = new THREE.Group();
      group.position.set(x, 0.22, z);

      // Materials: 2 is +Y (card back visible face-down), 3 is -Y (front revealed when rotated 180° around Z)
      const mats = [topMat, topMat, topMat, faceMat, topMat, topMat];
      const slab = new THREE.Mesh(cardGeo, mats);
      slab.castShadow = true;
      slab.userData = { cardIdx: idx };

      const sym = SYMBOLS[symId];
      const symMesh = createSymbolMesh(sym.shape, sym.color);
      symMesh.userData = { cardIdx: idx };
      group.add(slab, symMesh);

      scene.add(group);
      cardsRef.current.push({
        group,
        hitMesh: slab,
        symbolId: symId,
        flipped: false,
        matched: false,
        targetRotZ: 0,
      });
    });
  }, []);

  const startGame = useCallback(() => {
    const s = stateRef.current;
    if (s.flipTimer) clearTimeout(s.flipTimer);
    s.started = true;
    s.gameOver = false;
    s.locked = false;
    s.firstIdx = null;
    s.moves = 0;
    s.matches = 0;
    s.streak = 0;
    s.score = 0;
    s.timeLeft = 60;

    setupDeck();
    setMoves(0);
    setMatches(0);
    setScore(0);
    setSecondsLeft(60);
    setGameOver(false);
    setStarted(true);
    sound.playClick();
  }, [setupDeck]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, {
      fov: 45,
      bgColor: 0x051414,
      fogNear: 20,
      fogFar: 55,
    });
    const { scene, camera, renderer } = studio;
    camera.position.set(0, 7.6, 5.2);
    camera.lookAt(0, 0, 0.2);
    sceneRef.current = scene;
    cameraRef.current = camera;

    const backTex = makeCanvasTexture(renderer, 128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#14b8a6';
      ctx.lineWidth = 8;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = '#2dd4bf';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('3D', w / 2, h / 2 + 2);
    });
    backTexRef.current = backTex;

    const table = new THREE.Mesh(
      new THREE.BoxGeometry(6.6, 0.25, 7.2),
      new THREE.MeshStandardMaterial({ color: 0x042f2e, roughness: 0.65, metalness: 0.15 })
    );
    table.position.y = -0.125;
    table.receiveShadow = true;
    scene.add(table);

    setupDeck();

    let secAccumulator = 0;
    const stopLoop = studio.start((delta, elapsed) => {
      const dt = Math.min(delta, 0.05);
      const s = stateRef.current;

      if (s.started && !s.gameOver) {
        secAccumulator += dt;
        if (secAccumulator >= 1) {
          secAccumulator -= 1;
          s.timeLeft = Math.max(0, s.timeLeft - 1);
          setSecondsLeft(s.timeLeft);
          if (s.timeLeft <= 0) {
            endGame(false);
          }
        }
      }

      for (let i = 0; i < cardsRef.current.length; i++) {
        const c = cardsRef.current[i];
        c.group.rotation.z = THREE.MathUtils.damp(c.group.rotation.z, c.targetRotZ, 12, dt);
        const targetY = c.matched ? 0.34 + Math.sin(elapsed * 3 + i) * 0.05 : c.flipped ? 0.36 : 0.2;
        c.group.position.y = THREE.MathUtils.damp(c.group.position.y, targetY, 12, dt);
      }
    });

    return () => {
      if (stateRef.current.flipTimer) clearTimeout(stateRef.current.flipTimer);
      stopLoop();
      backTex.dispose();
      studio.cleanup();
    };
  }, [endGame, setupDeck]);

  const handleCardTap = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stateRef.current;
    if (!s.started || s.gameOver || s.locked) return;
    if (!cameraRef.current || !mountRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, cameraRef.current);
    const targets = cardsRef.current.map((c) => c.group);
    const hits = raycaster.intersectObjects(targets, true);
    if (hits.length === 0) return;

    const idx = hits[0].object.userData?.cardIdx;
    if (typeof idx !== 'number') return;

    const card = cardsRef.current[idx];
    if (!card || card.flipped || card.matched) return;

    card.flipped = true;
    card.targetRotZ = Math.PI;
    sound.playMove();

    if (s.firstIdx === null) {
      s.firstIdx = idx;
      return;
    }

    const firstIdx = s.firstIdx;
    const firstCard = cardsRef.current[firstIdx];
    s.firstIdx = null;
    s.moves += 1;
    setMoves(s.moves);

    if (firstCard.symbolId === card.symbolId) {
      firstCard.matched = true;
      card.matched = true;
      s.matches += 1;
      s.streak += 1;
      s.score += 40 + s.streak * 15;
      setMatches(s.matches);
      setScore(s.score);
      sound.playCoin();

      if (s.matches >= 8) {
        s.flipTimer = window.setTimeout(() => endGame(true), 450);
      }
    } else {
      s.streak = 0;
      s.locked = true;
      s.flipTimer = window.setTimeout(() => {
        firstCard.flipped = false;
        firstCard.targetRotZ = 0;
        card.flipped = false;
        card.targetRotZ = 0;
        s.locked = false;
        sound.playPaddle();
      }, 650);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2.5 w-full max-w-md mx-auto">
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-teal-500/30 rounded-xl text-xs font-mono tabular-nums">
        <span className="text-teal-400 font-bold">Pairs: {matches}/8</span>
        <span className="text-slate-300">Moves: {moves}</span>
        <span className={secondsLeft <= 12 ? 'text-rose-400 font-bold' : 'text-amber-400 font-bold'}>
          {secondsLeft}s
        </span>
      </div>

      <div
        className="relative w-full h-[360px] rounded-2xl overflow-hidden border-2 border-teal-500/40 bg-[#051414] touch-none select-none"
        onPointerDown={handleCardTap}
      >
        <div ref={mountRef} className="w-full h-full touch-none" />

        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black text-teal-400 mb-1">
                  {matches >= 8 ? 'MEMORY MASTER!' : "TIME'S UP!"}
                </h3>
                <p className="text-slate-300 text-sm mb-3">
                  Score: <span className="text-white font-bold">{score}</span> · +{Math.max(3, Math.floor(score / 30))} Coins
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); startGame(); }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-teal-500 text-black font-extrabold rounded-xl active:scale-95"
                >
                  <RotateCcw size={18} /> Play Again
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black text-teal-400 mb-1">3D Memory Matrix</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[250px]">
                  Flip 3D cards to uncover matching sculpted shapes! Chain consecutive pairs before 60s expires.
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); startGame(); }}
                  className="flex items-center gap-2 px-7 py-3 bg-teal-500 text-black font-extrabold rounded-xl shadow-lg shadow-teal-500/30 active:scale-95"
                >
                  <Play size={18} fill="currentColor" /> Flip Cards
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400">Tap any 3D card to flip and match pairs</p>
    </div>
  );
};
