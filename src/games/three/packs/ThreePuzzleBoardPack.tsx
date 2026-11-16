import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { sound } from '../../../services/audio';
import { createStudioContext, makeCanvasTexture } from '../threeUtils';
import { Dices, Play, RotateCcw } from 'lucide-react';

export type PuzzleBoardVariant = 'hanoi' | 'slide' | 'knight' | 'sudoku' | 'domino' | 'dice-duel';

interface Props {
  variant: PuzzleBoardVariant;
  onGameOver: (score: number, coinsEarned: number) => void;
}

const VARIANT_META: Record<PuzzleBoardVariant, { title: string; subtitle: string; accent: string }> = {
  hanoi: { title: '3D Towers of Hanoi', subtitle: 'Move all 4 neon rings onto the right peg without placing larger rings atop smaller ones!', accent: '#f59e0b' },
  slide: { title: '3D Cube Slide', subtitle: 'Slide the 8 metallic numbered 3D cubes into ascending order (1–8) before time runs out!', accent: '#22d3ee' },
  knight: { title: "3D Knight's Tour", subtitle: 'Jump your 3D Chess Knight in L-shapes to light up all 25 squares on the cyber board!', accent: '#a855f7' },
  sudoku: { title: '3D Cyber Sudoku', subtitle: 'Fill every empty 3D block with digits 1–4 without repeating in any row, column, or 2x2 box!', accent: '#10b981' },
  domino: { title: '3D Domino Blitz', subtitle: 'Match the active center pip value by tapping a matching 3D domino tile on the felt table!', accent: '#3b82f6' },
  'dice-duel': { title: '3D Dice Duel', subtitle: 'Roll 3 tumbling 3D dice across 5 rounds to beat the Bot score and snag Triple-Six bonuses!', accent: '#f43f5e' },
};

const SUDOKU_PRESETS = [
  {
    puzzle: [1, 0, 0, 4, 0, 4, 1, 0, 0, 1, 4, 0, 4, 0, 0, 1],
    solution: [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1],
  },
  {
    puzzle: [0, 3, 4, 0, 4, 0, 0, 3, 3, 0, 0, 4, 0, 4, 3, 0],
    solution: [1, 3, 4, 2, 4, 2, 1, 3, 3, 1, 2, 4, 2, 4, 3, 1],
  },
];

export const ThreePuzzleBoardPack: React.FC<Props> = ({ variant, onGameOver }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const meta = VARIANT_META[variant];
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(0);
  const [status, setStatus] = useState('');
  const [selectedPeg, setSelectedPeg] = useState<number | null>(null);
  const [sudokuCell, setSudokuCell] = useState<number | null>(null);
  const [diceRound, setDiceRound] = useState(1);
  const [botScore, setBotScore] = useState(0);
  const [targetPip, setTargetPip] = useState(3);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const actorsRef = useRef<THREE.Object3D[]>([]);
  const texListRef = useRef<THREE.Texture[]>([]);

  const gameRef = useRef({
    started: false,
    gameOver: false,
    score: 0,
    moves: 0,
    // hanoi
    pegs: [[4, 3, 2, 1], [], []] as number[][],
    selPeg: null as number | null,
    // slide
    slideGrid: [1, 2, 3, 4, 5, 6, 7, 8, 0] as number[],
    // knight
    knightPos: [2, 2] as [number, number],
    visited: new Set<string>(['2,2']),
    // sudoku
    sudokuGrid: [] as number[],
    sudokuFixed: [] as boolean[],
    sudokuSol: [] as number[],
    selSud: null as number | null,
    // domino
    dominoRack: [] as [number, number][],
    dominoCenter: 3,
    // dice duel
    diceRound: 1,
    botTotal: 0,
    diceSpin: 0,
    diceValues: [1, 2, 3],
  });
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const clearActors = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    actorsRef.current.forEach((o) => scene.remove(o));
    actorsRef.current = [];
    texListRef.current.forEach((t) => t.dispose());
    texListRef.current = [];
  }, []);

  const finishGame = useCallback((finalScore: number, msg: string) => {
    const g = gameRef.current;
    if (g.gameOver) return;
    g.gameOver = true;
    g.score = finalScore;
    setScore(finalScore);
    setStatus(msg);
    setGameOver(true);
    sound.playVictory();
    onGameOverRef.current(finalScore, Math.max(3, Math.floor(finalScore / 28)));
  }, []);

  const rebuildSceneObjects = useCallback(() => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    if (!scene || !renderer) return;
    clearActors();
    const g = gameRef.current;

    const addObj = (obj: THREE.Object3D) => {
      scene.add(obj);
      actorsRef.current.push(obj);
    };

    if (variant === 'hanoi') {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(6.8, 0.25, 2.4),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 })
      );
      base.position.y = -0.125;
      addObj(base);

      const pegColors = [0xf59e0b, 0x22d3ee, 0x10b981, 0xf43f5e];
      for (let p = 0; p < 3; p++) {
        const px = (p - 1) * 2.1;
        const rod = new THREE.Mesh(
          new THREE.CylinderGeometry(0.11, 0.11, 2.2, 16),
          new THREE.MeshStandardMaterial({
            color: g.selPeg === p ? 0xfacc15 : 0x64748b,
            emissive: g.selPeg === p ? 0xca8a04 : 0x000000,
            metalness: 0.6,
            roughness: 0.25,
          })
        );
        rod.position.set(px, 1.1, 0);
        rod.userData = { pegIdx: p };
        addObj(rod);

        const pad = new THREE.Mesh(
          new THREE.CylinderGeometry(0.9, 0.95, 0.08, 22),
          new THREE.MeshStandardMaterial({ color: g.selPeg === p ? 0x78350f : 0x1e293b })
        );
        pad.position.set(px, 0.04, 0);
        pad.userData = { pegIdx: p };
        addObj(pad);

        const stack = g.pegs[p];
        stack.forEach((ringSize, levelIdx) => {
          const rMesh = new THREE.Mesh(
            new THREE.TorusGeometry(0.24 + ringSize * 0.14, 0.14, 14, 24),
            new THREE.MeshPhysicalMaterial({
              color: pegColors[ringSize - 1],
              roughness: 0.2,
              metalness: 0.3,
              clearcoat: 1,
            })
          );
          rMesh.rotation.x = Math.PI / 2;
          const isTopSelected = g.selPeg === p && levelIdx === stack.length - 1;
          rMesh.position.set(px, 0.24 + levelIdx * 0.3 + (isTopSelected ? 0.45 : 0), 0);
          rMesh.userData = { pegIdx: p };
          addObj(rMesh);
        });
      }
    } else if (variant === 'slide') {
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(4.1, 0.24, 4.1),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 })
      );
      frame.position.y = -0.14;
      addObj(frame);

      g.slideGrid.forEach((val, idx) => {
        if (val === 0) return;
        const r = Math.floor(idx / 3);
        const c = idx % 3;
        const tex = makeCanvasTexture(renderer, 128, 128, (ctx, w, h) => {
          ctx.fillStyle = val === idx + 1 ? '#065f46' : '#1e293b';
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 8;
          ctx.strokeRect(4, 4, w - 8, h - 8);
          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 64px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(val), w / 2, h / 2 + 4);
        });
        texListRef.current.push(tex);
        const tile = new THREE.Mesh(
          new THREE.BoxGeometry(1.18, 0.38, 1.18),
          new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3 })
        );
        tile.position.set((c - 1) * 1.28, 0.2, (r - 1) * 1.28);
        tile.userData = { slideIdx: idx };
        addObj(tile);
      });
    } else if (variant === 'knight') {
      const [kr, kc] = g.knightPos;
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          const isVisited = g.visited.has(`${r},${c}`);
          const isValid =
            !isVisited &&
            ((Math.abs(r - kr) === 2 && Math.abs(c - kc) === 1) ||
              (Math.abs(r - kr) === 1 && Math.abs(c - kc) === 2));
          const tile = new THREE.Mesh(
            new THREE.BoxGeometry(0.98, 0.14, 0.98),
            new THREE.MeshStandardMaterial({
              color: isValid ? 0xfacc15 : isVisited ? 0x7e22ce : (r + c) % 2 === 0 ? 0x1e293b : 0x0f172a,
              emissive: isValid ? 0xa16207 : isVisited ? 0x581c87 : 0x000000,
              emissiveIntensity: isValid ? 0.65 : 0.35,
            })
          );
          tile.position.set((c - 2) * 1.05, 0, (r - 2) * 1.05);
          tile.userData = { kr: r, kc: c };
          addObj(tile);
        }
      }
      // 3D Knight Statue
      const knight = new THREE.Group();
      const kMat = new THREE.MeshPhysicalMaterial({ color: 0x22d3ee, clearcoat: 1, roughness: 0.18 });
      const kBase = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.18, 18), kMat);
      kBase.position.y = 0.16;
      const kBody = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.45, 0.32), kMat);
      kBody.position.set(0, 0.45, 0);
      const kHead = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.42), kMat);
      kHead.position.set(0, 0.72, 0.12);
      kHead.rotation.x = 0.25;
      knight.add(kBase, kBody, kHead);
      knight.position.set((kc - 2) * 1.05, 0.05, (kr - 2) * 1.05);
      addObj(knight);
    } else if (variant === 'sudoku') {
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(5.1, 0.22, 5.1),
        new THREE.MeshStandardMaterial({ color: 0x0f172a })
      );
      frame.position.y = -0.13;
      addObj(frame);

      for (let i = 0; i < 16; i++) {
        const r = Math.floor(i / 4);
        const c = i % 4;
        const val = g.sudokuGrid[i] || 0;
        const fixed = g.sudokuFixed[i];
        const isSel = g.selSud === i;
        const tex = makeCanvasTexture(renderer, 128, 128, (ctx, w, h) => {
          ctx.fillStyle = isSel ? '#065f46' : fixed ? '#1e293b' : '#0f172a';
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = isSel ? '#34d399' : '#334155';
          ctx.lineWidth = 8;
          ctx.strokeRect(4, 4, w - 8, h - 8);
          if (val > 0) {
            ctx.fillStyle = fixed ? '#94a3b8' : '#34d399';
            ctx.font = 'bold 64px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(val), w / 2, h / 2 + 4);
          }
        });
        texListRef.current.push(tex);
        const cell = new THREE.Mesh(
          new THREE.BoxGeometry(1.06, 0.28, 1.06),
          new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3 })
        );
        const gapX = c >= 2 ? 0.12 : -0.12;
        const gapZ = r >= 2 ? 0.12 : -0.12;
        cell.position.set((c - 1.5) * 1.12 + gapX, isSel ? 0.22 : 0.12, (r - 1.5) * 1.12 + gapZ);
        cell.userData = { sudIdx: i };
        addObj(cell);
      }
    } else if (variant === 'domino') {
      const table = new THREE.Mesh(
        new THREE.BoxGeometry(6.8, 0.25, 5.2),
        new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.65 })
      );
      table.position.y = -0.125;
      addObj(table);

      const drawDomino = (a: number, b: number, highlight: boolean) => {
        const tex = makeCanvasTexture(renderer, 256, 128, (ctx, w, h) => {
          ctx.fillStyle = highlight ? '#fef3c7' : '#f8fafc';
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = highlight ? '#f59e0b' : '#334155';
          ctx.lineWidth = 8;
          ctx.strokeRect(4, 4, w - 8, h - 8);
          ctx.beginPath();
          ctx.moveTo(w / 2, 12);
          ctx.lineTo(w / 2, h - 12);
          ctx.stroke();
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 58px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(a), w * 0.25, h / 2 + 2);
          ctx.fillText(String(b), w * 0.75, h / 2 + 2);
        });
        texListRef.current.push(tex);
        return tex;
      };

      // Center target domino
      const cTex = drawDomino(g.dominoCenter, g.dominoCenter, true);
      const centerDom = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.28, 0.9),
        new THREE.MeshStandardMaterial({ map: cTex })
      );
      centerDom.position.set(0, 0.2, -0.95);
      addObj(centerDom);

      // Rack dominoes
      g.dominoRack.forEach(([a, b], idx) => {
        const dTex = drawDomino(a, b, false);
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.42, 0.24, 0.78),
          new THREE.MeshStandardMaterial({ map: dTex })
        );
        const row = Math.floor(idx / 3);
        const col = idx % 3;
        mesh.position.set((col - 1) * 1.72, 0.16, 0.55 + row * 1.05);
        mesh.userData = { domIdx: idx };
        addObj(mesh);
      });
    } else if (variant === 'dice-duel') {
      const arena = new THREE.Mesh(
        new THREE.CylinderGeometry(3.2, 3.4, 0.26, 28),
        new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.45 })
      );
      arena.position.y = -0.14;
      addObj(arena);

      g.diceValues.forEach((val, idx) => {
        const tex = makeCanvasTexture(renderer, 128, 128, (ctx, w, h) => {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 8;
          ctx.strokeRect(4, 4, w - 8, h - 8);
          ctx.fillStyle = val === 6 ? '#ef4444' : '#0f172a';
          ctx.font = 'bold 68px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(val), w / 2, h / 2 + 4);
        });
        texListRef.current.push(tex);
        const die = new THREE.Mesh(
          new THREE.BoxGeometry(1.05, 1.05, 1.05),
          new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25 })
        );
        die.position.set((idx - 1) * 1.5, 0.65, 0);
        die.userData = { isDie: true, idx };
        addObj(die);
      });
    }
  }, [clearActors, variant]);

  const startGame = useCallback(() => {
    const g = gameRef.current;
    g.started = true;
    g.gameOver = false;
    g.score = 0;
    g.moves = 0;
    g.selPeg = null;
    g.pegs = [[4, 3, 2, 1], [], []];
    // Solvable shuffled 3x3 slide
    const baseSlide = [1, 2, 3, 4, 5, 6, 7, 8, 0];
    let empty = 8;
    for (let k = 0; k < 35; k++) {
      const er = Math.floor(empty / 3), ec = empty % 3;
      const nbs: number[] = [];
      if (er > 0) nbs.push(empty - 3);
      if (er < 2) nbs.push(empty + 3);
      if (ec > 0) nbs.push(empty - 1);
      if (ec < 2) nbs.push(empty + 1);
      const pick = nbs[Math.floor(Math.random() * nbs.length)];
      [baseSlide[empty], baseSlide[pick]] = [baseSlide[pick], baseSlide[empty]];
      empty = pick;
    }
    g.slideGrid = baseSlide;
    g.knightPos = [2, 2];
    g.visited = new Set(['2,2']);
    const preset = SUDOKU_PRESETS[Math.floor(Math.random() * SUDOKU_PRESETS.length)];
    g.sudokuGrid = [...preset.puzzle];
    g.sudokuFixed = preset.puzzle.map((v) => v !== 0);
    g.sudokuSol = [...preset.solution];
    g.selSud = null;

    const cPip = 1 + Math.floor(Math.random() * 6);
    g.dominoCenter = cPip;
    g.dominoRack = Array.from({ length: 6 }, (_, i) =>
      i === 0 ? [cPip, 1 + Math.floor(Math.random() * 6)] : [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]
    );
    g.diceRound = 1;
    g.botTotal = 0;
    g.diceValues = [1, 2, 3];

    setScore(0);
    setMoves(0);
    setSelectedPeg(null);
    setSudokuCell(null);
    setDiceRound(1);
    setBotScore(0);
    setTargetPip(cPip);
    setGameOver(false);
    setStarted(true);
    setStatus(
      variant === 'hanoi' ? 'Tap a peg to lift/drop top ring' :
      variant === 'slide' ? 'Tap tiles next to the empty gap' :
      variant === 'knight' ? 'Visited 1/25 · Tap golden squares' :
      variant === 'sudoku' ? 'Tap a dark cell, then pick 1–4 below' :
      variant === 'domino' ? `Tap any tile containing a ${cPip}!` :
      'Round 1/5 · Tap ROLL DICE!'
    );
    rebuildSceneObjects();
    sound.playClick();
  }, [rebuildSceneObjects, variant]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const studio = createStudioContext(container, { fov: 45, bgColor: 0x070a14, fogNear: 20, fogFar: 55 });
    const { scene, camera, renderer } = studio;
    camera.position.set(0, variant === 'hanoi' ? 3.8 : 6.4, variant === 'hanoi' ? 6.6 : 4.8);
    camera.lookAt(0, variant === 'hanoi' ? 0.8 : 0, 0.1);
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    rebuildSceneObjects();

    const stopLoop = studio.start((delta) => {
      const dt = Math.min(delta, 0.05);
      const g = gameRef.current;
      if (variant === 'dice-duel' && g.diceSpin > 0) {
        g.diceSpin = Math.max(0, g.diceSpin - dt);
        actorsRef.current.forEach((obj) => {
          if (obj.userData.isDie) {
            obj.rotation.x += dt * 16;
            obj.rotation.y += dt * 18;
            obj.position.y = 0.65 + Math.sin((1 - g.diceSpin / 0.5) * Math.PI) * 0.9;
          }
        });
      } else if (variant === 'dice-duel') {
        actorsRef.current.forEach((obj) => {
          if (obj.userData.isDie) {
            obj.rotation.x = THREE.MathUtils.damp(obj.rotation.x, 0, 12, dt);
            obj.rotation.y = THREE.MathUtils.damp(obj.rotation.y, 0, 12, dt);
            obj.position.y = THREE.MathUtils.damp(obj.position.y, 0.65, 12, dt);
          }
        });
      }
    });

    return () => {
      stopLoop();
      clearActors();
      studio.cleanup();
    };
  }, [clearActors, rebuildSceneObjects, variant]);

  const handleBoardTap = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gameRef.current;
    if (!g.started || g.gameOver || !cameraRef.current || !mountRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, cameraRef.current);
    const hits = raycaster.intersectObjects(actorsRef.current, true);
    if (hits.length === 0) return;

    const data = hits[0].object.userData;

    if (variant === 'hanoi' && typeof data.pegIdx === 'number') {
      const p = data.pegIdx;
      if (g.selPeg === null) {
        if (g.pegs[p].length > 0) {
          g.selPeg = p;
          setSelectedPeg(p);
          sound.playClick();
          rebuildSceneObjects();
        }
      } else {
        const from = g.selPeg;
        g.selPeg = null;
        setSelectedPeg(null);
        if (from !== p) {
          const ring = g.pegs[from][g.pegs[from].length - 1];
          const destTop = g.pegs[p][g.pegs[p].length - 1] ?? 99;
          if (ring < destTop) {
            g.pegs[from].pop();
            g.pegs[p].push(ring);
            g.moves += 1;
            setMoves(g.moves);
            sound.playMove();
            if (g.pegs[2].length === 4) {
              rebuildSceneObjects();
              finishGame(Math.max(150, 450 - g.moves * 10), 'TOWER SOLVED!');
              return;
            }
          } else {
            sound.playHit();
            setStatus('Cannot place bigger ring on smaller ring!');
          }
        }
        rebuildSceneObjects();
      }
    } else if (variant === 'slide' && typeof data.slideIdx === 'number') {
      const idx = data.slideIdx;
      const empty = g.slideGrid.indexOf(0);
      const r1 = Math.floor(idx / 3), c1 = idx % 3;
      const r2 = Math.floor(empty / 3), c2 = empty % 3;
      if (Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1) {
        [g.slideGrid[idx], g.slideGrid[empty]] = [g.slideGrid[empty], g.slideGrid[idx]];
        g.moves += 1;
        setMoves(g.moves);
        sound.playMove();
        rebuildSceneObjects();
        const solved = g.slideGrid.slice(0, 8).every((v, i) => v === i + 1);
        if (solved) {
          finishGame(Math.max(140, 420 - g.moves * 4), 'CUBE ORDER SOLVED!');
        }
      }
    } else if (variant === 'knight' && typeof data.kr === 'number') {
      const { kr, kc } = data as { kr: number; kc: number };
      const [cr, cc] = g.knightPos;
      const valid = !g.visited.has(`${kr},${kc}`) && ((Math.abs(kr - cr) === 2 && Math.abs(kc - cc) === 1) || (Math.abs(kr - cr) === 1 && Math.abs(kc - cc) === 2));
      if (valid) {
        g.knightPos = [kr, kc];
        g.visited.add(`${kr},${kc}`);
        g.moves += 1;
        g.score += 18;
        setMoves(g.moves);
        setScore(g.score);
        setStatus(`Squares lit: ${g.visited.size}/25`);
        sound.playCoin();
        rebuildSceneObjects();
        // Check if any moves remain
        let anyLeft = false;
        for (let r = 0; r < 5; r++) {
          for (let c = 0; c < 5; c++) {
            if (!g.visited.has(`${r},${c}`) && ((Math.abs(r - kr) === 2 && Math.abs(c - kc) === 1) || (Math.abs(r - kr) === 1 && Math.abs(c - kc) === 2))) {
              anyLeft = true;
            }
          }
        }
        if (g.visited.size >= 25 || !anyLeft) {
          const bonus = g.visited.size >= 25 ? 200 : 0;
          finishGame(g.score + bonus, g.visited.size >= 25 ? 'FULL 25 KNIGHT TOUR!' : `TOUR ENDED AT ${g.visited.size}/25`);
        }
      }
    } else if (variant === 'sudoku' && typeof data.sudIdx === 'number') {
      const idx = data.sudIdx;
      if (!g.sudokuFixed[idx]) {
        g.selSud = idx;
        setSudokuCell(idx);
        sound.playClick();
        rebuildSceneObjects();
      }
    } else if (variant === 'domino' && typeof data.domIdx === 'number') {
      const idx = data.domIdx;
      const pair = g.dominoRack[idx];
      if (!pair) return;
      if (pair[0] === g.dominoCenter || pair[1] === g.dominoCenter) {
        const nextCenter = pair[0] === g.dominoCenter ? pair[1] : pair[0];
        g.dominoCenter = nextCenter;
        g.score += 40;
        g.moves += 1;
        // Replace used tile and ensure at least one match exists
        const rIdx = Math.floor(Math.random() * 6);
        g.dominoRack[idx] = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
        if (!g.dominoRack.some(([a, b]) => a === nextCenter || b === nextCenter)) {
          g.dominoRack[rIdx] = [nextCenter, 1 + Math.floor(Math.random() * 6)];
        }
        setTargetPip(nextCenter);
        setScore(g.score);
        setMoves(g.moves);
        setStatus(`Matched! Now match pip ${nextCenter}`);
        sound.playCoin();
        rebuildSceneObjects();
        if (g.moves >= 10) {
          finishGame(g.score + 80, '10 DOMINO MATCHES COMPLETE!');
        }
      } else {
        sound.playHit();
        setStatus(`Pick a domino with pip ${g.dominoCenter}!`);
      }
    }
  };

  const handleSudokuDigit = (digit: number) => {
    const g = gameRef.current;
    if (!g.started || g.gameOver || g.selSud === null) return;
    g.sudokuGrid[g.selSud] = digit;
    g.moves += 1;
    setMoves(g.moves);
    sound.playMove();
    rebuildSceneObjects();

    const full = g.sudokuGrid.every((v) => v > 0);
    if (full) {
      const correct = g.sudokuGrid.every((v, i) => v === g.sudokuSol[i]);
      if (correct) {
        finishGame(Math.max(180, 420 - g.moves * 8), 'SUDOKU SOLVED!');
      } else {
        sound.playHit();
        setStatus('Conflict detected! Tap a cell to adjust digits.');
      }
    }
  };

  const handleRollDuel = () => {
    const g = gameRef.current;
    if (!g.started || g.gameOver || g.diceSpin > 0) return;
    g.diceSpin = 0.5;
    const vals = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    g.diceValues = vals;
    const sum = vals[0] + vals[1] + vals[2] + (vals[0] === vals[1] && vals[1] === vals[2] ? 15 : 0);
    const botRoll = 5 + Math.floor(Math.random() * 13);
    g.score += sum * 5;
    g.botTotal += botRoll * 5;
    setScore(g.score);
    setBotScore(g.botTotal);
    sound.playPaddle();
    rebuildSceneObjects();
    setStatus(`Rolled [${vals.join(', ')}] (+${sum * 5}) vs Bot +${botRoll * 5}`);

    if (g.diceRound >= 5) {
      window.setTimeout(() => {
        const winBonus = g.score >= g.botTotal ? 150 : 20;
        finishGame(g.score + winBonus, g.score >= g.botTotal ? 'DICE DUEL VICTORY!' : 'DUEL COMPLETE!');
      }, 650);
    } else {
      g.diceRound += 1;
      setDiceRound(g.diceRound);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2.5 w-full max-w-md mx-auto">
      <div className="flex justify-between w-full px-3 py-2 bg-slate-900/90 border border-white/15 rounded-xl text-xs font-mono tabular-nums">
        {variant === 'dice-duel' ? (
          <>
            <span className="text-rose-400 font-bold">Round {diceRound}/5</span>
            <span className="text-cyan-400 font-bold">You: {score}</span>
            <span className="text-amber-400 font-bold">Bot: {botScore}</span>
          </>
        ) : (
          <>
            <span className="text-cyan-400 font-bold">Moves: {moves}</span>
            <span className="text-amber-400 font-bold">
              {variant === 'domino' ? `Match: ${targetPip}` : `Pts: ${score}`}
            </span>
          </>
        )}
      </div>

      <div
        className="relative w-full h-[335px] rounded-2xl overflow-hidden border-2 bg-[#070a14] touch-none select-none"
        style={{ borderColor: `${meta.accent}66` }}
        onPointerDown={handleBoardTap}
      >
        <div ref={mountRef} className="w-full h-full touch-none" />
        {started && !gameOver && status && (
          <div className="absolute top-2 left-2 right-2 pointer-events-none">
            <span className="px-2.5 py-1 rounded-lg bg-black/75 border border-white/10 text-[11px] font-semibold text-slate-200">
              {status}
            </span>
          </div>
        )}
        {(!started || gameOver) && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
            {gameOver ? (
              <>
                <h3 className="text-2xl font-black mb-1" style={{ color: meta.accent }}>{status}</h3>
                <p className="text-slate-300 text-sm mb-3">
                  Score: {score} · +{Math.max(3, Math.floor(score / 28))} Coins
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); startGame(); }}
                  className="flex items-center gap-2 px-6 py-2.5 text-black font-extrabold rounded-xl active:scale-95"
                  style={{ backgroundColor: meta.accent }}
                >
                  <RotateCcw size={18} /> Play Again
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black mb-1" style={{ color: meta.accent }}>{meta.title}</h3>
                <p className="text-xs text-slate-300 mb-4 max-w-[260px]">{meta.subtitle}</p>
                <button
                  onClick={(e) => { e.stopPropagation(); startGame(); }}
                  className="flex items-center gap-2 px-7 py-3 text-black font-extrabold rounded-xl shadow-lg active:scale-95"
                  style={{ backgroundColor: meta.accent }}
                >
                  <Play size={18} fill="currentColor" /> Start 3D Game
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {variant === 'sudoku' && started && !gameOver && (
        <div className="grid grid-cols-4 gap-2 w-full">
          {[1, 2, 3, 4].map((d) => (
            <button
              key={d}
              type="button"
              disabled={sudokuCell === null}
              onClick={() => handleSudokuDigit(d)}
              className="h-11 rounded-xl bg-emerald-500 disabled:opacity-40 text-black font-black text-base active:scale-95"
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {variant === 'dice-duel' && (
        <button
          type="button"
          disabled={!started || gameOver}
          onClick={handleRollDuel}
          className="w-full h-12 rounded-xl bg-rose-500 disabled:opacity-40 text-white font-black text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <Dices size={20} /> ROLL 3D DICE ({diceRound}/5)
        </button>
      )}

      {variant === 'hanoi' && selectedPeg !== null && (
        <p className="text-[11px] text-amber-300 font-semibold">Peg {selectedPeg + 1} lifted — tap destination peg!</p>
      )}
    </div>
  );
};
