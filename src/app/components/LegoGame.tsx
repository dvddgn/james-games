"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface BrickType {
  name: string;
  width: number;
  height: number;
  color: string;
  darkColor: string;
  studs: number;
}

const BRICK_TYPES: BrickType[] = [
  { name: "1x1", width: 40, height: 40, color: "#EF4444", darkColor: "#B91C1C", studs: 1 },
  { name: "1x2", width: 80, height: 40, color: "#3B82F6", darkColor: "#1D4ED8", studs: 2 },
  { name: "1x3", width: 120, height: 40, color: "#10B981", darkColor: "#047857", studs: 3 },
  { name: "1x4", width: 160, height: 40, color: "#F59E0B", darkColor: "#B45309", studs: 4 },
  { name: "1x2", width: 80, height: 40, color: "#EC4899", darkColor: "#BE185D", studs: 2 },
  { name: "1x1", width: 40, height: 40, color: "#8B5CF6", darkColor: "#6D28D9", studs: 1 },
  { name: "1x2", width: 80, height: 40, color: "#F97316", darkColor: "#C2410C", studs: 2 },
  { name: "1x3", width: 120, height: 40, color: "#06B6D4", darkColor: "#0E7490", studs: 3 },
];

interface PupCharacter {
  name: string;
  emoji: string;
  color: string;
}

const PUP_STAMPS: PupCharacter[] = [
  { name: "Chase", emoji: "🐕", color: "#3B82F6" },
  { name: "Marshall", emoji: "🚒", color: "#EF4444" },
  { name: "Skye", emoji: "🦅", color: "#EC4899" },
  { name: "Rubble", emoji: "🏗️", color: "#F59E0B" },
  { name: "Rocky", emoji: "♻️", color: "#10B981" },
  { name: "Zuma", emoji: "🏄", color: "#F97316" },
];

interface PlacedBrick {
  id: number;
  type: BrickType;
  x: number;
  y: number;
}

interface PlacedStamp {
  id: number;
  pup: PupCharacter;
  x: number;
  y: number;
}

const GRID_SIZE = 40;
const BOARD_WIDTH = 520;
const BOARD_HEIGHT = 480;

type ToolMode = "brick" | "stamp" | "eraser";

export default function LegoGame() {
  const [placedBricks, setPlacedBricks] = useState<PlacedBrick[]>([]);
  const [placedStamps, setPlacedStamps] = useState<PlacedStamp[]>([]);
  const [selectedBrick, setSelectedBrick] = useState<BrickType>(BRICK_TYPES[1]);
  const [selectedStamp, setSelectedStamp] = useState<PupCharacter>(PUP_STAMPS[0]);
  const [toolMode, setToolMode] = useState<ToolMode>("brick");
  const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number } | null>(null);
  const [brickCount, setBrickCount] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  const snapToGrid = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

  const handleBoardMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!boardRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();
      const x = snapToGrid(e.clientX - rect.left - (toolMode === "brick" ? selectedBrick.width / 2 : 20));
      const y = snapToGrid(e.clientY - rect.top - (toolMode === "brick" ? selectedBrick.height / 2 : 20));
      setGhostPosition({ x, y });
    },
    [selectedBrick, toolMode]
  );

  const checkCollision = useCallback(
    (x: number, y: number, brick: BrickType, excludeId?: number) => {
      return placedBricks.some((b) => {
        if (excludeId !== undefined && b.id === excludeId) return false;
        return (
          x < b.x + b.type.width &&
          x + brick.width > b.x &&
          y < b.y + b.type.height &&
          y + brick.height > b.y
        );
      });
    },
    [placedBricks]
  );

  const handleBoardClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!boardRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();

      if (toolMode === "eraser") {
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        // Remove brick under cursor
        setPlacedBricks((prev) => {
          const idx = prev.findIndex(
            (b) =>
              clickX >= b.x &&
              clickX <= b.x + b.type.width &&
              clickY >= b.y &&
              clickY <= b.y + b.type.height
          );
          if (idx !== -1) {
            setBrickCount((c) => c - 1);
            return prev.filter((_, i) => i !== idx);
          }
          return prev;
        });
        // Remove stamp under cursor
        setPlacedStamps((prev) => {
          const idx = prev.findIndex(
            (s) =>
              clickX >= s.x &&
              clickX <= s.x + 40 &&
              clickY >= s.y &&
              clickY <= s.y + 40
          );
          if (idx !== -1) return prev.filter((_, i) => i !== idx);
          return prev;
        });
        return;
      }

      if (toolMode === "stamp") {
        const x = snapToGrid(e.clientX - rect.left - 20);
        const y = snapToGrid(e.clientY - rect.top - 20);
        if (x >= 0 && y >= 0 && x + 40 <= BOARD_WIDTH && y + 40 <= BOARD_HEIGHT) {
          idRef.current += 1;
          setPlacedStamps((prev) => [
            ...prev,
            { id: idRef.current, pup: selectedStamp, x, y },
          ]);
        }
        return;
      }

      // Brick mode
      const x = snapToGrid(e.clientX - rect.left - selectedBrick.width / 2);
      const y = snapToGrid(e.clientY - rect.top - selectedBrick.height / 2);

      if (
        x >= 0 &&
        y >= 0 &&
        x + selectedBrick.width <= BOARD_WIDTH &&
        y + selectedBrick.height <= BOARD_HEIGHT &&
        !checkCollision(x, y, selectedBrick)
      ) {
        idRef.current += 1;
        setPlacedBricks((prev) => [
          ...prev,
          { id: idRef.current, type: selectedBrick, x, y },
        ]);
        setBrickCount((c) => c + 1);
      }
    },
    [toolMode, selectedBrick, selectedStamp, checkCollision]
  );

  const clearBoard = () => {
    setPlacedBricks([]);
    setPlacedStamps([]);
    setBrickCount(0);
  };

  // Keyboard shortcut for tool switching
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "b") setToolMode("brick");
      if (e.key === "s") setToolMode("stamp");
      if (e.key === "e") setToolMode("eraser");
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-6 select-none">
      <h1
        className="text-4xl font-bold text-white mb-1 drop-shadow-lg"
        style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.3)" }}
      >
        🧱 Paw Patrol Lego Builder 🧱
      </h1>
      <p className="text-white/70 mb-3">Bricks placed: {brickCount}</p>

      {/* Tool selector */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setToolMode("brick")}
          className={`px-4 py-2 rounded-lg font-bold transition-colors ${
            toolMode === "brick"
              ? "bg-yellow-400 text-blue-900"
              : "bg-white/20 text-white hover:bg-white/30"
          }`}
        >
          🧱 Bricks (B)
        </button>
        <button
          onClick={() => setToolMode("stamp")}
          className={`px-4 py-2 rounded-lg font-bold transition-colors ${
            toolMode === "stamp"
              ? "bg-yellow-400 text-blue-900"
              : "bg-white/20 text-white hover:bg-white/30"
          }`}
        >
          🐾 Pups (S)
        </button>
        <button
          onClick={() => setToolMode("eraser")}
          className={`px-4 py-2 rounded-lg font-bold transition-colors ${
            toolMode === "eraser"
              ? "bg-yellow-400 text-blue-900"
              : "bg-white/20 text-white hover:bg-white/30"
          }`}
        >
          🧹 Eraser (E)
        </button>
        <button
          onClick={clearBoard}
          className="px-4 py-2 rounded-lg font-bold bg-red-500/80 text-white hover:bg-red-600 transition-colors"
        >
          🗑️ Clear
        </button>
      </div>

      {/* Brick/stamp palette */}
      {toolMode === "brick" && (
        <div className="flex gap-2 mb-3 flex-wrap justify-center">
          {BRICK_TYPES.map((brick, i) => (
            <button
              key={i}
              onClick={() => setSelectedBrick(brick)}
              className={`rounded-lg p-2 transition-all ${
                selectedBrick === brick
                  ? "ring-4 ring-yellow-400 scale-110"
                  : "hover:scale-105"
              }`}
              style={{ backgroundColor: brick.color }}
            >
              <div className="flex items-center gap-1">
                {Array.from({ length: brick.studs }).map((_, j) => (
                  <div
                    key={j}
                    className="w-4 h-4 rounded-full border-2 border-white/40"
                    style={{ backgroundColor: brick.darkColor }}
                  />
                ))}
              </div>
              <div className="text-white text-xs font-bold mt-1">{brick.name}</div>
            </button>
          ))}
        </div>
      )}

      {toolMode === "stamp" && (
        <div className="flex gap-2 mb-3 flex-wrap justify-center">
          {PUP_STAMPS.map((pup, i) => (
            <button
              key={i}
              onClick={() => setSelectedStamp(pup)}
              className={`rounded-lg px-3 py-2 transition-all ${
                selectedStamp === pup
                  ? "ring-4 ring-yellow-400 scale-110"
                  : "hover:scale-105"
              }`}
              style={{ backgroundColor: pup.color }}
            >
              <div className="text-2xl">{pup.emoji}</div>
              <div className="text-white text-xs font-bold">{pup.name}</div>
            </button>
          ))}
        </div>
      )}

      {/* Build board */}
      <div
        ref={boardRef}
        className="relative rounded-xl border-4 border-white/30 cursor-crosshair"
        style={{
          width: BOARD_WIDTH,
          height: BOARD_HEIGHT,
          background: "#4ADE80",
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
        }}
        onMouseMove={handleBoardMouseMove}
        onMouseLeave={() => setGhostPosition(null)}
        onClick={handleBoardClick}
      >
        {/* Placed bricks */}
        {placedBricks.map((brick) => (
          <div
            key={brick.id}
            className="absolute rounded-sm"
            style={{
              left: brick.x,
              top: brick.y,
              width: brick.type.width,
              height: brick.type.height,
              backgroundColor: brick.type.color,
              border: `3px solid ${brick.type.darkColor}`,
              boxShadow: "0 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3)",
            }}
          >
            <div className="flex items-center justify-center gap-1 h-full">
              {Array.from({ length: brick.type.studs }).map((_, j) => (
                <div
                  key={j}
                  className="w-6 h-6 rounded-full border-2 border-white/30"
                  style={{
                    backgroundColor: brick.type.darkColor,
                    boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)",
                  }}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Placed stamps */}
        {placedStamps.map((stamp) => (
          <div
            key={`stamp-${stamp.id}`}
            className="absolute flex items-center justify-center"
            style={{
              left: stamp.x,
              top: stamp.y,
              width: 40,
              height: 40,
              fontSize: 28,
              filter: "drop-shadow(1px 1px 2px rgba(0,0,0,0.3))",
            }}
          >
            {stamp.pup.emoji}
          </div>
        ))}

        {/* Ghost preview */}
        {ghostPosition && toolMode === "brick" && (
          <div
            className="absolute rounded-sm pointer-events-none"
            style={{
              left: ghostPosition.x,
              top: ghostPosition.y,
              width: selectedBrick.width,
              height: selectedBrick.height,
              backgroundColor: selectedBrick.color,
              border: `3px dashed ${selectedBrick.darkColor}`,
              opacity: 0.4,
            }}
          >
            <div className="flex items-center justify-center gap-1 h-full">
              {Array.from({ length: selectedBrick.studs }).map((_, j) => (
                <div
                  key={j}
                  className="w-6 h-6 rounded-full border-2 border-white/30"
                  style={{ backgroundColor: selectedBrick.darkColor }}
                />
              ))}
            </div>
          </div>
        )}

        {ghostPosition && toolMode === "stamp" && (
          <div
            className="absolute pointer-events-none flex items-center justify-center"
            style={{
              left: ghostPosition.x,
              top: ghostPosition.y,
              width: 40,
              height: 40,
              fontSize: 28,
              opacity: 0.5,
            }}
          >
            {selectedStamp.emoji}
          </div>
        )}

        {ghostPosition && toolMode === "eraser" && (
          <div
            className="absolute pointer-events-none flex items-center justify-center"
            style={{
              left: ghostPosition.x,
              top: ghostPosition.y,
              width: 40,
              height: 40,
              fontSize: 24,
              opacity: 0.7,
            }}
          >
            🧹
          </div>
        )}
      </div>

      <div className="mt-3 text-white/70 text-sm">
        Click to place bricks or pup stamps. Use eraser to remove.
      </div>
    </div>
  );
}
