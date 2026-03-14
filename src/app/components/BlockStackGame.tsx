"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Pup {
  name: string;
  color: string;
  emoji: string;
  darkColor: string;
}

const PUPS: Pup[] = [
  { name: "Chase", color: "#3B82F6", emoji: "🐕", darkColor: "#1D4ED8" },
  { name: "Marshall", color: "#EF4444", emoji: "🐾", darkColor: "#B91C1C" },
  { name: "Skye", color: "#EC4899", emoji: "🦅", darkColor: "#BE185D" },
  { name: "Rubble", color: "#F59E0B", emoji: "🏗️", darkColor: "#B45309" },
  { name: "Rocky", color: "#10B981", emoji: "♻️", darkColor: "#047857" },
  { name: "Zuma", color: "#F97316", emoji: "🏄", darkColor: "#C2410C" },
];

interface Block {
  id: number;
  pup: Pup;
  x: number;
  y: number;
  width: number;
  placed: boolean;
}

const GAME_WIDTH = 400;
const GAME_HEIGHT = 600;
const BLOCK_HEIGHT = 40;
const GROUND_Y = GAME_HEIGHT - 20;
const INITIAL_BLOCK_WIDTH = 200;
const SWING_SPEED_INITIAL = 3;
const SWING_SPEED_INCREMENT = 0.3;
const MIN_BLOCK_WIDTH = 40;

export default function BlockStackGame() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [currentBlock, setCurrentBlock] = useState<Block | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [message, setMessage] = useState("");
  const [swingDirection, setSwingDirection] = useState(1);
  const [cameraOffset, setCameraOffset] = useState(0);
  const animationRef = useRef<number | null>(null);
  const blockIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      setScale(Math.min(w / GAME_WIDTH, 1));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const getRandomPup = () => PUPS[Math.floor(Math.random() * PUPS.length)];

  const createNewBlock = useCallback(
    (width: number) => {
      blockIdRef.current += 1;
      return {
        id: blockIdRef.current,
        pup: getRandomPup(),
        x: 0,
        y: 50 - cameraOffset,
        width,
        placed: false,
      };
    },
    [cameraOffset]
  );

  const startGame = useCallback(() => {
    setBlocks([]);
    setScore(0);
    setCombo(0);
    setGameOver(false);
    setGameStarted(true);
    setMessage("");
    setCameraOffset(0);
    blockIdRef.current = 0;
    setCurrentBlock(createNewBlock(INITIAL_BLOCK_WIDTH));
    setSwingDirection(1);
  }, [createNewBlock]);

  const dropBlock = useCallback(() => {
    if (!currentBlock || gameOver) return;

    const placedBlocks = blocks.filter((b) => b.placed);
    const topBlock = placedBlocks[placedBlocks.length - 1];

    let landingY: number;
    let overlap: number;
    let newX: number;
    let newWidth: number;

    if (placedBlocks.length === 0) {
      // First block lands on ground
      landingY = GROUND_Y - BLOCK_HEIGHT;
      newX = currentBlock.x;
      newWidth = currentBlock.width;
      overlap = newWidth;
    } else {
      landingY = topBlock.y - BLOCK_HEIGHT;

      // Calculate overlap
      const currentLeft = currentBlock.x;
      const currentRight = currentBlock.x + currentBlock.width;
      const topLeft = topBlock.x;
      const topRight = topBlock.x + topBlock.width;

      const overlapLeft = Math.max(currentLeft, topLeft);
      const overlapRight = Math.min(currentRight, topRight);
      overlap = overlapRight - overlapLeft;

      if (overlap <= 0) {
        // Missed completely
        setGameOver(true);
        setMessage("The tower fell! 🐶");
        return;
      }

      newX = overlapLeft;
      newWidth = overlap;
    }

    // Check for combo (same pup)
    let newCombo = combo;
    let bonusPoints = 0;
    if (topBlock && currentBlock.pup.name === topBlock.pup.name) {
      newCombo += 1;
      bonusPoints = newCombo * 50;
      setCombo(newCombo);
      setMessage(
        `${currentBlock.pup.name} combo x${newCombo + 1}! +${bonusPoints} 🌟`
      );
    } else {
      setCombo(0);
      newCombo = 0;
    }

    // Perfect placement bonus
    if (
      topBlock &&
      Math.abs(newWidth - topBlock.width) < 5 &&
      Math.abs(newX - topBlock.x) < 5
    ) {
      bonusPoints += 100;
      newWidth = topBlock.width; // Snap to perfect
      newX = topBlock.x;
      setMessage("PERFECT! 🎉 +100");
    }

    const placedBlock: Block = {
      ...currentBlock,
      x: newX,
      y: landingY,
      width: newWidth,
      placed: true,
    };

    const newBlocks = [...blocks, placedBlock];
    setBlocks(newBlocks);
    setScore((s) => s + 10 + bonusPoints);

    // Camera follows the tower upward
    const towerHeight = (newBlocks.filter((b) => b.placed).length) * BLOCK_HEIGHT;
    if (towerHeight > GAME_HEIGHT * 0.4) {
      setCameraOffset(towerHeight - GAME_HEIGHT * 0.4);
    }

    // Check if block is too narrow
    if (newWidth < MIN_BLOCK_WIDTH) {
      setGameOver(true);
      setMessage("Tower too wobbly! 🐶");
      return;
    }

    // Create next block
    setCurrentBlock({
      ...createNewBlock(newWidth),
      y: landingY - BLOCK_HEIGHT - 80,
    });
  }, [currentBlock, blocks, gameOver, combo, createNewBlock]);

  // Swing animation
  useEffect(() => {
    if (!gameStarted || gameOver || !currentBlock) return;

    const speed =
      SWING_SPEED_INITIAL +
      blocks.filter((b) => b.placed).length * SWING_SPEED_INCREMENT;

    const animate = () => {
      setCurrentBlock((prev) => {
        if (!prev) return prev;
        let newX = prev.x + speed * swingDirection;

        if (newX + prev.width > GAME_WIDTH) {
          setSwingDirection(-1);
          newX = GAME_WIDTH - prev.width;
        } else if (newX < 0) {
          setSwingDirection(1);
          newX = 0;
        }

        return { ...prev, x: newX };
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [gameStarted, gameOver, currentBlock?.id, swingDirection, blocks.length]);

  // Keyboard / touch controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        if (!gameStarted || gameOver) {
          startGame();
        } else {
          dropBlock();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameStarted, gameOver, startGame, dropBlock]);

  const handleClick = () => {
    if (!gameStarted || gameOver) {
      startGame();
    } else {
      dropBlock();
    }
  };

  // Clear message after delay
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(""), 1500);
      return () => clearTimeout(t);
    }
  }, [message]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen select-none">
      <h1
        className="text-2xl sm:text-4xl font-bold mb-2 text-white drop-shadow-lg"
        style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.3)" }}
      >
        🐾 Paw Patrol Blocks 🐾
      </h1>

      <div className="flex gap-4 mb-2 text-lg font-bold text-white">
        <span>Score: {score}</span>
        <span>Blocks: {blocks.filter((b) => b.placed).length}</span>
      </div>

      {message && (
        <div className="text-2xl font-bold text-yellow-300 mb-2 animate-bounce drop-shadow-lg">
          {message}
        </div>
      )}

      <div ref={containerRef} className="w-full" style={{ maxWidth: GAME_WIDTH }}>
      <div style={{ height: GAME_HEIGHT * scale, overflow: 'hidden' }}>
      <div
        className="relative rounded-xl overflow-hidden cursor-pointer border-4 border-white/30"
        style={{
          width: GAME_WIDTH,
          height: GAME_HEIGHT,
          background: "linear-gradient(180deg, #87CEEB 0%, #4A90D9 40%, #2D6B3F 85%, #1B4D2E 100%)",
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          touchAction: 'none',
        }}
        onClick={handleClick}
      >
        {/* Ground */}
        <div
          className="absolute left-0 right-0"
          style={{
            bottom: 0,
            height: 20 + cameraOffset,
            background: "linear-gradient(180deg, #4CAF50, #2E7D32)",
            transform: `translateY(${-cameraOffset}px)`,
          }}
        />

        {/* Placed blocks */}
        {blocks
          .filter((b) => b.placed)
          .map((block) => (
            <div
              key={block.id}
              className="absolute rounded-md flex items-center justify-center text-white font-bold text-sm transition-all"
              style={{
                left: block.x,
                top: block.y + cameraOffset,
                width: block.width,
                height: BLOCK_HEIGHT,
                backgroundColor: block.pup.color,
                border: `3px solid ${block.pup.darkColor}`,
                boxShadow: `0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)`,
              }}
            >
              <span className="mr-1">{block.pup.emoji}</span>
              {block.width > 80 && block.pup.name}
            </div>
          ))}

        {/* Current swinging block */}
        {currentBlock && !gameOver && (
          <div
            className="absolute rounded-md flex items-center justify-center text-white font-bold text-sm"
            style={{
              left: currentBlock.x,
              top: currentBlock.y + cameraOffset,
              width: currentBlock.width,
              height: BLOCK_HEIGHT,
              backgroundColor: currentBlock.pup.color,
              border: `3px solid ${currentBlock.pup.darkColor}`,
              boxShadow: `0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)`,
              opacity: 0.9,
            }}
          >
            <span className="mr-1">{currentBlock.pup.emoji}</span>
            {currentBlock.width > 80 && currentBlock.pup.name}
          </div>
        )}

        {/* Start screen */}
        {!gameStarted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
            <div className="text-6xl mb-4">🏗️</div>
            <div className="text-3xl font-bold text-white mb-2">
              Paw Patrol Blocks
            </div>
            <div className="text-lg text-white/80 mb-4">
              Build the Lookout Tower!
            </div>
            <div className="text-white bg-blue-600 px-6 py-3 rounded-full text-xl font-bold hover:bg-blue-700 transition-colors">
              Tap or Press Space to Start!
            </div>
          </div>
        )}

        {/* Game over screen */}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
            <div className="text-5xl mb-4">🐶</div>
            <div className="text-3xl font-bold text-white mb-2">
              Great Job!
            </div>
            <div className="text-xl text-white mb-1">Score: {score}</div>
            <div className="text-lg text-white/80 mb-4">
              Tower: {blocks.filter((b) => b.placed).length} blocks tall!
            </div>
            <div className="text-white bg-green-600 px-6 py-3 rounded-full text-xl font-bold hover:bg-green-700 transition-colors">
              Tap or Press Space to Play Again!
            </div>
          </div>
        )}
      </div>
      </div>
      </div>

      <div className="mt-3 text-white/70 text-sm">
        Tap or press Space to drop blocks • Match pups for combo bonus!
      </div>
    </div>
  );
}
