import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../services/audio';
import { createStudioContext, makeCanvasTexture } from './threeUtils';
import { Dices, Play, RotateCcw } from 'lucide-react';

interface Props {
  onGameOver: (score: number, coinsEarned: number) => void;
}

const LADDERS: Record<number, number> = {
  3: 16,
  8: 22,
  14: 27,
  20: 33,
};

const SNAKES: Record<number, number> = {
  17: 5,
  24: 11,
  31: 19,
  34: 21,
};

const CELL = 1.05;

// Convert tile 1..36 into world (x, z) on 6x6 boustrophedon board (row 0 = bottom front, row 5 = top back)
function tileToWorld(tile: number): [number, number] {
  const idx = Math.max(0, Math.min(35, tile - 1));
  const row = Math.floor(idx / 6); // 0..5 bottom to top
  const colInRow = idx % 6;
  const col = row % 2 === 0 ? colInRow : 5 - colInRow;
  const x = (col - 2.5) * CELL;
  const z = (2.5 - row) * CELL;
  return [x, z];
}

function build3DLadder(fromTile: number, toTile: number): THREE.Group {
  const g = new THREE.Group();
  const [x1, z1] = tileToWorld(fromTile);
  const [x2, z2] = tileToWorld(toTile);
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);

  const railMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.35 });
  const rungMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.3, metalness: 0.2 });

  const railGeo = new THREE.CylinderGeometry(0.04, 0.04, len, 8);
  railGeo.rotateX(Math.PI / 2);

  const leftRail = new THREE.Mesh(railGeo, railMat);
  leftRail.position.set(-0.16, 0.08, 0);
  const rightRail = new THREE.Mesh(railGeo, railMat);
  rightRail.position.set(0.16, 0.08, 0);
  g.add(leftRail, rightRail);

  const steps = Math.max(3, Math.floor(len / 0.45));
  const rungGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.34, 8);
  rungGeo.rotateZ(Math.PI / 2);
  for (let i = 1; i < steps; i++) {
    const zPos = -len / 2 + (len * i) / steps;
    const rung = new THREE.Mesh(rungGeo, rungMat);
    rung.position.set(0, 0.08, zPos);
    g.add(rung);
  }

  g.position.set((x1 + x2) / 2, 0.04, (z1 + z2) / 2);
  g.rotation.y = angle;
  return g;
}

function build3DSnake(headTile: number, tailTile: number, colorHex: number): THREE.Group {
  const g = new THREE.Group();
  const [hx, hz] = tileToWorld(headTile);
  const [tx, tz] = tileToWorld(tailTile);
  const mx = (hx + tx) / 2;
  const mz = (hz + tz) / 2;
  const perpX = -(tz - hz) * 0.25;
  const perpZ = (tx - hx) * 0.25;

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(hx, 0.14, hz),
    new THREE.Vector3(hx + (mx - hx) * 0.5 + perpX, 0.2, hz + (mz - hz) * 0.5 + perpZ),
    new THREE.Vector3(mx - perpX * 0.8, 0.15, mz - perpZ * 0.8),
    new THREE.Vector3(tx, 0.09, tz),
  ]);

  const snakeMat = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    roughness: 0.28,
    metalness: 0.2,
    clearcoat: 0.8,
  });
  const body = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.09, 10, false), snakeMat);
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 14), snakeMat);
  head.position.set(hx, 0.17, hz);
  g.add(head);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), eyeMat);
  eyeL.position.set(hx - 0.07, 0.26, hz + 0.06);
  const eyeR = eyeL.clone();
  eyeR.position.x = hx + 0.07;
  g.add(eyeL, eyeR);

  return g;
}

function buildPawn(colorHex: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({ color: colorHex, roughness: 0.2, metalness: 0.35, clearcoat: 1 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.12, 16), mat);
  base.position.y = 0.06;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.17, 0.32, 16), mat);
  body.position.y = 0.28;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), mat);
  head.position.y = 0.5;
  base.castShadow = body.castShadow = head.castShadow = true;
  g.add(base, body, head);
  return g;
}

export const ThreeSnakesLadders: React.FC<Props> = ({ onGameOver }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<'PLAYER' | 'BOT' | null>(null);
  const [playerTile, setPlayerTile] = useState(1);
  const [botTile, setBotTile] = useState(1);
  const [score, setScore] = useState(0);
  const [dice, setDice] = useState<number | null>(null);
  const [turn, setTurn] = useState<'PLAYER' | 'BOT'>('PLAYER');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Roll the 3D dice to climb to tile 36!');

  const stateRef = useRef({
    started: false,
    gameOver: false,
    busy: false,
    pTile: 1,
    bTile: 1,
    score: 0,
    turn: 'PLAYER' as 'PLAYER' | 'BOT',
    timer: null as number | null,
    dieSpin: 0,
  });

  const playerMeshRef = useRef<THREE.Group | null>(null);
  const botMeshRef = useRef<THREE.Group | null>(null);
  const dieMeshRef = useRef<THREE.Mesh | null>(null);
  const playerTargetRef = useRef(new THREE.Vector3());
  const botTargetRef = useRef(new THREE.Vector3());
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const syncTargets = useCallback((pTile: number, bTile: number) => {
    const [px, pz] = tileToWorld(pTile);
    const [bx, bz] = tileToWorld(bTile);
    const same = pTile === bTile;
    playerTargetRef.current.set(px + (same ? -0.18 : 0), 0.04, pz);
    botTargetRef.current.set(bx + (same ? 0.18 : 0), 0.04, bz);
  }, []);

  const triggerEnd = useCallback((who: 'PLAYER' | 'BOT') => {
    const s = stateRef.current;
    if (s.gameOver) return;
    s.gameOver = true;
    s.busy = false;
    setBusy(false);
    setWinner(who);
    setGameOver(true);
    if (who === 'PLAYER') {
      s.score += 300;
      setScore(s.score);
      sound.playVictory();
    } else {
      sound.playGameOver();
    }
    const coins = Math.max(4, Math.floor(s.score / 30));
    onGameOverRef.current(s.score, coins);
  }, []);

  const stepPawnRef = useRef<(who: 'PLAYER' | 'BOT', stepsLeft: number) => void>(() => {});

  const finishTurn = useCallback((who: 'PLAYER' | 'BOT') => {
    const s = stateRef.current;
    if (s.gameOver) return;
    const tile = who === 'PLAYER' ? s.pTile : s.bTile;

    if (tile >= 36) {
      triggerEnd(who);
      return;
    }

    // Check ladder or snake
    if (LADDERS[tile]) {
      const dest = LADDERS[tile];
      if (who === 'PLAYER') {
        s.pTile = dest;
        s.score += 80;
        setPlayerTile(dest);
        setScore(s.score);
      } else {
        s.bTile = dest;
        setBotTile(dest);
      }
      syncTargets(s.pTile, s.bTile);
      sound.playCoin();
      setStatus(`${who === 'PLAYER' ? 'You' : 'Bot'} climbed a 3D Ladder to ${dest}!`);
    } else if (SNAKES[tile]) {
      const dest = SNAKES[tile];
      if (who === 'PLAYER') {
        s.pTile = dest;
        setPlayerTile(dest);
      } else {
        s.bTile = dest;
        setBotTile(dest);
      }
      syncTargets(s.pTile, s.bTile);
      sound.playHit();
      setStatus(`${who === 'PLAYER' ? 'You' : 'Bot'} slid down a 3D Snake to ${dest}!`);
    }

    s.timer = window.setTimeout(() => {
      if (s.gameOver) return;
      const next = who === 'PLAYER' ? 'BOT' : 'PLAYER';
      s.turn = next;
      s.busy = false;
      setTurn(next);
      setBusy(false);

      if (next === 'BOT') {
        setStatus('Bot rolling dice...');
        s.timer = window.setTimeout(() => rollFor('BOT'), 550);
      } else {
        setStatus('Your turn! Tap ROLL DICE.');
      }
    }, 550);
  }, [syncTargets, triggerEnd]);

  stepPawnRef.current = (who: 'PLAYER' | 'BOT', stepsLeft: number) => {
    const s = stateRef.current;
    if (s.gameOver) return;
    if (stepsLeft <= 0) {
      finishTurn(who);
      return;
    }

    if (who === 'PLAYER') {
      s.pTile = Math.min(36, s.pTile + 1);
      s.score += 10;
      setPlayerTile(s.pTile);
      setScore(s.score);
    } else {
      s.bTile = Math.min(36, s.bTile + 1);
      setBotTile(s.bTile);
    }
    syncTargets(s.pTile, s.bTile);
    sound.playMove();

    s.timer = window.setTimeout(() => {
      stepPawnRef.current(who, stepsLeft - 1);
    }, 240);
  };

  const rollFor = useCallback((who: 'PLAYER' | 'BOT') => {
    const s = stateRef.current;
    if (!s.started || s.gameOver || s.busy) return;
    s.busy = true;
    s.dieSpin = 0.5;
    setBusy(true);
    const val = 1 + Math.floor(Math.random() * 6);
    setDice(val);
    sound.playPaddle();
    setStatus(`${who === 'PLAYER' ? 'You' : 'Bot'} rolled a ${val}!`);

    s.timer = window.setTimeout(() => {
      stepPawnRef.current(who, val);
    }, 520);
  }, []);

  const startGame = useCallback(() => {
    const s = stateRef.current;
    if (s.timer) clearTimeout(s.timer);
    s.started = true;
    s.gameOver = false;
    s.busy = false;
    s.pTile = 1;
    s.bTile = 1;
    s.score = 0;
    s.turn = 'PLAYER';
    syncTargets(1, 1);

    setPlayerTile(1);
    setBotTile(1);
    setScore(0);
    setDice(null);
    setTurn('PLAYER');
    setBusy(false);
    setWinner(null);
    setGameOver(false);
    setStarted(true);
    setStatus('Your turn! Tap ROLL DICE.');
    sound.playClick();
  }, [syncTargets]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, {
      fov: 45,
      bgColor: 0x070d16,
      fogNear: 20,
      fogFar: 55,
    });
    const { scene, camera, renderer } = studio;
    camera.position.set(0, 7.6, 6.2);
    camera.lookAt(0, 0, 0.2);

    const boardTex = makeCanvasTexture(renderer, 768, 768, (ctx, w) => {
      const s = w / 6;
      for (let tile = 1; tile <= 36; tile++) {
        const idx = tile - 1;
        const rowFromBot = Math.floor(idx / 6);
        const colInRow = idx % 6;
        const col = rowFromBot % 2 === 0 ? colInRow : 5 - colInRow;
        const canvasRow = 5 - rowFromBot;

        let bg = (col + canvasRow) % 2 === 0 ? '#1e293b' : '#0f172a';
        if (tile === 1) bg = '#0284c7';
        if (tile === 36) bg = '#eab308';
        if (LADDERS[tile]) bg = '#065f46';
        if (SNAKES[tile]) bg = '#881337';

        ctx.fillStyle = bg;
        ctx.fillRect(col * s, canvasRow * s, s, s);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 3;
        ctx.strokeRect(col * s, canvasRow * s, s, s);

        ctx.fillStyle = tile === 36 ? '#0f172a' : '#e2e8f0';
        ctx.font = 'bold 34px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(tile), (col + 0.5) * s, (canvasRow + 0.5) * s);
      }
    });

    const boardSize = 6 * CELL;
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(boardSize + 0.5, 0.3, boardSize + 0.5),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.4 })
    );
    frame.position.y = -0.15;
    scene.add(frame);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(boardSize, 0.1, boardSize),
      new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.35 })
    );
    board.receiveShadow = true;
    scene.add(board);

    // Build 3D Ladders & Snakes
    Object.entries(LADDERS).forEach(([from, to]) => {
      scene.add(build3DLadder(Number(from), to));
    });
    const snakeColors = [0xf43f5e, 0xa855f7, 0xec4899, 0xef4444];
    Object.entries(SNAKES).forEach(([head, tail], i) => {
      scene.add(build3DSnake(Number(head), tail, snakeColors[i % snakeColors.length]));
    });

    // Pawns
    const pMesh = buildPawn(0x22d3ee);
    const bMesh = buildPawn(0xfbbf24);
    scene.add(pMesh, bMesh);
    playerMeshRef.current = pMesh;
    botMeshRef.current = bMesh;
    syncTargets(1, 1);
    pMesh.position.copy(playerTargetRef.current);
    bMesh.position.copy(botTargetRef.current);

    // 3D Die
    const dieMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.65, 0.65),
      new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, roughness: 0.2, clearcoat: 1 })
    );
    dieMesh.position.set(0, 0.38, boardSize / 2 + 0.72);
    dieMesh.castShadow = true;
    scene.add(dieMesh);
    dieMeshRef.current = dieMesh;

    const stopLoop = studio.start((delta) => {
      const dt = Math.min(delta, 0.05);
      const s = stateRef.current;

      pMesh.position.lerp(playerTargetRef.current, Math.min(1, dt * 12));
      bMesh.position.lerp(botTargetRef.current, Math.min(1, dt * 12));

      if (s.dieSpin > 0) {
        s.dieSpin = Math.max(0, s.dieSpin - dt);
        dieMesh.rotation.x += dt * 16;
        dieMesh.rotation.y += dt * 20;
        dieMesh.position.y = 0.38 + Math.sin((1 - s.dieSpin / 0.5) * Math.PI) * 0.85;
      } else {
        dieMesh.rotation.x = THREE.MathUtils.damp(dieMesh.rotation.x, 0, 12, dt);
        dieMesh.rotation.y = THREE.MathUtils.damp(dieMesh.rotation.y, 0, 12, dt);
        dieMesh.position.y = THREE.MathUtils.damp(dieMesh.position.y, 0.38, 12, dt);
      }
    });

    return () => {
      if (stateRef.current.timer) clearTimeout(stateRef.current.timer);
      stopLoop();
      boardTex.dispose();
      studio.cleanup();
    };
  }, [syncTargets]);

  return (
    <div className="flex flex-col items-center gap-2.5 w-full max-w-md mx-auto">
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-emerald-500/30 rounded-xl text-xs font-mono tabular-nums">
        <span className="text-cyan-400 font-bold">You: {playerTile}/36</span>
        <span className="text-amber-400 font-bold">Bot: {botTile}/36</span>
        <span className="text-emerald-400 font-bold">Pts: {score}</span>
      </div>

      <div className="relative w-full h-[350px] rounded-2xl overflow-hidden border-2 border-emerald-500/40 bg-[#070d16] touch-none select-none">
        <div ref={mountRef} className="w-full h-full touch-none" />

        {started && !gameOver && (
          <div className="absolute top-2 left-2 right-2 flex justify-between items-center pointer-events-none">
            <span className="px-2.5 py-1 rounded-lg bg-black/75 border border-white/10 text-[11px] font-semibold text-slate-200 truncate max-w-[78%]">
              {status}
            </span>
            {dice !== null && (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500 text-black font-black text-xs">
                🎲 {dice}
              </span>
            )}
          </div>
        )}

        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black text-emerald-400 mb-1">
                  {winner === 'PLAYER' ? 'YOU REACHED 36!' : 'BOT WON THE RACE!'}
                </h3>
                <p className="text-slate-300 text-sm mb-3">
                  Score: <span className="text-white font-bold">{score}</span> · +{Math.max(4, Math.floor(score / 30))} Coins
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 text-black font-extrabold rounded-xl active:scale-95"
                >
                  <RotateCcw size={18} /> Play Again
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black text-emerald-400 mb-1">3D Snakes &amp; Ladders</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[250px]">
                  Climb glowing 3D ladders, dodge curved 3D snakes, and beat the bot to Tile 36!
                </p>
                <button
                  onClick={startGame}
                  className="flex items-center gap-2 px-7 py-3 bg-emerald-500 text-black font-extrabold rounded-xl shadow-lg shadow-emerald-500/30 active:scale-95"
                >
                  <Play size={18} fill="currentColor" /> Start Race
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={!started || gameOver || busy || turn !== 'PLAYER'}
        onClick={() => rollFor('PLAYER')}
        className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-400 disabled:opacity-40 text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
      >
        <Dices size={20} />
        <span>{turn === 'BOT' ? 'BOT ROLLING...' : busy ? 'MOVING PAWN...' : 'ROLL 3D DICE'}</span>
      </button>
    </div>
  );
};
