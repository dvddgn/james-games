"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ── Sound helpers ─────────────────────────────────────────────────
function playTone(freq: number, duration: number, type: OscillatorType = "sine", vol = 0.15) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

function playCollectSound() {
  playTone(880, 0.1, "sine", 0.12);
  setTimeout(() => playTone(1100, 0.15, "sine", 0.1), 80);
}

function playHornSound() {
  playTone(200, 0.25, "sawtooth", 0.08);
  setTimeout(() => playTone(250, 0.3, "sawtooth", 0.08), 150);
}

function playRefuelSound() {
  playTone(300, 0.1, "sine", 0.1);
  setTimeout(() => playTone(400, 0.1, "sine", 0.1), 100);
  setTimeout(() => playTone(500, 0.15, "sine", 0.1), 200);
}

function playVictorySound() {
  [523, 659, 784, 1047].forEach((f, i) =>
    setTimeout(() => playTone(f, 0.3, "sine", 0.12), i * 150)
  );
}

function speak(text: string) {
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.pitch = 1.2;
    utter.volume = 0.9;
    window.speechSynthesis.speak(utter);
  } catch {}
}

// ── Types ──────────────────────────────────────────────────────────
interface Vec2 { x: number; y: number }

interface Collectible {
  id: number; x: number; y: number;
  type: "fish" | "starfish" | "shell";
  emoji: string; points: number; collected: boolean;
}

interface PupBoat {
  name: string; color: string; darkColor: string;
  accentColor: string; number: number;
}

interface LocationZone {
  id: string; x: number; y: number; w: number; h: number;
  color: string; label: string; emoji: string;
  interactionMessage: string; interactionEmoji: string; reward: number;
}

interface WaterwayDef {
  id: string; name: string; emoji: string;
  description: string;
  isOnChannel: (x: number, y: number) => boolean;
  renderChannel: () => React.ReactNode;
  renderBuoys: () => React.ReactNode;
  startPos: Vec2; startAngle: number;
  collectiblePoints: Vec2[];
  locations: LocationZone[];
  fuelDock: { x: number; y: number; w: number; h: number };
}

// ── Constants ──────────────────────────────────────────────────────
const CW = 700, CH = 500;
const BOAT_W = 28, BOAT_H = 48;
const TURN_SPEED = 3, ACCEL = 0.12, FRICTION = 0.985, MAX_SPD = 4.5;
const COLL_SIZE = 28;
const MAX_FUEL = 100, FUEL_DRAIN = 0.03, FUEL_REFILL = 60;
const INTERACT_RANGE = 50, DOCK_RANGE = 55;
const CHANNEL_HALF = 30;

// ── Pup boats ────────────────────────────────────────────────────
const PUPS: PupBoat[] = [
  { name: "Chase",    color: "#3B82F6", darkColor: "#1D4ED8", accentColor: "#FCD34D", number: 1 },
  { name: "Marshall", color: "#EF4444", darkColor: "#B91C1C", accentColor: "#FBBF24", number: 2 },
  { name: "Skye",     color: "#EC4899", darkColor: "#BE185D", accentColor: "#F9A8D4", number: 3 },
  { name: "Rubble",   color: "#F59E0B", darkColor: "#B45309", accentColor: "#FEF3C7", number: 4 },
  { name: "Rocky",    color: "#10B981", darkColor: "#047857", accentColor: "#A7F3D0", number: 5 },
  { name: "Zuma",     color: "#F97316", darkColor: "#C2410C", accentColor: "#FED7AA", number: 6 },
];

// ── Boat SVG ─────────────────────────────────────────────────────
function Boat({ color, darkColor, accent, num }: {
  color: string; darkColor: string; accent: string; num: number;
}) {
  return (
    <svg width={BOAT_W} height={BOAT_H} viewBox="0 0 28 48">
      {/* Shadow / wake */}
      <ellipse cx="14" cy="45" rx="11" ry="3" fill="rgba(0,0,0,0.12)" />
      {/* Hull */}
      <path d="M4 42 L2 28 L4 10 Q14 2 24 10 L26 28 L24 42 Q14 46 4 42Z"
        fill={color} stroke={darkColor} strokeWidth="1.2" />
      {/* Bow point */}
      <path d="M8 10 Q14 0 20 10" fill={darkColor} opacity="0.6" />
      {/* Deck stripe */}
      <rect x="12" y="8" width="4" height="30" rx="2" fill={accent} opacity="0.5" />
      {/* Cabin / wheelhouse */}
      <rect x="8" y="16" width="12" height="10" rx="3" fill={darkColor} opacity="0.6" />
      {/* Cabin window */}
      <rect x="10" y="18" width="8" height="4" rx="1.5" fill="white" opacity="0.5" />
      {/* Number on deck */}
      <circle cx="14" cy="34" r="4" fill="white" opacity="0.9" />
      <text x="14" y="37" textAnchor="middle" fontSize="7" fontWeight="bold" fill={darkColor}>
        {num}
      </text>
      {/* Flag at stern */}
      <line x1="14" y1="40" x2="14" y2="44" stroke={darkColor} strokeWidth="1" />
      <polygon points="14,40 20,42 14,44" fill={accent} opacity="0.9" />
      {/* Port & starboard lights */}
      <circle cx="5" cy="15" r="1.5" fill="#EF4444" opacity="0.8" />
      <circle cx="23" cy="15" r="1.5" fill="#22C55E" opacity="0.8" />
    </svg>
  );
}

// ── Water location definitions ───────────────────────────────────
const SHARED_LOCATIONS: Omit<LocationZone, "x" | "y">[] = [
  { id: "sealIsland", w: 80, h: 80, color: "#A3A3A3", label: "Seal Island", emoji: "🦭",
    interactionMessage: "The seals say: Arf arf!", interactionEmoji: "🦭", reward: 50 },
  { id: "lighthouse", w: 70, h: 55, color: "#FBBF24", label: "Lighthouse", emoji: "🗼",
    interactionMessage: "Cap'n Turbot: The light is shining bright!", interactionEmoji: "💡", reward: 30 },
  { id: "beach", w: 75, h: 55, color: "#FDE68A", label: "The Beach", emoji: "🏖️",
    interactionMessage: "Chickaletta is sunbathing! Bawk bawk!", interactionEmoji: "🐔", reward: 30 },
  { id: "dock", w: 70, h: 55, color: "#92400E", label: "The Dock", emoji: "⚓",
    interactionMessage: "Ryder says: Great sailing, captain!", interactionEmoji: "🎖️", reward: 30 },
  { id: "bridge", w: 75, h: 55, color: "#6B7280", label: "The Bridge", emoji: "🌉",
    interactionMessage: "Mayor Goodway: Safe passage!", interactionEmoji: "🐔", reward: 30 },
];

function makeLocations(positions: Vec2[]): LocationZone[] {
  return SHARED_LOCATIONS.map((loc, i) => ({ ...loc, x: positions[i].x, y: positions[i].y }));
}

// ── Channel geometry helpers ─────────────────────────────────────
function circleChannelCheck(cx: number, cy: number, rInner: number, rOuter: number) {
  return (x: number, y: number) => {
    const d = Math.hypot(x - cx, y - cy);
    return d >= rInner - 15 && d <= rOuter + 15;
  };
}

function ovalChannelCheck(cx: number, cy: number, rxI: number, ryI: number, rxO: number, ryO: number) {
  return (x: number, y: number) => {
    const dx = x - cx, dy = y - cy;
    const dOuter = (dx * dx) / (rxO * rxO) + (dy * dy) / (ryO * ryO);
    const dInner = (dx * dx) / (rxI * rxI) + (dy * dy) / (ryI * ryI);
    return dOuter <= 1.15 && dInner >= 0.85;
  };
}

function twinCovesChannelCheck(cx1: number, cy1: number, cx2: number, cy2: number, rI: number, rO: number) {
  return (x: number, y: number) => {
    const d1 = Math.hypot(x - cx1, y - cy1);
    const d2 = Math.hypot(x - cx2, y - cy2);
    const on1 = d1 >= rI - 15 && d1 <= rO + 15;
    const on2 = d2 >= rI - 15 && d2 <= rO + 15;
    return on1 || on2;
  };
}

// ── Harbor Loop (circle) ─────────────────────────────────────────
const HARBOR_CX = 350, HARBOR_CY = 250, HARBOR_RI = 140, HARBOR_RO = 200;
const harborLoop: WaterwayDef = {
  id: "harbor", name: "Harbor Loop", emoji: "🏝️",
  description: "Circle around Seal Island!",
  isOnChannel: circleChannelCheck(HARBOR_CX, HARBOR_CY, HARBOR_RI, HARBOR_RO),
  startPos: { x: HARBOR_CX + HARBOR_RO - 40, y: HARBOR_CY },
  startAngle: -90,
  fuelDock: { x: 540, y: 230, w: 60, h: 50 },
  locations: makeLocations([
    { x: 310, y: 210 }, { x: 50, y: 50 }, { x: 560, y: 50 },
    { x: 50, y: 380 }, { x: 560, y: 370 },
  ]),
  collectiblePoints: Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI * 2) / 12;
    const r = (HARBOR_RI + HARBOR_RO) / 2;
    return { x: HARBOR_CX + Math.cos(a) * r, y: HARBOR_CY + Math.sin(a) * r };
  }),
  renderChannel: () => (
    <>
      <div className="absolute rounded-full" style={{
        left: HARBOR_CX - HARBOR_RO, top: HARBOR_CY - HARBOR_RO,
        width: HARBOR_RO * 2, height: HARBOR_RO * 2,
        backgroundColor: "#1E40AF", border: "4px solid #FBBF24",
      }} />
      <div className="absolute rounded-full" style={{
        left: HARBOR_CX - HARBOR_RI, top: HARBOR_CY - HARBOR_RI,
        width: HARBOR_RI * 2, height: HARBOR_RI * 2,
        backgroundColor: "#38BDF8", border: "4px solid #FBBF24",
      }} />
    </>
  ),
  renderBuoys: () => (
    <>
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i * Math.PI * 2) / 24;
        const r = (HARBOR_RI + HARBOR_RO) / 2;
        return (
          <div key={`b${i}`} className="absolute rounded-full" style={{
            left: HARBOR_CX + Math.cos(a) * r - 4, top: HARBOR_CY + Math.sin(a) * r - 4,
            width: 8, height: 8, backgroundColor: "#FBBF24",
            boxShadow: "0 0 4px rgba(251,191,36,0.6)",
          }} />
        );
      })}
    </>
  ),
};

// ── Bay Crossing (oval) ──────────────────────────────────────────
const BAY_CX = 350, BAY_CY = 250;
const BAY_RXO = 300, BAY_RYO = 190, BAY_RXI = 240, BAY_RYI = 130;
const bayCrossing: WaterwayDef = {
  id: "bay", name: "Bay Crossing", emoji: "🌊",
  description: "A wide bay — ride the waves!",
  isOnChannel: ovalChannelCheck(BAY_CX, BAY_CY, BAY_RXI, BAY_RYI, BAY_RXO, BAY_RYO),
  startPos: { x: BAY_CX + BAY_RXO - 40, y: BAY_CY },
  startAngle: -90,
  fuelDock: { x: 345, y: 10, w: 60, h: 45 },
  locations: makeLocations([
    { x: 310, y: 210 }, { x: 15, y: 15 }, { x: 590, y: 15 },
    { x: 15, y: 420 }, { x: 590, y: 420 },
  ]),
  collectiblePoints: Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI * 2) / 12;
    const rx = (BAY_RXI + BAY_RXO) / 2;
    const ry = (BAY_RYI + BAY_RYO) / 2;
    return { x: BAY_CX + Math.cos(a) * rx, y: BAY_CY + Math.sin(a) * ry };
  }),
  renderChannel: () => (
    <>
      <div className="absolute" style={{
        left: BAY_CX - BAY_RXO, top: BAY_CY - BAY_RYO,
        width: BAY_RXO * 2, height: BAY_RYO * 2,
        backgroundColor: "#1E40AF", borderRadius: "50%", border: "4px solid #FBBF24",
      }} />
      <div className="absolute" style={{
        left: BAY_CX - BAY_RXI, top: BAY_CY - BAY_RYI,
        width: BAY_RXI * 2, height: BAY_RYI * 2,
        backgroundColor: "#38BDF8", borderRadius: "50%", border: "4px solid #FBBF24",
      }} />
    </>
  ),
  renderBuoys: () => (
    <>
      {Array.from({ length: 30 }, (_, i) => {
        const a = (i * Math.PI * 2) / 30;
        const rx = (BAY_RXI + BAY_RXO) / 2;
        const ry = (BAY_RYI + BAY_RYO) / 2;
        return (
          <div key={`b${i}`} className="absolute rounded-full" style={{
            left: BAY_CX + Math.cos(a) * rx - 4, top: BAY_CY + Math.sin(a) * ry - 4,
            width: 8, height: 8, backgroundColor: "#FBBF24",
            boxShadow: "0 0 4px rgba(251,191,36,0.6)",
          }} />
        );
      })}
    </>
  ),
};

// ── Twin Coves (figure-8) ────────────────────────────────────────
const TC_CX1 = 220, TC_CY1 = 250, TC_CX2 = 480, TC_CY2 = 250;
const TC_RI = 100, TC_RO = 160;
const twinCoves: WaterwayDef = {
  id: "twincoves", name: "Twin Coves", emoji: "🐚",
  description: "Two connected coves — watch the crossing!",
  isOnChannel: twinCovesChannelCheck(TC_CX1, TC_CY1, TC_CX2, TC_CY2, TC_RI, TC_RO),
  startPos: { x: TC_CX1 + TC_RO - 30, y: TC_CY1 },
  startAngle: -90,
  fuelDock: { x: 320, y: 10, w: 60, h: 45 },
  locations: makeLocations([
    { x: 180, y: 215 }, { x: 10, y: 15 }, { x: 590, y: 15 },
    { x: 10, y: 420 }, { x: 590, y: 420 },
  ]),
  collectiblePoints: [
    ...Array.from({ length: 6 }, (_, i) => {
      const a = (i * Math.PI * 2) / 6;
      const r = (TC_RI + TC_RO) / 2;
      return { x: TC_CX1 + Math.cos(a) * r, y: TC_CY1 + Math.sin(a) * r };
    }),
    ...Array.from({ length: 6 }, (_, i) => {
      const a = (i * Math.PI * 2) / 6;
      const r = (TC_RI + TC_RO) / 2;
      return { x: TC_CX2 + Math.cos(a) * r, y: TC_CY2 + Math.sin(a) * r };
    }),
  ],
  renderChannel: () => (
    <>
      {/* Left cove */}
      <div className="absolute rounded-full" style={{
        left: TC_CX1 - TC_RO, top: TC_CY1 - TC_RO,
        width: TC_RO * 2, height: TC_RO * 2,
        backgroundColor: "#1E40AF", border: "4px solid #FBBF24",
      }} />
      {/* Right cove */}
      <div className="absolute rounded-full" style={{
        left: TC_CX2 - TC_RO, top: TC_CY2 - TC_RO,
        width: TC_RO * 2, height: TC_RO * 2,
        backgroundColor: "#1E40AF", border: "4px solid #FBBF24",
      }} />
      {/* Left island */}
      <div className="absolute rounded-full" style={{
        left: TC_CX1 - TC_RI, top: TC_CY1 - TC_RI,
        width: TC_RI * 2, height: TC_RI * 2,
        backgroundColor: "#38BDF8", border: "4px solid #FBBF24",
      }} />
      {/* Right island */}
      <div className="absolute rounded-full" style={{
        left: TC_CX2 - TC_RI, top: TC_CY2 - TC_RI,
        width: TC_RI * 2, height: TC_RI * 2,
        backgroundColor: "#38BDF8", border: "4px solid #FBBF24",
      }} />
    </>
  ),
  renderBuoys: () => (
    <>
      {[TC_CX1, TC_CX2].map((cx, li) =>
        Array.from({ length: 16 }, (_, i) => {
          const a = (i * Math.PI * 2) / 16;
          const r = (TC_RI + TC_RO) / 2;
          return (
            <div key={`b${li}-${i}`} className="absolute rounded-full" style={{
              left: cx + Math.cos(a) * r - 4, top: TC_CY1 + Math.sin(a) * r - 4,
              width: 8, height: 8, backgroundColor: "#FBBF24",
              boxShadow: "0 0 4px rgba(251,191,36,0.6)",
            }} />
          );
        })
      )}
    </>
  ),
};

// ── River Run (waypoint-based) ───────────────────────────────────
const RR_POINTS: Vec2[] = [
  { x: 120, y: 70 },
  { x: 580, y: 70 },
  { x: 630, y: 120 },
  { x: 630, y: 200 },
  { x: 480, y: 250 },
  { x: 630, y: 300 },
  { x: 630, y: 400 },
  { x: 580, y: 440 },
  { x: 350, y: 440 },
  { x: 280, y: 380 },
  { x: 200, y: 440 },
  { x: 120, y: 440 },
  { x: 70, y: 400 },
  { x: 70, y: 120 },
  { x: 120, y: 70 },
];

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function rrChannelCheck(x: number, y: number): boolean {
  for (let i = 0; i < RR_POINTS.length - 1; i++) {
    const a = RR_POINTS[i], b = RR_POINTS[i + 1];
    if (distToSegment(x, y, a.x, a.y, b.x, b.y) < CHANNEL_HALF + 15) return true;
  }
  return false;
}

function rrCollectiblePoints(): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i < RR_POINTS.length - 1; i++) {
    const a = RR_POINTS[i], b = RR_POINTS[i + 1];
    pts.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }
  return pts;
}

function rrSvgPath(): string {
  return RR_POINTS.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ");
}

const riverRun: WaterwayDef = {
  id: "river", name: "River Run", emoji: "🏞️",
  description: "Winding river with twists & turns!",
  isOnChannel: rrChannelCheck,
  startPos: { x: 130, y: 50 },
  startAngle: 0,
  fuelDock: { x: 350, y: 150, w: 55, h: 45 },
  locations: makeLocations([
    { x: 250, y: 150 }, { x: 10, y: 10 }, { x: 480, y: 150 },
    { x: 130, y: 340 }, { x: 440, y: 340 },
  ]),
  collectiblePoints: rrCollectiblePoints(),
  renderChannel: () => (
    <svg className="absolute inset-0" width={CW} height={CH} style={{ pointerEvents: "none" }}>
      {/* Channel edges */}
      <path d={rrSvgPath()} fill="none" stroke="#FBBF24" strokeWidth={CHANNEL_HALF * 2 + 6}
        strokeLinejoin="round" strokeLinecap="round" opacity="0.5" />
      {/* Channel water */}
      <path d={rrSvgPath()} fill="none" stroke="#1E40AF" strokeWidth={CHANNEL_HALF * 2}
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  ),
  renderBuoys: () => (
    <svg className="absolute inset-0" width={CW} height={CH} style={{ pointerEvents: "none" }}>
      <path d={rrSvgPath()} fill="none" stroke="#FBBF24" strokeWidth={3}
        strokeLinejoin="round" strokeLinecap="round"
        strokeDasharray="4 20" opacity="0.7" />
    </svg>
  ),
};

const ALL_WATERWAYS: WaterwayDef[] = [harborLoop, bayCrossing, twinCoves, riverRun];

// ── Helpers ───────────────────────────────────────────────────────
function generateCollectibles(points: Vec2[]): Collectible[] {
  const types = [
    { type: "fish" as const, emoji: "🐟", points: 10 },
    { type: "starfish" as const, emoji: "⭐", points: 25 },
    { type: "shell" as const, emoji: "🐚", points: 15 },
  ];
  return points.map((p, i) => ({
    id: i, x: p.x - COLL_SIZE / 2, y: p.y - COLL_SIZE / 2,
    ...types[i % types.length], collected: false,
  }));
}

function collidesWithRect(x: number, y: number, r: { x: number; y: number; w: number; h: number }) {
  return x + BOAT_W > r.x && x < r.x + r.w && y + BOAT_H > r.y && y < r.y + r.h;
}

function nearRect(px: number, py: number, r: { x: number; y: number; w: number; h: number }, range: number) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  return Math.hypot(px + BOAT_W / 2 - cx, py + BOAT_H / 2 - cy) < Math.max(r.w, r.h) / 2 + range;
}

function nearLocation(x: number, y: number, locations: LocationZone[]): LocationZone | null {
  for (const loc of locations) {
    if (nearRect(x, y, loc, INTERACT_RANGE)) return loc;
  }
  return null;
}

// ── Main Component ────────────────────────────────────────────────
export default function BoatGame() {
  const [phase, setPhase] = useState<"waterway" | "pup" | "playing">("waterway");
  const [waterway, setWaterway] = useState<WaterwayDef>(ALL_WATERWAYS[0]);
  const waterwayChannel = useMemo(() => waterway.renderChannel(), [waterway.id]);
  const waterwayBuoys = useMemo(() => waterway.renderBuoys(), [waterway.id]);
  const [pup, setPup] = useState<PupBoat>(PUPS[0]);
  const [pos, setPos] = useState<Vec2>({ x: 0, y: 0 });
  const [angle, setAngle] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [score, setScore] = useState(0);
  const [fuel, setFuel] = useState(MAX_FUEL);
  const [collectibles, setCollectibles] = useState<Collectible[]>([]);
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [honking, setHonking] = useState(false);
  const [msg, setMsg] = useState("");
  const [bubble, setBubble] = useState<{ text: string; emoji: string; locId: string } | null>(null);
  const [nearLoc, setNearLoc] = useState<LocationZone | null>(null);
  const [nearDock, setNearDock] = useState(false);
  const [finished, setFinished] = useState(false);
  const [outOfFuel, setOutOfFuel] = useState(false);

  const keysRef = useRef<Set<string>>(new Set());
  const animRef = useRef<number | null>(null);
  const posRef = useRef(pos);
  const angleRef = useRef(angle);
  const speedRef = useRef(speed);
  const fuelRef = useRef(fuel);
  const waterwayRef = useRef(waterway);

  posRef.current = pos;
  angleRef.current = angle;
  speedRef.current = speed;
  fuelRef.current = fuel;
  waterwayRef.current = waterway;

  const allCollected = collectibles.every((c) => c.collected);
  const allVisited = waterway.locations.every((l) => visited.has(l.id));
  const missionDone = allCollected && allVisited;

  useEffect(() => {
    if (missionDone && !finished && phase === "playing") {
      setFinished(true);
      setMsg("");
      playVictorySound();
      speak("Voyage complete! No job is too big, no pup is too small!");
    }
  }, [missionDone, finished, phase]);

  const startPlaying = (w: WaterwayDef, p: PupBoat) => {
    setWaterway(w); setPup(p); setPhase("playing");
    setPos(w.startPos); setAngle(w.startAngle); setSpeed(0);
    setScore(0); setFuel(MAX_FUEL); fuelRef.current = MAX_FUEL;
    setCollectibles(generateCollectibles(w.collectiblePoints));
    setVisited(new Set()); setFinished(false); setOutOfFuel(false);
    setBubble(null); setMsg(`Captain ${p.name} sets sail!`);
    speak(`Captain ${p.name} sets sail!`);
  };

  // ── Key handlers ────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (e.key === " " && phase === "playing") {
        e.preventDefault();
        const w = waterwayRef.current;
        if (nearRect(posRef.current.x, posRef.current.y, w.fuelDock, DOCK_RANGE)) {
          setFuel((f) => { const n = Math.min(f + FUEL_REFILL, MAX_FUEL); fuelRef.current = n; return n; });
          setOutOfFuel(false);
          setMsg("Fuel tank filled up! ⛽");
          playRefuelSound();
          return;
        }
        const loc = nearLocation(posRef.current.x, posRef.current.y, w.locations);
        if (loc) {
          setVisited((prev) => {
            const s = new Set(prev);
            if (!s.has(loc.id)) { s.add(loc.id); setScore((sc) => sc + loc.reward); }
            return s;
          });
          setBubble({ text: loc.interactionMessage, emoji: loc.interactionEmoji, locId: loc.id });
          speak(loc.interactionMessage);
          setTimeout(() => setBubble(null), 3000);
        } else {
          setHonking(true); setTimeout(() => setHonking(false), 300);
          playHornSound();
        }
      }
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [phase]);

  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(""), 2000); return () => clearTimeout(t); } }, [msg]);

  // ── Game loop ───────────────────────────────────────────────────
  const gameLoop = useCallback(() => {
    const keys = keysRef.current;
    const w = waterwayRef.current;
    const curFuel = fuelRef.current;

    if (curFuel <= 0) {
      if (!outOfFuel) { setOutOfFuel(true); speak("Oh no! Out of fuel!"); }
      setNearDock(nearRect(posRef.current.x, posRef.current.y, w.fuelDock, DOCK_RANGE));
      animRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    let a = angleRef.current;
    if (keys.has("ArrowLeft") || keys.has("a")) a -= TURN_SPEED;
    if (keys.has("ArrowRight") || keys.has("d")) a += TURN_SPEED;
    angleRef.current = a; setAngle(a);

    let s = speedRef.current;
    if (keys.has("ArrowUp") || keys.has("w")) s = Math.min(s + ACCEL, MAX_SPD);
    else if (keys.has("ArrowDown") || keys.has("s")) s = Math.max(s - ACCEL, -MAX_SPD / 2);
    else s *= FRICTION;
    if (Math.abs(s) < 0.01) s = 0;

    const rad = (a * Math.PI) / 180;
    let nx = posRef.current.x + Math.cos(rad) * s;
    let ny = posRef.current.y + Math.sin(rad) * s;
    nx = Math.max(0, Math.min(CW - BOAT_W, nx));
    ny = Math.max(0, Math.min(CH - BOAT_H, ny));

    // Collision with locations/dock
    const hitsBuilding = w.locations.some((l) => collidesWithRect(nx, ny, l));
    const hitsDock = collidesWithRect(nx, ny, w.fuelDock);
    if (hitsBuilding || hitsDock) { s = 0; nx = posRef.current.x; ny = posRef.current.y; }

    // Off-channel (shallow waters)
    if (!w.isOnChannel(nx + BOAT_W / 2, ny + BOAT_H / 2)) s *= 0.92;

    // Fuel drain
    if (Math.abs(s) > 0.1) {
      const nf = Math.max(0, curFuel - FUEL_DRAIN * Math.abs(s));
      fuelRef.current = nf; setFuel(nf);
      if (nf < 20 && nf > 19.5) { setMsg("Low fuel! Find the fuel dock! ⛽"); speak("Low fuel! Find the fuel dock!"); }
    }

    speedRef.current = s; setSpeed(s);
    posRef.current = { x: nx, y: ny }; setPos({ x: nx, y: ny });

    setNearLoc(nearLocation(nx, ny, w.locations));
    setNearDock(nearRect(nx, ny, w.fuelDock, DOCK_RANGE));

    // Collectibles
    setCollectibles((prev) => {
      let changed = false;
      const upd = prev.map((c) => {
        if (c.collected) return c;
        if (Math.hypot(nx + BOAT_W / 2 - (c.x + COLL_SIZE / 2), ny + BOAT_H / 2 - (c.y + COLL_SIZE / 2)) < (BOAT_W + COLL_SIZE) / 2) {
          changed = true; setScore((sc) => sc + c.points); setMsg(`+${c.points} ${c.emoji}`); playCollectSound();
          return { ...c, collected: true };
        }
        return c;
      });
      return changed ? upd : prev;
    });

    animRef.current = requestAnimationFrame(gameLoop);
  }, []);

  useEffect(() => {
    if (phase !== "playing" || finished) return;
    animRef.current = requestAnimationFrame(gameLoop);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [phase, finished, gameLoop]);

  // ═══════════════════════════════════════════════════════════════
  // WATERWAY SELECTION SCREEN
  // ═══════════════════════════════════════════════════════════════
  if (phase === "waterway") {
    return (
      <div className="flex flex-col items-center min-h-screen px-4 py-8 select-none">
        <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg"
          style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.3)" }}>
          🚢 Paw Patrol Boats 🚢
        </h1>
        <p className="text-xl text-white/80 mb-6">Choose your waterway!</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-2xl w-full">
          {ALL_WATERWAYS.map((w) => (
            <button key={w.id}
              onClick={() => { setWaterway(w); setPhase("pup"); }}
              className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-2xl p-6 text-white shadow-xl hover:scale-105 transition-transform border-4 border-cyan-400/50">
              <div className="text-5xl mb-3">{w.emoji}</div>
              <h2 className="text-xl font-bold mb-1">{w.name}</h2>
              <p className="text-white/70 text-sm">{w.description}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // PUP SELECTION SCREEN
  // ═══════════════════════════════════════════════════════════════
  if (phase === "pup") {
    return (
      <div className="flex flex-col items-center min-h-screen px-4 py-8 select-none">
        <h1 className="text-4xl font-bold text-white mb-1 drop-shadow-lg"
          style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.3)" }}>
          🚢 {waterway.name} 🚢
        </h1>
        <p className="text-xl text-white/80 mb-6">Pick your boat!</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-lg">
          {PUPS.map((p) => (
            <button key={p.name} onClick={() => startPlaying(waterway, p)}
              className="rounded-2xl p-5 text-white font-bold shadow-xl hover:scale-110 transition-transform border-4 border-white/20 flex flex-col items-center gap-2"
              style={{ backgroundColor: p.color }}>
              <div className="transform scale-[2] mb-3 mt-2">
                <Boat color={p.color} darkColor={p.darkColor} accent={p.accentColor} num={p.number} />
              </div>
              <span className="text-lg">#{p.number} {p.name}</span>
            </button>
          ))}
        </div>
        <button onClick={() => setPhase("waterway")}
          className="mt-6 text-white/60 text-sm hover:text-white">
          ← Back to waterway selection
        </button>
        <div className="mt-4 text-white/70 text-sm text-center max-w-md">
          <p>Arrow keys / WASD to steer. Space to interact & refuel.</p>
          <p>Collect everything & visit all locations. Watch your fuel!</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // GAMEPLAY SCREEN
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-3 select-none">
      {/* HUD */}
      <div className="flex items-center gap-3 mb-1.5 flex-wrap justify-center">
        <h1 className="text-xl font-bold text-white drop-shadow-lg">
          #{pup.number} {pup.name}
        </h1>
        <span className="text-lg font-bold text-yellow-300">Score: {score}</span>
        <span className="text-xs text-white/70">
          Items: {collectibles.filter((c) => c.collected).length}/{collectibles.length}
        </span>
        <span className="text-xs text-white/70">
          Visited: {visited.size}/{waterway.locations.length}
        </span>
        {/* Fuel gauge */}
        <div className="flex items-center gap-1">
          <span className="text-sm">⛽</span>
          <div className="w-20 h-3.5 bg-gray-700 rounded-full overflow-hidden border border-white/30">
            <div className="h-full rounded-full transition-all duration-200" style={{
              width: `${fuel}%`,
              backgroundColor: fuel > 50 ? "#22C55E" : fuel > 20 ? "#F59E0B" : "#EF4444",
            }} />
          </div>
          <span className={`text-xs font-bold ${fuel <= 20 ? "text-red-400 animate-pulse" : "text-white/70"}`}>
            {Math.round(fuel)}%
          </span>
        </div>
        <button onClick={() => setPhase("waterway")}
          className="px-2 py-1 rounded-lg bg-white/20 text-white text-xs hover:bg-white/30">
          Menu
        </button>
      </div>

      <div className="h-7 flex items-center justify-center">
        {msg && <div className="text-lg font-bold text-yellow-300 drop-shadow-lg">{msg}</div>}
        {!msg && nearDock && !bubble && !finished && !outOfFuel && (
          <div className="text-xs font-semibold text-white bg-black/40 px-3 py-1 rounded-full">Press Space to refuel! ⛽</div>
        )}
        {!msg && nearLoc && !nearDock && !bubble && !finished && (
          <div className="text-xs font-semibold text-white bg-black/40 px-3 py-1 rounded-full">
            Press Space to visit {nearLoc.label}! {nearLoc.emoji}
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="relative rounded-xl border-4 border-white/30 overflow-hidden"
        style={{ width: CW, height: CH, background: "#38BDF8" }}>
        {/* Wave texture */}
        <div className="absolute inset-0" style={{
          backgroundImage: "radial-gradient(circle, rgba(56,189,248,0.4) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }} />
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 12px)",
        }} />

        {/* Water channel */}
        {waterwayChannel}
        {waterwayBuoys}

        {/* Locations */}
        {waterway.locations.map((loc) => {
          const v = visited.has(loc.id);
          return (
            <div key={loc.id}
              className={`absolute rounded-lg flex flex-col items-center justify-center transition-all ${v ? "ring-4 ring-green-400" : ""}`}
              style={{
                left: loc.x, top: loc.y, width: loc.w, height: loc.h,
                backgroundColor: loc.color, border: "3px solid rgba(0,0,0,0.3)",
                boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              }}>
              <div className="text-xl">{loc.emoji}</div>
              <div className="text-white text-[8px] font-bold text-center leading-tight px-0.5">{loc.label}</div>
              {v && <div className="text-[10px]">✅</div>}
            </div>
          );
        })}

        {/* Fuel Dock */}
        <div className={`absolute rounded-lg flex flex-col items-center justify-center ${fuel <= 20 ? "animate-pulse ring-4 ring-red-400" : ""}`}
          style={{
            left: waterway.fuelDock.x, top: waterway.fuelDock.y,
            width: waterway.fuelDock.w, height: waterway.fuelDock.h,
            backgroundColor: "#92400E", border: "3px solid #F59E0B",
            boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
          }}>
          <div className="text-xl">⚓</div>
          <div className="text-white text-[8px] font-bold">Fuel Dock</div>
        </div>

        {/* Interaction bubble */}
        {bubble && (() => {
          const loc = waterway.locations.find((l) => l.id === bubble.locId);
          if (!loc) return null;
          const bx = Math.max(5, Math.min(loc.x + loc.w / 2 - 100, CW - 210));
          const by = loc.y - 65 >= 5 ? loc.y - 65 : loc.y + loc.h + 10;
          return (
            <div className="absolute bg-white rounded-xl px-3 py-2 shadow-lg border-2 border-cyan-400 z-30 max-w-[200px]"
              style={{ left: bx, top: Math.max(5, Math.min(by, CH - 60)) }}>
              <div className="text-sm font-bold text-gray-800">{bubble.emoji} {bubble.text}</div>
            </div>
          );
        })()}

        {/* Collectibles */}
        {collectibles.filter((c) => !c.collected).map((c) => (
          <div key={`col-${c.id}`} className="absolute animate-pulse" style={{
            left: c.x, top: c.y, width: COLL_SIZE, height: COLL_SIZE,
            fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center",
            filter: "drop-shadow(0 0 4px rgba(0,200,255,0.6))",
          }}>{c.emoji}</div>
        ))}

        {/* Boat */}
        <div className="absolute z-20" style={{
          left: pos.x, top: pos.y, width: BOAT_W, height: BOAT_H,
          transform: `rotate(${angle + 90}deg)`, transformOrigin: "center center",
          filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.4))",
        }}>
          <Boat color={pup.color} darkColor={pup.darkColor} accent={pup.accentColor} num={pup.number} />
        </div>

        {/* Horn honk */}
        {honking && (
          <div className="absolute text-2xl font-bold text-cyan-300 animate-ping pointer-events-none z-30"
            style={{ left: pos.x - 10, top: pos.y - 25, textShadow: "0 0 8px rgba(0,200,255,0.8)" }}>
            HONK!
          </div>
        )}

        {/* Out of fuel */}
        {outOfFuel && !finished && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-40">
            <div className="text-6xl mb-4">⛽</div>
            <div className="text-3xl font-bold text-red-400 mb-2">Out of Fuel!</div>
            <div className="text-lg text-white mb-4">
              {nearDock ? "Press Space to refuel!" : "Oh no! You ran out of fuel!"}
            </div>
            <button onClick={() => startPlaying(waterway, pup)}
              className="bg-yellow-500 text-black px-6 py-3 rounded-full text-lg font-bold hover:bg-yellow-400 transition-colors">
              Try Again
            </button>
          </div>
        )}

        {/* Finish */}
        {finished && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-40">
            <div className="text-6xl mb-4 animate-bounce">🏆</div>
            <div className="text-4xl font-bold text-cyan-300 mb-2" style={{ textShadow: "0 0 20px rgba(0,200,255,0.5)" }}>
              Voyage Complete!
            </div>
            <div className="text-2xl text-white mb-1">Final Score: {score}</div>
            <div className="text-lg text-white/80 mb-3">
              Captain {pup.name} sailed the {waterway.name}!
            </div>
            <div className="flex gap-3 text-3xl mb-3">
              {waterway.locations.map((l) => <span key={l.id} title={l.label}>{l.emoji}</span>)}
            </div>
            <div className="text-white text-lg mb-3">No job is too big, no pup is too small! 🐾</div>
            <button onClick={() => startPlaying(waterway, pup)}
              className="bg-cyan-500 text-white px-6 py-3 rounded-full text-xl font-bold hover:bg-cyan-600 transition-colors">
              Sail Again!
            </button>
            <button onClick={() => setPhase("waterway")}
              className="text-white/70 text-sm mt-3 hover:text-white">
              Change waterway or pup
            </button>
          </div>
        )}
      </div>

      <div className="mt-2 text-white/70 text-xs text-center">
        Arrow keys / WASD to steer. Space to interact & refuel. Collect everything & visit all locations!
      </div>
    </div>
  );
}
