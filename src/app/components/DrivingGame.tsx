"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Vec2 {
  x: number;
  y: number;
}

interface Collectible {
  id: number;
  x: number;
  y: number;
  type: "bone" | "badge" | "treat";
  emoji: string;
  points: number;
  collected: boolean;
}

interface PupVehicle {
  name: string;
  emoji: string;
  color: string;
  vehicleEmoji: string;
}

const PUP_VEHICLES: PupVehicle[] = [
  { name: "Chase", emoji: "🐕", color: "#3B82F6", vehicleEmoji: "🚔" },
  { name: "Marshall", emoji: "🐾", color: "#EF4444", vehicleEmoji: "🚒" },
  { name: "Skye", emoji: "🦅", color: "#EC4899", vehicleEmoji: "🚁" },
  { name: "Rubble", emoji: "🏗️", color: "#F59E0B", vehicleEmoji: "🚜" },
  { name: "Rocky", emoji: "♻️", color: "#10B981", vehicleEmoji: "🚛" },
  { name: "Zuma", emoji: "🏄", color: "#F97316", vehicleEmoji: "🚤" },
];

const CANVAS_WIDTH = 700;
const CANVAS_HEIGHT = 500;
const CAR_SIZE = 36;
const TURN_SPEED = 4;
const ACCELERATION = 0.15;
const FRICTION = 0.97;
const MAX_SPEED = 5;
const COLLECTIBLE_SIZE = 28;

// Lookout tower and road layout
const TOWER_X = 310;
const TOWER_Y = 210;
const TOWER_SIZE = 80;

// Road as a circular track around the tower
const ROAD_CENTER_X = 350;
const ROAD_CENTER_Y = 250;
const ROAD_RADIUS_OUTER = 200;
const ROAD_RADIUS_INNER = 140;

// Buildings around the map
const BUILDINGS = [
  { x: 50, y: 50, w: 80, h: 60, color: "#8B5CF6", label: "Katie's Pet Parlor" },
  { x: 560, y: 50, w: 90, h: 60, color: "#06B6D4", label: "Town Hall" },
  { x: 50, y: 380, w: 80, h: 70, color: "#F59E0B", label: "Mr. Porter's" },
  { x: 560, y: 370, w: 90, h: 70, color: "#10B981", label: "Farmer Al's" },
];

function generateCollectibles(): Collectible[] {
  const items: Collectible[] = [];
  const types: Array<{ type: Collectible["type"]; emoji: string; points: number }> = [
    { type: "bone", emoji: "🦴", points: 10 },
    { type: "badge", emoji: "⭐", points: 25 },
    { type: "treat", emoji: "🍖", points: 15 },
  ];

  let id = 0;
  // Place collectibles around the road
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
    const r = ROAD_RADIUS_INNER + (ROAD_RADIUS_OUTER - ROAD_RADIUS_INNER) / 2;
    const t = types[id % types.length];
    items.push({
      id: id++,
      x: ROAD_CENTER_X + Math.cos(angle) * r - COLLECTIBLE_SIZE / 2,
      y: ROAD_CENTER_Y + Math.sin(angle) * r - COLLECTIBLE_SIZE / 2,
      ...t,
      collected: false,
    });
  }

  return items;
}

function isOnRoad(x: number, y: number): boolean {
  const dx = x - ROAD_CENTER_X;
  const dy = y - ROAD_CENTER_Y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist >= ROAD_RADIUS_INNER - 20 && dist <= ROAD_RADIUS_OUTER + 20;
}

function collidesWithBuilding(x: number, y: number): boolean {
  return BUILDINGS.some(
    (b) => x + CAR_SIZE > b.x && x < b.x + b.w && y + CAR_SIZE > b.y && y < b.y + b.h
  );
}

function collidesWithTower(x: number, y: number): boolean {
  return (
    x + CAR_SIZE > TOWER_X &&
    x < TOWER_X + TOWER_SIZE &&
    y + CAR_SIZE > TOWER_Y &&
    y < TOWER_Y + TOWER_SIZE
  );
}

export default function DrivingGame() {
  const [selectedPup, setSelectedPup] = useState<PupVehicle>(PUP_VEHICLES[0]);
  const [gameStarted, setGameStarted] = useState(false);
  const [position, setPosition] = useState<Vec2>({ x: ROAD_CENTER_X + ROAD_RADIUS_OUTER - 50, y: ROAD_CENTER_Y });
  const [angle, setAngle] = useState(-90);
  const [speed, setSpeed] = useState(0);
  const [score, setScore] = useState(0);
  const [collectibles, setCollectibles] = useState<Collectible[]>(generateCollectibles);
  const [honking, setHonking] = useState(false);
  const [message, setMessage] = useState("");
  const keysRef = useRef<Set<string>>(new Set());
  const animRef = useRef<number | null>(null);

  const allCollected = collectibles.every((c) => c.collected);

  const startGame = (pup: PupVehicle) => {
    setSelectedPup(pup);
    setGameStarted(true);
    setPosition({ x: ROAD_CENTER_X + ROAD_RADIUS_OUTER - 50, y: ROAD_CENTER_Y });
    setAngle(-90);
    setSpeed(0);
    setScore(0);
    setCollectibles(generateCollectibles());
    setMessage(`${pup.name} is on the case!`);
  };

  const resetGame = () => {
    setGameStarted(false);
    setScore(0);
  };

  // Key handlers
  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (e.key === " ") {
        e.preventDefault();
        setHonking(true);
        setTimeout(() => setHonking(false), 300);
      }
    };
    const handleUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
    };
    window.addEventListener("keydown", handleDown);
    window.addEventListener("keyup", handleUp);
    return () => {
      window.removeEventListener("keydown", handleDown);
      window.removeEventListener("keyup", handleUp);
    };
  }, []);

  // Clear message
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(""), 2000);
      return () => clearTimeout(t);
    }
  }, [message]);

  // Game loop
  const gameLoop = useCallback(() => {
    const keys = keysRef.current;

    setAngle((prev) => {
      let a = prev;
      if (keys.has("ArrowLeft") || keys.has("a")) a -= TURN_SPEED;
      if (keys.has("ArrowRight") || keys.has("d")) a += TURN_SPEED;
      return a;
    });

    setSpeed((prev) => {
      let s = prev;
      if (keys.has("ArrowUp") || keys.has("w")) s = Math.min(s + ACCELERATION, MAX_SPEED);
      else if (keys.has("ArrowDown") || keys.has("s")) s = Math.max(s - ACCELERATION, -MAX_SPEED / 2);
      else s *= FRICTION;
      if (Math.abs(s) < 0.01) s = 0;
      return s;
    });

    setPosition((prev) => {
      setAngle((currentAngle) => {
        setSpeed((currentSpeed) => {
          const rad = (currentAngle * Math.PI) / 180;
          let newX = prev.x + Math.cos(rad) * currentSpeed;
          let newY = prev.y + Math.sin(rad) * currentSpeed;

          // Boundary clamping
          newX = Math.max(0, Math.min(CANVAS_WIDTH - CAR_SIZE, newX));
          newY = Math.max(0, Math.min(CANVAS_HEIGHT - CAR_SIZE, newY));

          // Building collision
          if (collidesWithBuilding(newX, newY) || collidesWithTower(newX, newY)) {
            setSpeed(0);
            return currentSpeed;
          }

          // Off-road slowdown
          if (!isOnRoad(newX + CAR_SIZE / 2, newY + CAR_SIZE / 2)) {
            setSpeed((s) => s * 0.92);
          }

          setPosition({ x: newX, y: newY });

          // Check collectibles
          setCollectibles((prev) => {
            let changed = false;
            const updated = prev.map((c) => {
              if (c.collected) return c;
              const dx = newX + CAR_SIZE / 2 - (c.x + COLLECTIBLE_SIZE / 2);
              const dy = newY + CAR_SIZE / 2 - (c.y + COLLECTIBLE_SIZE / 2);
              if (Math.sqrt(dx * dx + dy * dy) < (CAR_SIZE + COLLECTIBLE_SIZE) / 2) {
                changed = true;
                setScore((s) => s + c.points);
                setMessage(`+${c.points} ${c.emoji}`);
                return { ...c, collected: true };
              }
              return c;
            });
            return changed ? updated : prev;
          });

          return currentSpeed;
        });
        return currentAngle;
      });
      return prev;
    });

    animRef.current = requestAnimationFrame(gameLoop);
  }, []);

  useEffect(() => {
    if (!gameStarted) return;
    animRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [gameStarted, gameLoop]);

  // Pup selection screen
  if (!gameStarted) {
    return (
      <div className="flex flex-col items-center min-h-screen px-4 py-8 select-none">
        <h1
          className="text-4xl font-bold text-white mb-2 drop-shadow-lg"
          style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.3)" }}
        >
          🚗 Paw Patrol Driving 🚗
        </h1>
        <p className="text-xl text-white/80 mb-6">
          Choose your pup and drive around the Lookout Tower!
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-lg">
          {PUP_VEHICLES.map((pup) => (
            <button
              key={pup.name}
              onClick={() => startGame(pup)}
              className="rounded-2xl p-5 text-white font-bold shadow-xl hover:scale-110 transition-transform border-4 border-white/20 flex flex-col items-center gap-2"
              style={{ backgroundColor: pup.color }}
            >
              <span className="text-4xl">{pup.vehicleEmoji}</span>
              <span className="text-lg">{pup.name}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 text-white/70 text-sm text-center">
          Arrow keys or WASD to drive. Space to honk!
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-4 select-none">
      <div className="flex items-center gap-6 mb-2">
        <h1 className="text-2xl font-bold text-white drop-shadow-lg">
          {selectedPup.vehicleEmoji} {selectedPup.name}&apos;s Patrol
        </h1>
        <span className="text-lg font-bold text-yellow-300">Score: {score}</span>
        <span className="text-sm text-white/70">
          {collectibles.filter((c) => c.collected).length}/{collectibles.length} collected
        </span>
        <button
          onClick={resetGame}
          className="px-3 py-1 rounded-lg bg-white/20 text-white text-sm hover:bg-white/30"
        >
          Change Pup
        </button>
      </div>

      {message && (
        <div className="text-xl font-bold text-yellow-300 mb-1 animate-bounce drop-shadow-lg">
          {message}
        </div>
      )}

      {allCollected && (
        <div className="text-2xl font-bold text-green-300 mb-1 animate-pulse">
          All items collected! Great job! 🎉
        </div>
      )}

      {/* Game canvas */}
      <div
        className="relative rounded-xl border-4 border-white/30 overflow-hidden"
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          background: "#4ADE80",
        }}
      >
        {/* Grass texture */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(34,197,94,0.3) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* Road - outer circle */}
        <div
          className="absolute rounded-full"
          style={{
            left: ROAD_CENTER_X - ROAD_RADIUS_OUTER,
            top: ROAD_CENTER_Y - ROAD_RADIUS_OUTER,
            width: ROAD_RADIUS_OUTER * 2,
            height: ROAD_RADIUS_OUTER * 2,
            backgroundColor: "#6B7280",
            border: "4px solid #FCD34D",
          }}
        />
        {/* Road - inner cutout (grass) */}
        <div
          className="absolute rounded-full"
          style={{
            left: ROAD_CENTER_X - ROAD_RADIUS_INNER,
            top: ROAD_CENTER_Y - ROAD_RADIUS_INNER,
            width: ROAD_RADIUS_INNER * 2,
            height: ROAD_RADIUS_INNER * 2,
            backgroundColor: "#4ADE80",
            border: "4px solid #FCD34D",
          }}
        />

        {/* Road dashes */}
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i * Math.PI * 2) / 24;
          const r = (ROAD_RADIUS_INNER + ROAD_RADIUS_OUTER) / 2;
          return (
            <div
              key={`dash-${i}`}
              className="absolute bg-white/60 rounded"
              style={{
                left: ROAD_CENTER_X + Math.cos(a) * r - 6,
                top: ROAD_CENTER_Y + Math.sin(a) * r - 3,
                width: 12,
                height: 6,
                transform: `rotate(${(a * 180) / Math.PI + 90}deg)`,
              }}
            />
          );
        })}

        {/* Lookout Tower */}
        <div
          className="absolute flex flex-col items-center justify-center rounded-lg border-4"
          style={{
            left: TOWER_X,
            top: TOWER_Y,
            width: TOWER_SIZE,
            height: TOWER_SIZE,
            backgroundColor: "#60A5FA",
            borderColor: "#2563EB",
            boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
          }}
        >
          <div className="text-2xl">🏰</div>
          <div className="text-white text-xs font-bold leading-tight text-center">
            Lookout
          </div>
        </div>

        {/* Buildings */}
        {BUILDINGS.map((b, i) => (
          <div
            key={`bldg-${i}`}
            className="absolute rounded-lg border-3 flex flex-col items-center justify-center"
            style={{
              left: b.x,
              top: b.y,
              width: b.w,
              height: b.h,
              backgroundColor: b.color,
              border: `3px solid rgba(0,0,0,0.3)`,
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            }}
          >
            <div className="text-lg">🏠</div>
            <div className="text-white text-[9px] font-bold text-center leading-tight px-1">
              {b.label}
            </div>
          </div>
        ))}

        {/* Collectibles */}
        {collectibles
          .filter((c) => !c.collected)
          .map((c) => (
            <div
              key={`col-${c.id}`}
              className="absolute animate-pulse"
              style={{
                left: c.x,
                top: c.y,
                width: COLLECTIBLE_SIZE,
                height: COLLECTIBLE_SIZE,
                fontSize: 22,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                filter: "drop-shadow(0 0 4px rgba(255,255,0,0.6))",
              }}
            >
              {c.emoji}
            </div>
          ))}

        {/* Car */}
        <div
          className="absolute"
          style={{
            left: position.x,
            top: position.y,
            width: CAR_SIZE,
            height: CAR_SIZE,
            transform: `rotate(${angle + 90}deg)`,
            transition: "transform 0.05s linear",
            fontSize: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.4))`,
          }}
        >
          {selectedPup.vehicleEmoji}
        </div>

        {/* Honk effect */}
        {honking && (
          <div
            className="absolute text-2xl font-bold text-yellow-300 animate-ping pointer-events-none"
            style={{
              left: position.x - 10,
              top: position.y - 25,
              textShadow: "0 0 8px rgba(255,255,0,0.8)",
            }}
          >
            BEEP!
          </div>
        )}
      </div>

      <div className="mt-3 text-white/70 text-sm text-center">
        Arrow keys / WASD to drive. Space to honk! Collect all the items!
      </div>
    </div>
  );
}
