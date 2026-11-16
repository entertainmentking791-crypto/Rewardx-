import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../services/audio';
import { createStudioContext } from './threeUtils';
import { Play, RotateCcw } from 'lucide-react';

interface Props {
  onGameOver: (score: number, coinsEarned: number) => void;
}

const SIZE = 6;
const CELL = 0.96;

interface PieceData {
  owner: 1 | 2; // 1 Cyan (Human moving UP r-1), 2 Crimson (Bot moving DOWN r+1)
  king: boolean;
  r: number;
  c: number;
  group: THREE.Group;
  crown: THREE.Mesh;
}

interface MoveOption {
  piece: PieceData;
  toR: number;
  toC: number;
  captured?: PieceData;
}

function rcToWorld(r: number, c: number): [number, number] {
  return [(c - (SIZE - 1) / 2) * CELL, (r - (SIZE - 1) / 2) * CELL];
}

function buildCheckerPiece(owner: 1 | 2): { group: THREE.Group; crown: THREE.Mesh } {
  const group = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: owner === 1 ? 0x06b6d4 : 0xf43f5e,
    metalness: 0.35,
    roughness: 0.2,
    clearcoat: 1,
  });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.16, 22), mat);
  base.position.y = 0.08;
  base.castShadow = true;

  const ridge = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.03, 8, 20),
    new THREE.MeshStandardMaterial({ color: owner === 1 ? 0xa5f3fc : 0xfecdd3, metalness: 0.5, roughness: 0.3 })
  );
  ridge.rotation.x = Math.PI / 2;
  ridge.position.y = 0.165;

  const crown = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.045, 8, 18),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xca8a04, emissiveIntensity: 0.6, metalness: 0.85, roughness: 0.2 })
  );
  crown.rotation.x = Math.PI / 2;
  crown.position.y = 0.21;
  crown.visible = false;

  group.add(base, ridge, crown);
  return { group, crown };
}

export const ThreeCheckers: React.FC<Props> = ({ onGameOver }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winnerText, setWinnerText] = useState('');
  const [playerCount, setPlayerCount] = useState(6);
  const [botCount, setBotCount] = useState(6);
  const [score, setScore] = useState(0);
  const [turn, setTurn] = useState<1 | 2>(1);
  const [status, setStatus] = useState('Tap one of your Cyan discs to move');

  const piecesRef = useRef<PieceData[]>([]);
  const tileMeshesRef = useRef<THREE.Mesh[]>([]);
  const markerMeshesRef = useRef<THREE.Mesh[]>([]);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const stateRef = useRef({
    started: false,
    gameOver: false,
    turn: 1 as 1 | 2,
    selectedPiece: null as PieceData | null,
    validMoves: [] as MoveOption[],
    score: 0,
    aiTimer: null as number | null,
  });
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const getPieceAt = (r: number, c: number): PieceData | undefined =>
    piecesRef.current.find((p) => p.r === r && p.c === c);

  const getMovesForOwner = useCallback((owner: 1 | 2): MoveOption[] => {
    const mine = piecesRef.current.filter((p) => p.owner === owner);
    const jumps: MoveOption[] = [];
    const normals: MoveOption[] = [];

    for (const p of mine) {
      const drs = p.king ? [-1, 1] : owner === 1 ? [-1] : [1];
      for (const dr of drs) {
        for (const dc of [-1, 1]) {
          const nr = p.r + dr;
          const nc = p.c + dc;
          if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
          const mid = getPieceAt(nr, nc);
          if (!mid) {
            normals.push({ piece: p, toR: nr, toC: nc });
          } else if (mid.owner !== owner) {
            const jr = nr + dr;
            const jc = nc + dc;
            if (jr >= 0 && jr < SIZE && jc >= 0 && jc < SIZE && !getPieceAt(jr, jc)) {
              jumps.push({ piece: p, toR: jr, toC: jc, captured: mid });
            }
          }
        }
      }
    }
    return jumps.length > 0 ? jumps : normals;
  }, []);

  const hideMarkers = useCallback(() => {
    markerMeshesRef.current.forEach((m) => (m.visible = false));
  }, []);

  const showMovesForPiece = useCallback((piece: PieceData) => {
    const all = getMovesForOwner(1);
    const forPiece = all.filter((m) => m.piece === piece);
    stateRef.current.selectedPiece = piece;
    stateRef.current.validMoves = forPiece;

    hideMarkers();
    forPiece.forEach((m, idx) => {
      const marker = markerMeshesRef.current[idx];
      if (marker) {
        const [wx, wz] = rcToWorld(m.toR, m.toC);
        marker.position.set(wx, 0.07, wz);
        marker.visible = true;
      }
    });
  }, [getMovesForOwner, hideMarkers]);

  const finishGame = useCallback((playerWon: boolean) => {
    const s = stateRef.current;
    if (s.gameOver) return;
    s.gameOver = true;
    hideMarkers();
    if (playerWon) {
      s.score += 250;
      setScore(s.score);
      sound.playVictory();
      setWinnerText('CHECKERS CHAMPION!');
    } else {
      sound.playGameOver();
      setWinnerText('BOT TOOK THE BOARD!');
    }
    setGameOver(true);
    const coins = Math.max(3, Math.floor(s.score / 28));
    onGameOverRef.current(s.score, coins);
  }, [hideMarkers]);

  const executeMoveRef = useRef<(move: MoveOption) => void>(() => {});

  executeMoveRef.current = (move: MoveOption) => {
    const s = stateRef.current;
    const scene = sceneRef.current;
    if (!scene || s.gameOver) return;

    hideMarkers();
    s.selectedPiece = null;
    s.validMoves = [];

    move.piece.r = move.toR;
    move.piece.c = move.toC;
    sound.playMove();

    if (move.captured) {
      scene.remove(move.captured.group);
      piecesRef.current = piecesRef.current.filter((p) => p !== move.captured);
      sound.playExplosion();
      if (move.piece.owner === 1) {
        s.score += 65;
        setScore(s.score);
      }
    } else if (move.piece.owner === 1) {
      s.score += 10;
      setScore(s.score);
    }

    // King promotion
    if (!move.piece.king && ((move.piece.owner === 1 && move.toR === 0) || (move.piece.owner === 2 && move.toR === SIZE - 1))) {
      move.piece.king = true;
      move.piece.crown.visible = true;
      sound.playCoin();
      if (move.piece.owner === 1) {
        s.score += 80;
        setScore(s.score);
      }
    }

    const pLeft = piecesRef.current.filter((p) => p.owner === 1).length;
    const bLeft = piecesRef.current.filter((p) => p.owner === 2).length;
    setPlayerCount(pLeft);
    setBotCount(bLeft);

    if (bLeft === 0) {
      finishGame(true);
      return;
    }
    if (pLeft === 0) {
      finishGame(false);
      return;
    }

    const nextTurn: 1 | 2 = move.piece.owner === 1 ? 2 : 1;
    const nextMoves = getMovesForOwner(nextTurn);
    if (nextMoves.length === 0) {
      finishGame(nextTurn === 2);
      return;
    }

    s.turn = nextTurn;
    setTurn(nextTurn);

    if (nextTurn === 2) {
      setStatus('Bot is thinking...');
      s.aiTimer = window.setTimeout(() => {
        const aiOptions = getMovesForOwner(2);
        if (aiOptions.length === 0) {
          finishGame(true);
          return;
        }
        aiOptions.sort((a, b) => (b.captured ? 10 : 0) + b.toR - ((a.captured ? 10 : 0) + a.toR));
        const pick = aiOptions[0];
        executeMoveRef.current(pick);
      }, 450);
    } else {
      setStatus(nextMoves[0].captured ? 'Capture available! Tap highlighted Cyan disc.' : 'Your turn! Tap a Cyan disc.');
    }
  };

  const resetPieces = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    piecesRef.current.forEach((p) => scene.remove(p.group));
    piecesRef.current = [];
    hideMarkers();

    const spawn = (owner: 1 | 2, r: number, c: number) => {
      const { group, crown } = buildCheckerPiece(owner);
      const [wx, wz] = rcToWorld(r, c);
      group.position.set(wx, 0.05, wz);
      group.traverse((obj) => {
        obj.userData = { pieceOwner: owner };
      });
      scene.add(group);
      piecesRef.current.push({ owner, king: false, r, c, group, crown });
    };

    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < SIZE; c++) {
        if ((r + c) % 2 === 1) spawn(2, r, c);
      }
    }
    for (let r = SIZE - 2; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if ((r + c) % 2 === 1) spawn(1, r, c);
      }
    }
  }, [hideMarkers]);

  const startGame = useCallback(() => {
    const s = stateRef.current;
    if (s.aiTimer) clearTimeout(s.aiTimer);
    resetPieces();
    s.started = true;
    s.gameOver = false;
    s.turn = 1;
    s.selectedPiece = null;
    s.validMoves = [];
    s.score = 0;

    setPlayerCount(6);
    setBotCount(6);
    setScore(0);
    setTurn(1);
    setGameOver(false);
    setStarted(true);
    setStatus('Your turn! Tap a Cyan disc.');
    sound.playClick();
  }, [resetPieces]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, {
      fov: 45,
      bgColor: 0x0b0714,
      fogNear: 20,
      fogFar: 55,
    });
    const { scene, camera } = studio;
    camera.position.set(0, 6.8, 5.4);
    camera.lookAt(0, 0, 0.15);
    sceneRef.current = scene;
    cameraRef.current = camera;

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(SIZE * CELL + 0.5, 0.28, SIZE * CELL + 0.5),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.45, roughness: 0.4 })
    );
    frame.position.y = -0.14;
    scene.add(frame);

    tileMeshesRef.current = [];
    const tileGeo = new THREE.BoxGeometry(CELL * 0.98, 0.08, CELL * 0.98);
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.45 });

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const [wx, wz] = rcToWorld(r, c);
        const tile = new THREE.Mesh(tileGeo, (r + c) % 2 === 1 ? darkMat : lightMat);
        tile.position.set(wx, 0.01, wz);
        tile.receiveShadow = true;
        tile.userData = { r, c };
        scene.add(tile);
        tileMeshesRef.current.push(tile);
      }
    }

    // Valid move destination glow rings
    markerMeshesRef.current = [];
    const ringGeo = new THREE.RingGeometry(0.24, 0.36, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.visible = false;
      scene.add(ring);
      markerMeshesRef.current.push(ring);
    }

    resetPieces();

    const stopLoop = studio.start((delta) => {
      const dt = Math.min(delta, 0.05);
      const s = stateRef.current;
      for (const p of piecesRef.current) {
        const [wx, wz] = rcToWorld(p.r, p.c);
        const targetY = s.selectedPiece === p ? 0.25 : 0.05;
        p.group.position.x = THREE.MathUtils.damp(p.group.position.x, wx, 14, dt);
        p.group.position.z = THREE.MathUtils.damp(p.group.position.z, wz, 14, dt);
        p.group.position.y = THREE.MathUtils.damp(p.group.position.y, targetY, 14, dt);
      }
    });

    return () => {
      if (stateRef.current.aiTimer) clearTimeout(stateRef.current.aiTimer);
      stopLoop();
      studio.cleanup();
    };
  }, [resetPieces]);

  const handleBoardTap = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stateRef.current;
    if (!s.started || s.gameOver || s.turn !== 1) return;
    if (!cameraRef.current || !mountRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, cameraRef.current);

    // Check if tapped a tile
    const tileHits = raycaster.intersectObjects(tileMeshesRef.current, false);
    if (tileHits.length > 0) {
      const { r, c } = tileHits[0].object.userData as { r: number; c: number };
      const moveMatch = s.validMoves.find((m) => m.toR === r && m.toC === c);
      if (moveMatch) {
        executeMoveRef.current(moveMatch);
        return;
      }
      const tappedMine = piecesRef.current.find((p) => p.owner === 1 && p.r === r && p.c === c);
      if (tappedMine) {
        showMovesForPiece(tappedMine);
        sound.playClick();
        return;
      }
    }

    // Check if tapped directly on a Cyan piece mesh
    const myGroups = piecesRef.current.filter((p) => p.owner === 1).map((p) => p.group);
    const pieceHits = raycaster.intersectObjects(myGroups, true);
    if (pieceHits.length > 0) {
      let obj: THREE.Object3D | null = pieceHits[0].object;
      while (obj && !myGroups.includes(obj as THREE.Group)) {
        obj = obj.parent;
      }
      const tapped = piecesRef.current.find((p) => p.group === obj);
      if (tapped) {
        showMovesForPiece(tapped);
        sound.playClick();
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-2.5 w-full max-w-md mx-auto">
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-purple-500/30 rounded-xl text-xs font-mono tabular-nums">
        <span className="text-cyan-400 font-bold">You: {playerCount}</span>
        <span className="text-rose-400 font-bold">Bot: {botCount}</span>
        <span className="text-amber-400 font-bold">Pts: {score}</span>
      </div>

      <div
        className="relative w-full h-[360px] rounded-2xl overflow-hidden border-2 border-purple-500/40 bg-[#0b0714] touch-none select-none"
        onPointerDown={handleBoardTap}
      >
        <div ref={mountRef} className="w-full h-full touch-none" />

        {started && !gameOver && (
          <div className="absolute top-2 left-2 right-2 flex justify-between items-center pointer-events-none">
            <span className="px-2.5 py-1 rounded-lg bg-black/75 border border-white/10 text-[11px] font-semibold text-slate-200 truncate">
              {status}
            </span>
            <span className={`px-2 py-1 rounded-lg text-[11px] font-black ${turn === 1 ? 'bg-cyan-500 text-black' : 'bg-rose-500 text-white'}`}>
              {turn === 1 ? 'YOUR TURN' : 'BOT'}
            </span>
          </div>
        )}

        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black text-purple-400 mb-1">{winnerText}</h3>
                <p className="text-slate-300 text-sm mb-3">
                  Score: <span className="text-white font-bold">{score}</span> · +{Math.max(3, Math.floor(score / 28))} Coins
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); startGame(); }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-purple-500 text-white font-extrabold rounded-xl active:scale-95"
                >
                  <RotateCcw size={18} /> Play Again
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black text-purple-400 mb-1">3D Checkers Arena</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[250px]">
                  Tap a Cyan 3D disc to highlight diagonal moves, jump Bot discs to capture, and crown 3D Kings!
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); startGame(); }}
                  className="flex items-center gap-2 px-7 py-3 bg-purple-500 text-white font-extrabold rounded-xl shadow-lg shadow-purple-500/30 active:scale-95"
                >
                  <Play size={18} fill="currentColor" /> Start Checkers
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400">Tap a Cyan disc, then tap a glowing golden ring</p>
    </div>
  );
};
