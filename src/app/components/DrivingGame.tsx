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
  color: string;
  darkColor: string;
  vehicleName: string;
}

const PUP_VEHICLES: PupVehicle[] = [
  { name: "Chase", color: "#3B82F6", darkColor: "#1D4ED8", vehicleName: "Police Cruiser" },
  { name: "Marshall", color: "#EF4444", darkColor: "#B91C1C", vehicleName: "Fire Truck" },
  { name: "Skye", color: "#EC4899", darkColor: "#BE185D", vehicleName: "Helicopter" },
  { name: "Rubble", color: "#F59E0B", darkColor: "#B45309", vehicleName: "Bulldozer" },
  { name: "Rocky", color: "#10B981", darkColor: "#047857", vehicleName: "Recycling Truck" },
  { name: "Zuma", color: "#F97316", darkColor: "#C2410C", vehicleName: "Hovercraft" },
];

interface LocationZone {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  label: string;
  emoji: string;
  interactionMessage: string;
  interactionEmoji: string;
  reward: number;
}

const CANVAS_WIDTH = 700;
const CANVAS_HEIGHT = 500;
const CAR_WIDTH = 24;
const CAR_HEIGHT = 40;
const TURN_SPEED = 4;
const ACCELERATION = 0.15;
const FRICTION = 0.97;
const MAX_SPEED = 5;
const COLLECTIBLE_SIZE = 28;

const TOWER_X = 310;
const TOWER_Y = 210;
const TOWER_SIZE = 80;

const ROAD_CENTER_X = 350;
const ROAD_CENTER_Y = 250;
const ROAD_RADIUS_OUTER = 200;
const ROAD_RADIUS_INNER = 140;

const LOCATIONS: LocationZone[] = [
  {
    id: "lookout",
    x: TOWER_X,
    y: TOWER_Y,
    w: TOWER_SIZE,
    h: TOWER_SIZE,
    color: "#60A5FA",
    label: "Lookout Tower",
    emoji: "🏰",
    interactionMessage: "Ryder says: Great job pup! Keep patrolling!",
    interactionEmoji: "📡",
    reward: 50,
  },
  {
    id: "katies",
    x: 50,
    y: 50,
    w: 80,
    h: 60,
    color: "#8B5CF6",
    label: "Katie's Pet Parlor",
    emoji: "🐱",
    interactionMessage: "Katie: Thanks for visiting! Here's a treat for your pup!",
    interactionEmoji: "🧁",
    reward: 30,
  },
  {
    id: "townhall",
    x: 560,
    y: 50,
    w: 90,
    h: 60,
    color: "#06B6D4",
    label: "Town Hall",
    emoji: "🏛️",
    interactionMessage: "Mayor Goodway: Adventure Bay thanks you!",
    interactionEmoji: "🐔",
    reward: 30,
  },
  {
    id: "porters",
    x: 50,
    y: 380,
    w: 80,
    h: 70,
    color: "#F59E0B",
    label: "Mr. Porter's",
    emoji: "🍕",
    interactionMessage: "Mr. Porter: Here's a snack for a hard-working pup!",
    interactionEmoji: "🍪",
    reward: 30,
  },
  {
    id: "farmers",
    x: 560,
    y: 370,
    w: 90,
    h: 70,
    color: "#10B981",
    label: "Farmer Al's",
    emoji: "🌾",
    interactionMessage: "Farmer Al: The animals are safe, thanks to you!",
    interactionEmoji: "🐄",
    reward: 30,
  },
];

const INTERACTION_RANGE = 50;

function generateCollectibles(): Collectible[] {
  const items: Collectible[] = [];
  const types: Array<{ type: Collectible["type"]; emoji: string; points: number }> = [
    { type: "bone", emoji: "🦴", points: 10 },
    { type: "badge", emoji: "⭐", points: 25 },
    { type: "treat", emoji: "🍖", points: 15 },
  ];

  let id = 0;
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

function collidesWithSolid(x: number, y: number): boolean {
  return LOCATIONS.some(
    (loc) =>
      x + CAR_WIDTH > loc.x &&
      x < loc.x + loc.w &&
      y + CAR_HEIGHT > loc.y &&
      y < loc.y + loc.h
  );
}

function nearLocation(x: number, y: number): LocationZone | null {
  for (const loc of LOCATIONS) {
    const cx = loc.x + loc.w / 2;
    const cy = loc.y + loc.h / 2;
    const px = x + CAR_WIDTH / 2;
    const py = y + CAR_HEIGHT / 2;
    const dx = px - cx;
    const dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const range = Math.max(loc.w, loc.h) / 2 + INTERACTION_RANGE;
    if (dist < range) return loc;
  }
  return null;
}

// Top-down car SVG component
function TopDownCar({ color, darkColor }: { color: string; darkColor: string }) {
  return (
    <svg width={CAR_WIDTH} height={CAR_HEIGHT} viewBox="0 0 24 40">
      {/* Car body */}
      <rect x="2" y="6" width="20" height="28" rx="4" fill={color} stroke={darkColor} strokeWidth="1.5" />
      {/* Windshield */}
      <rect x="5" y="8" width="14" height="7" rx="2" fill={darkColor} opacity="0.6" />
      {/* Rear window */}
      <rect x="5" y="27" width="14" height="5" rx="2" fill={darkColor} opacity="0.6" />
      {/* Front wheels */}
      <rect x="0" y="10" width="4" height="8" rx="2" fill="#1F2937" />
      <rect x="20" y="10" width="4" height="8" rx="2" fill="#1F2937" />
      {/* Rear wheels */}
      <rect x="0" y="24" width="4" height="8" rx="2" fill="#1F2937" />
      <rect x="20" y="24" width="4" height="8" rx="2" fill="#1F2937" />
      {/* Roof light / detail */}
      <circle cx="12" cy="15" r="2.5" fill="white" opacity="0.8" />
      <circle cx="12" cy="15" r="1.5" fill="#FCD34D" />
    </svg>
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
  const [interactionBubble, setInteractionBubble] = useState<{ text: string; emoji: string; locId: string } | null>(null);
  const [visitedLocations, setVisitedLocations] = useState<Set<string>>(new Set());
  const [finished, setFinished] = useState(false);
  const [nearbyLocation, setNearbyLocation] = useState<LocationZone | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const animRef = useRef<number | null>(null);
  const posRef = useRef(position);
  const angleRef = useRef(angle);
  const speedRef = useRef(speed);

  posRef.current = position;
  angleRef.current = angle;
  speedRef.current = speed;

  const allCollected = collectibles.every((c) => c.collected);
  const allVisited = LOCATIONS.every((loc) => visitedLocations.has(loc.id));
  const missionComplete = allCollected && allVisited;

  // Trigger finish
  useEffect(() => {
    if (missionComplete && !finished) {
      setFinished(true);
      setMessage("");
    }
  }, [missionComplete, finished]);

  const startGame = (pup: PupVehicle) => {
    setSelectedPup(pup);
    setGameStarted(true);
    setPosition({ x: ROAD_CENTER_X + ROAD_RADIUS_OUTER - 50, y: ROAD_CENTER_Y });
    setAngle(-90);
    setSpeed(0);
    setScore(0);
    setCollectibles(generateCollectibles());
    setVisitedLocations(new Set());
    setFinished(false);
    setInteractionBubble(null);
    setMessage(`${pup.name} is on the case!`);
  };

  const resetGame = () => {
    setGameStarted(false);
    setScore(0);
    setFinished(false);
  };

  // Key handlers
  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (e.key === " ") {
        e.preventDefault();
        // Honk or interact
        const nearby = nearLocation(posRef.current.x, posRef.current.y);
        if (nearby) {
          setVisitedLocations((prev) => {
            const next = new Set(prev);
            if (!next.has(nearby.id)) {
              next.add(nearby.id);
              setScore((s) => s + nearby.reward);
            }
            return next;
          });
          setInteractionBubble({
            text: nearby.interactionMessage,
            emoji: nearby.interactionEmoji,
            locId: nearby.id,
          });
          setTimeout(() => setInteractionBubble(null), 3000);
        } else {
          setHonking(true);
          setTimeout(() => setHonking(false), 300);
        }
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

    let newAngle = angleRef.current;
    if (keys.has("ArrowLeft") || keys.has("a")) newAngle -= TURN_SPEED;
    if (keys.has("ArrowRight") || keys.has("d")) newAngle += TURN_SPEED;
    angleRef.current = newAngle;
    setAngle(newAngle);

    let newSpeed = speedRef.current;
    if (keys.has("ArrowUp") || keys.has("w")) newSpeed = Math.min(newSpeed + ACCELERATION, MAX_SPEED);
    else if (keys.has("ArrowDown") || keys.has("s")) newSpeed = Math.max(newSpeed - ACCELERATION, -MAX_SPEED / 2);
    else newSpeed *= FRICTION;
    if (Math.abs(newSpeed) < 0.01) newSpeed = 0;

    const rad = (newAngle * Math.PI) / 180;
    let newX = posRef.current.x + Math.cos(rad) * newSpeed;
    let newY = posRef.current.y + Math.sin(rad) * newSpeed;

    // Boundary clamping
    newX = Math.max(0, Math.min(CANVAS_WIDTH - CAR_WIDTH, newX));
    newY = Math.max(0, Math.min(CANVAS_HEIGHT - CAR_HEIGHT, newY));

    // Building collision
    if (collidesWithSolid(newX, newY)) {
      newSpeed = 0;
      newX = posRef.current.x;
      newY = posRef.current.y;
    }

    // Off-road slowdown
    if (!isOnRoad(newX + CAR_WIDTH / 2, newY + CAR_HEIGHT / 2)) {
      newSpeed *= 0.92;
    }

    speedRef.current = newSpeed;
    setSpeed(newSpeed);
    posRef.current = { x: newX, y: newY };
    setPosition({ x: newX, y: newY });

    // Check nearby location for prompt
    const nearby = nearLocation(newX, newY);
    setNearbyLocation(nearby);

    // Check collectibles
    setCollectibles((prev) => {
      let changed = false;
      const updated = prev.map((c) => {
        if (c.collected) return c;
        const dx = newX + CAR_WIDTH / 2 - (c.x + COLLECTIBLE_SIZE / 2);
        const dy = newY + CAR_HEIGHT / 2 - (c.y + COLLECTIBLE_SIZE / 2);
        if (Math.sqrt(dx * dx + dy * dy) < (CAR_WIDTH + COLLECTIBLE_SIZE) / 2) {
          changed = true;
          setScore((s) => s + c.points);
          setMessage(`+${c.points} ${c.emoji}`);
          return { ...c, collected: true };
        }
        return c;
      });
      return changed ? updated : prev;
    });

    animRef.current = requestAnimationFrame(gameLoop);
  }, []);

  useEffect(() => {
    if (!gameStarted || finished) return;
    animRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [gameStarted, finished, gameLoop]);

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
          Choose your pup and patrol Adventure Bay!
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-lg">
          {PUP_VEHICLES.map((pup) => (
            <button
              key={pup.name}
              onClick={() => startGame(pup)}
              className="rounded-2xl p-5 text-white font-bold shadow-xl hover:scale-110 transition-transform border-4 border-white/20 flex flex-col items-center gap-2"
              style={{ backgroundColor: pup.color }}
            >
              <div className="transform scale-150 mb-1">
                <TopDownCar color={pup.color} darkColor={pup.darkColor} />
              </div>
              <span className="text-lg">{pup.name}</span>
              <span className="text-xs opacity-80">{pup.vehicleName}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 text-white/70 text-sm text-center max-w-md">
          <p>Arrow keys or WASD to drive.</p>
          <p>Press Space near buildings to interact!</p>
          <p>Collect all items and visit every location to complete your patrol!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-4 select-none">
      <div className="flex items-center gap-4 mb-2 flex-wrap justify-center">
        <h1 className="text-2xl font-bold text-white drop-shadow-lg">
          {selectedPup.name}&apos;s Patrol
        </h1>
        <span className="text-lg font-bold text-yellow-300">Score: {score}</span>
        <span className="text-sm text-white/70">
          Items: {collectibles.filter((c) => c.collected).length}/{collectibles.length}
        </span>
        <span className="text-sm text-white/70">
          Visited: {visitedLocations.size}/{LOCATIONS.length}
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

      {nearbyLocation && !interactionBubble && !finished && (
        <div className="text-sm font-semibold text-white bg-black/40 px-3 py-1 rounded-full mb-1">
          Press Space to talk to {nearbyLocation.label}! {nearbyLocation.emoji}
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

        {/* Locations / Buildings */}
        {LOCATIONS.map((loc) => {
          const visited = visitedLocations.has(loc.id);
          return (
            <div
              key={loc.id}
              className={`absolute rounded-lg flex flex-col items-center justify-center transition-all ${
                visited ? "ring-4 ring-green-400" : ""
              }`}
              style={{
                left: loc.x,
                top: loc.y,
                width: loc.w,
                height: loc.h,
                backgroundColor: loc.color,
                border: `3px solid rgba(0,0,0,0.3)`,
                boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              }}
            >
              <div className="text-xl">{loc.emoji}</div>
              <div className="text-white text-[9px] font-bold text-center leading-tight px-1">
                {loc.label}
              </div>
              {visited && (
                <div className="text-xs mt-0.5">✅</div>
              )}
            </div>
          );
        })}

        {/* Interaction bubble */}
        {interactionBubble && (() => {
          const loc = LOCATIONS.find((l) => l.id === interactionBubble.locId);
          if (!loc) return null;
          return (
            <div
              className="absolute bg-white rounded-xl px-3 py-2 shadow-lg border-2 border-yellow-400 z-30 max-w-[200px] animate-bounce"
              style={{
                left: Math.min(loc.x + loc.w / 2 - 100, CANVAS_WIDTH - 210),
                top: Math.max(loc.y - 60, 5),
              }}
            >
              <div className="text-sm font-bold text-gray-800">
                {interactionBubble.emoji} {interactionBubble.text}
              </div>
            </div>
          );
        })()}

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

        {/* Top-down car */}
        <div
          className="absolute z-20"
          style={{
            left: position.x,
            top: position.y,
            width: CAR_WIDTH,
            height: CAR_HEIGHT,
            transform: `rotate(${angle + 90}deg)`,
            transformOrigin: "center center",
            filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.4))",
          }}
        >
          <TopDownCar color={selectedPup.color} darkColor={selectedPup.darkColor} />
        </div>

        {/* Honk effect */}
        {honking && (
          <div
            className="absolute text-2xl font-bold text-yellow-300 animate-ping pointer-events-none z-30"
            style={{
              left: position.x - 10,
              top: position.y - 25,
              textShadow: "0 0 8px rgba(255,255,0,0.8)",
            }}
          >
            BEEP!
          </div>
        )}

        {/* Finish overlay */}
        {finished && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-40">
            <div className="text-6xl mb-4 animate-bounce">🏆</div>
            <div className="text-4xl font-bold text-yellow-300 mb-2" style={{ textShadow: "0 0 20px rgba(255,255,0,0.5)" }}>
              Patrol Complete!
            </div>
            <div className="text-2xl text-white mb-1">
              Final Score: {score}
            </div>
            <div className="text-lg text-white/80 mb-4">
              {selectedPup.name} visited all locations and collected everything!
            </div>
            <div className="flex gap-3 text-3xl mb-4">
              {LOCATIONS.map((loc) => (
                <span key={loc.id} title={loc.label}>{loc.emoji}</span>
              ))}
            </div>
            <div className="text-white text-lg mb-2">
              No job is too big, no pup is too small! 🐾
            </div>
            <button
              onClick={() => startGame(selectedPup)}
              className="bg-green-500 text-white px-6 py-3 rounded-full text-xl font-bold hover:bg-green-600 transition-colors mt-2"
            >
              Patrol Again!
            </button>
            <button
              onClick={resetGame}
              className="text-white/70 text-sm mt-3 hover:text-white"
            >
              Choose a different pup
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 text-white/70 text-sm text-center">
        Arrow keys / WASD to drive. Press Space near buildings to interact!
      </div>
    </div>
  );
}
