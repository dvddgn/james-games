"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useFullscreen } from "../hooks/useFullscreen";

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

function playHonkSound() {
  playTone(400, 0.15, "square", 0.08);
  setTimeout(() => playTone(500, 0.2, "square", 0.08), 100);
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

// ── Background music (looping procedural soundtrack) ──────────────
class Soundtrack {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private playing = false;
  private intervalIds: ReturnType<typeof setInterval>[] = [];
  private timeoutIds: ReturnType<typeof setTimeout>[] = [];

  // Fun upbeat melody notes (C major pentatonic patterns)
  private melodyPatterns = [
    [523, 587, 659, 784, 659, 587], // C D E G E D
    [784, 659, 523, 587, 659, 784], // G E C D E G
    [523, 659, 784, 1047, 784, 659], // C E G C' G E
    [587, 659, 784, 659, 523, 587], // D E G E C D
  ];
  private patternIndex = 0;

  start() {
    if (this.playing) return;
    try {
      this.ctx = new AudioContext();
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = 0.06;
      this.gainNode.connect(this.ctx.destination);
      this.playing = true;

      // Bass line - steady quarter notes
      let bassStep = 0;
      const bassNotes = [131, 165, 147, 175]; // C3 E3 D3 F3
      const bassId = setInterval(() => {
        if (!this.ctx || !this.gainNode) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = bassNotes[bassStep % bassNotes.length];
        g.gain.value = 0.08;
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
        osc.connect(g);
        g.connect(this.gainNode!);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.4);
        bassStep++;
      }, 400);
      this.intervalIds.push(bassId);

      // Melody line - plays pattern notes
      let noteIndex = 0;
      const melodyId = setInterval(() => {
        if (!this.ctx || !this.gainNode) return;
        const pattern = this.melodyPatterns[this.patternIndex % this.melodyPatterns.length];
        const freq = pattern[noteIndex % pattern.length];
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        g.gain.value = 0.05;
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
        osc.connect(g);
        g.connect(this.gainNode!);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
        noteIndex++;
        if (noteIndex >= pattern.length) {
          noteIndex = 0;
          this.patternIndex++;
        }
      }, 300);
      this.intervalIds.push(melodyId);

      // Light percussion - hi-hat pattern
      let percStep = 0;
      const percId = setInterval(() => {
        if (!this.ctx || !this.gainNode) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "square";
        osc.frequency.value = percStep % 2 === 0 ? 1200 : 800;
        g.gain.value = percStep % 4 === 0 ? 0.02 : 0.01;
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
        osc.connect(g);
        g.connect(this.gainNode!);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.06);
        percStep++;
      }, 200);
      this.intervalIds.push(percId);
    } catch {}
  }

  stop() {
    this.playing = false;
    this.intervalIds.forEach(clearInterval);
    this.timeoutIds.forEach(clearTimeout);
    this.intervalIds = [];
    this.timeoutIds = [];
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.gainNode = null;
    }
  }

  get isPlaying() { return this.playing; }
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
  type: "bone" | "badge" | "treat";
  emoji: string; points: number; collected: boolean;
}

interface PupVehicle {
  name: string; color: string; darkColor: string;
  accentColor: string; number: number;
}

interface LocationZone {
  id: string; x: number; y: number; w: number; h: number;
  color: string; label: string; emoji: string;
  interactionMessage: string; interactionEmoji: string; reward: number;
}

interface TrackDef {
  id: string; name: string; emoji: string;
  description: string;
  isOnRoad: (x: number, y: number) => boolean;
  renderRoad: () => React.ReactNode;
  renderDashes: () => React.ReactNode;
  startPos: Vec2; startAngle: number;
  collectiblePoints: Vec2[];
  locations: LocationZone[];
  gasStation: { x: number; y: number; w: number; h: number };
}

// ── Constants ──────────────────────────────────────────────────────
const CW = 700, CH = 500;
const CAR_W = 26, CAR_H = 44;
const TURN_SPEED = 4, ACCEL = 0.15, FRICTION = 0.97, MAX_SPD = 5;
const COLL_SIZE = 28;
const MAX_FUEL = 100, FUEL_DRAIN = 0.03, FUEL_REFILL = 60;
const INTERACT_RANGE = 50, GAS_RANGE = 55;
const ROAD_HALF = 30; // half-width of road band

// ── Pup vehicles (race car themed) ────────────────────────────────
const PUPS: PupVehicle[] = [
  { name: "Chase",    color: "#3B82F6", darkColor: "#1D4ED8", accentColor: "#FCD34D", number: 1 },
  { name: "Marshall", color: "#EF4444", darkColor: "#B91C1C", accentColor: "#FBBF24", number: 2 },
  { name: "Skye",     color: "#EC4899", darkColor: "#BE185D", accentColor: "#F9A8D4", number: 3 },
  { name: "Rubble",   color: "#F59E0B", darkColor: "#B45309", accentColor: "#FEF3C7", number: 4 },
  { name: "Rocky",    color: "#10B981", darkColor: "#047857", accentColor: "#A7F3D0", number: 5 },
  { name: "Zuma",     color: "#F97316", darkColor: "#C2410C", accentColor: "#FED7AA", number: 6 },
];

// ── Race car SVG ──────────────────────────────────────────────────
function RaceCar({ color, darkColor, accent, num }: {
  color: string; darkColor: string; accent: string; num: number;
}) {
  return (
    <svg width={CAR_W} height={CAR_H} viewBox="0 0 26 44">
      {/* Shadow */}
      <ellipse cx="13" cy="40" rx="10" ry="3" fill="rgba(0,0,0,0.15)" />
      {/* Body */}
      <path d="M5 38 L3 30 L3 14 L5 4 Q13 0 21 4 L23 14 L23 30 L21 38 Q13 40 5 38Z"
        fill={color} stroke={darkColor} strokeWidth="1.2" />
      {/* Racing stripe */}
      <rect x="11" y="3" width="4" height="37" rx="2" fill={accent} opacity="0.6" />
      {/* Cockpit / windshield */}
      <path d="M7 12 L7 8 Q13 5 19 8 L19 12 Q13 10 7 12Z"
        fill={darkColor} opacity="0.7" />
      {/* Cockpit opening */}
      <ellipse cx="13" cy="16" rx="5" ry="4" fill={darkColor} opacity="0.5" />
      {/* Front wheels */}
      <rect x="0" y="8" width="4" height="9" rx="2" fill="#1F2937" />
      <rect x="22" y="8" width="4" height="9" rx="2" fill="#1F2937" />
      {/* Rear wheels */}
      <rect x="0" y="27" width="4" height="10" rx="2" fill="#1F2937" />
      <rect x="22" y="27" width="4" height="10" rx="2" fill="#1F2937" />
      {/* Rear spoiler */}
      <rect x="4" y="36" width="18" height="3" rx="1" fill={darkColor} />
      <rect x="3" y="35" width="20" height="2" rx="1" fill={accent} opacity="0.8" />
      {/* Number */}
      <circle cx="13" cy="24" r="4" fill="white" opacity="0.9" />
      <text x="13" y="27" textAnchor="middle" fontSize="7" fontWeight="bold" fill={darkColor}>
        {num}
      </text>
      {/* Headlights */}
      <circle cx="8" cy="5" r="1.5" fill="#FEF9C3" opacity="0.9" />
      <circle cx="18" cy="5" r="1.5" fill="#FEF9C3" opacity="0.9" />
    </svg>
  );
}

// ── Track definitions ─────────────────────────────────────────────
const SHARED_LOCATIONS: Omit<LocationZone, "x" | "y">[] = [
  { id: "lookout", w: 80, h: 80, color: "#60A5FA", label: "Lookout Tower", emoji: "🏰",
    interactionMessage: "Ryder says: Great job pup! Keep patrolling!", interactionEmoji: "📡", reward: 50 },
  { id: "katies", w: 70, h: 55, color: "#8B5CF6", label: "Katie's", emoji: "🐱",
    interactionMessage: "Katie: Here's a treat for your pup!", interactionEmoji: "🧁", reward: 30 },
  { id: "townhall", w: 75, h: 55, color: "#06B6D4", label: "Town Hall", emoji: "🏛️",
    interactionMessage: "Mayor Goodway: Adventure Bay thanks you!", interactionEmoji: "🐔", reward: 30 },
  { id: "porters", w: 70, h: 55, color: "#F59E0B", label: "Mr. Porter's", emoji: "🍕",
    interactionMessage: "Mr. Porter: Here's a snack for you!", interactionEmoji: "🍪", reward: 30 },
  { id: "farmers", w: 75, h: 55, color: "#10B981", label: "Farmer Al's", emoji: "🌾",
    interactionMessage: "Farmer Al: The animals are safe!", interactionEmoji: "🐄", reward: 30 },
];

function makeLocations(positions: Vec2[]): LocationZone[] {
  return SHARED_LOCATIONS.map((loc, i) => ({ ...loc, x: positions[i].x, y: positions[i].y }));
}

function circleRoadCheck(cx: number, cy: number, rInner: number, rOuter: number) {
  return (x: number, y: number) => {
    const d = Math.hypot(x - cx, y - cy);
    return d >= rInner - 15 && d <= rOuter + 15;
  };
}

function ovalRoadCheck(cx: number, cy: number, rxI: number, ryI: number, rxO: number, ryO: number) {
  return (x: number, y: number) => {
    const dx = x - cx, dy = y - cy;
    const dOuter = (dx * dx) / (rxO * rxO) + (dy * dy) / (ryO * ryO);
    const dInner = (dx * dx) / (rxI * rxI) + (dy * dy) / (ryI * ryI);
    return dOuter <= 1.15 && dInner >= 0.85;
  };
}

function figure8RoadCheck(cx1: number, cy1: number, cx2: number, cy2: number, rI: number, rO: number) {
  return (x: number, y: number) => {
    const d1 = Math.hypot(x - cx1, y - cy1);
    const d2 = Math.hypot(x - cx2, y - cy2);
    const on1 = d1 >= rI - 15 && d1 <= rO + 15;
    const on2 = d2 >= rI - 15 && d2 <= rO + 15;
    return on1 || on2;
  };
}

// ── Circle Track ──────────────────────────────────────────────────
const CIRCLE_CX = 350, CIRCLE_CY = 250, CIRCLE_RI = 140, CIRCLE_RO = 200;
const circleTrack: TrackDef = {
  id: "circle", name: "Circle Track", emoji: "⭕",
  description: "Classic circle around the Lookout!",
  isOnRoad: circleRoadCheck(CIRCLE_CX, CIRCLE_CY, CIRCLE_RI, CIRCLE_RO),
  startPos: { x: CIRCLE_CX + CIRCLE_RO - 40, y: CIRCLE_CY },
  startAngle: -90,
  gasStation: { x: 540, y: 230, w: 60, h: 50 },
  locations: makeLocations([
    { x: 310, y: 210 }, { x: 50, y: 50 }, { x: 560, y: 50 },
    { x: 50, y: 380 }, { x: 560, y: 370 },
  ]),
  collectiblePoints: Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI * 2) / 12;
    const r = (CIRCLE_RI + CIRCLE_RO) / 2;
    return { x: CIRCLE_CX + Math.cos(a) * r, y: CIRCLE_CY + Math.sin(a) * r };
  }),
  renderRoad: () => (
    <>
      <div className="absolute rounded-full" style={{
        left: CIRCLE_CX - CIRCLE_RO, top: CIRCLE_CY - CIRCLE_RO,
        width: CIRCLE_RO * 2, height: CIRCLE_RO * 2,
        backgroundColor: "#6B7280", border: "4px solid #FCD34D",
      }} />
      <div className="absolute rounded-full" style={{
        left: CIRCLE_CX - CIRCLE_RI, top: CIRCLE_CY - CIRCLE_RI,
        width: CIRCLE_RI * 2, height: CIRCLE_RI * 2,
        backgroundColor: "#4ADE80", border: "4px solid #FCD34D",
      }} />
    </>
  ),
  renderDashes: () => (
    <>
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i * Math.PI * 2) / 24;
        const r = (CIRCLE_RI + CIRCLE_RO) / 2;
        return (
          <div key={`d${i}`} className="absolute bg-white/60 rounded" style={{
            left: CIRCLE_CX + Math.cos(a) * r - 6, top: CIRCLE_CY + Math.sin(a) * r - 3,
            width: 12, height: 6, transform: `rotate(${(a * 180) / Math.PI + 90}deg)`,
          }} />
        );
      })}
    </>
  ),
};

// ── Oval Track ────────────────────────────────────────────────────
const OVAL_CX = 350, OVAL_CY = 250;
const OVAL_RXO = 300, OVAL_RYO = 190, OVAL_RXI = 240, OVAL_RYI = 130;
const ovalTrack: TrackDef = {
  id: "oval", name: "Oval Speedway", emoji: "🏁",
  description: "A wide oval — perfect for speed!",
  isOnRoad: ovalRoadCheck(OVAL_CX, OVAL_CY, OVAL_RXI, OVAL_RYI, OVAL_RXO, OVAL_RYO),
  startPos: { x: OVAL_CX + OVAL_RXO - 40, y: OVAL_CY },
  startAngle: -90,
  gasStation: { x: 345, y: 10, w: 60, h: 45 },
  locations: makeLocations([
    { x: 310, y: 210 }, { x: 15, y: 15 }, { x: 590, y: 15 },
    { x: 15, y: 420 }, { x: 590, y: 420 },
  ]),
  collectiblePoints: Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI * 2) / 12;
    const rx = (OVAL_RXI + OVAL_RXO) / 2;
    const ry = (OVAL_RYI + OVAL_RYO) / 2;
    return { x: OVAL_CX + Math.cos(a) * rx, y: OVAL_CY + Math.sin(a) * ry };
  }),
  renderRoad: () => (
    <>
      <div className="absolute" style={{
        left: OVAL_CX - OVAL_RXO, top: OVAL_CY - OVAL_RYO,
        width: OVAL_RXO * 2, height: OVAL_RYO * 2,
        backgroundColor: "#6B7280", borderRadius: "50%", border: "4px solid #FCD34D",
      }} />
      <div className="absolute" style={{
        left: OVAL_CX - OVAL_RXI, top: OVAL_CY - OVAL_RYI,
        width: OVAL_RXI * 2, height: OVAL_RYI * 2,
        backgroundColor: "#4ADE80", borderRadius: "50%", border: "4px solid #FCD34D",
      }} />
    </>
  ),
  renderDashes: () => (
    <>
      {Array.from({ length: 30 }, (_, i) => {
        const a = (i * Math.PI * 2) / 30;
        const rx = (OVAL_RXI + OVAL_RXO) / 2;
        const ry = (OVAL_RYI + OVAL_RYO) / 2;
        return (
          <div key={`d${i}`} className="absolute bg-white/60 rounded" style={{
            left: OVAL_CX + Math.cos(a) * rx - 6, top: OVAL_CY + Math.sin(a) * ry - 3,
            width: 12, height: 6, transform: `rotate(${(a * 180) / Math.PI + 90}deg)`,
          }} />
        );
      })}
    </>
  ),
};

// ── Figure-8 Track ────────────────────────────────────────────────
const F8_CX1 = 220, F8_CY1 = 250, F8_CX2 = 480, F8_CY2 = 250;
const F8_RI = 100, F8_RO = 160;
const fig8Track: TrackDef = {
  id: "figure8", name: "Figure-8", emoji: "♾️",
  description: "Two loops — watch for the crossover!",
  isOnRoad: figure8RoadCheck(F8_CX1, F8_CY1, F8_CX2, F8_CY2, F8_RI, F8_RO),
  startPos: { x: F8_CX1 + F8_RO - 30, y: F8_CY1 },
  startAngle: -90,
  gasStation: { x: 320, y: 10, w: 60, h: 45 },
  locations: makeLocations([
    { x: 180, y: 215 }, { x: 10, y: 15 }, { x: 590, y: 15 },
    { x: 10, y: 420 }, { x: 590, y: 420 },
  ]),
  collectiblePoints: [
    ...Array.from({ length: 6 }, (_, i) => {
      const a = (i * Math.PI * 2) / 6;
      const r = (F8_RI + F8_RO) / 2;
      return { x: F8_CX1 + Math.cos(a) * r, y: F8_CY1 + Math.sin(a) * r };
    }),
    ...Array.from({ length: 6 }, (_, i) => {
      const a = (i * Math.PI * 2) / 6;
      const r = (F8_RI + F8_RO) / 2;
      return { x: F8_CX2 + Math.cos(a) * r, y: F8_CY2 + Math.sin(a) * r };
    }),
  ],
  renderRoad: () => (
    <>
      {/* Left loop */}
      <div className="absolute rounded-full" style={{
        left: F8_CX1 - F8_RO, top: F8_CY1 - F8_RO,
        width: F8_RO * 2, height: F8_RO * 2,
        backgroundColor: "#6B7280", border: "4px solid #FCD34D",
      }} />
      {/* Right loop */}
      <div className="absolute rounded-full" style={{
        left: F8_CX2 - F8_RO, top: F8_CY2 - F8_RO,
        width: F8_RO * 2, height: F8_RO * 2,
        backgroundColor: "#6B7280", border: "4px solid #FCD34D",
      }} />
      {/* Left inner */}
      <div className="absolute rounded-full" style={{
        left: F8_CX1 - F8_RI, top: F8_CY1 - F8_RI,
        width: F8_RI * 2, height: F8_RI * 2,
        backgroundColor: "#4ADE80", border: "4px solid #FCD34D",
      }} />
      {/* Right inner */}
      <div className="absolute rounded-full" style={{
        left: F8_CX2 - F8_RI, top: F8_CY2 - F8_RI,
        width: F8_RI * 2, height: F8_RI * 2,
        backgroundColor: "#4ADE80", border: "4px solid #FCD34D",
      }} />
    </>
  ),
  renderDashes: () => (
    <>
      {[F8_CX1, F8_CX2].map((cx, li) =>
        Array.from({ length: 16 }, (_, i) => {
          const a = (i * Math.PI * 2) / 16;
          const r = (F8_RI + F8_RO) / 2;
          return (
            <div key={`d${li}-${i}`} className="absolute bg-white/60 rounded" style={{
              left: cx + Math.cos(a) * r - 6, top: F8_CY1 + Math.sin(a) * r - 3,
              width: 12, height: 6, transform: `rotate(${(a * 180) / Math.PI + 90}deg)`,
            }} />
          );
        })
      )}
    </>
  ),
};

// ── Grand Prix Track (corners & straights) ────────────────────────
// Centerline waypoints forming a closed loop
const GP_POINTS: Vec2[] = [
  { x: 120, y: 70 },  // 0: top-left
  { x: 580, y: 70 },  // 1: top-right
  { x: 630, y: 120 }, // 2: TR corner
  { x: 630, y: 200 }, // 3: right upper
  { x: 480, y: 250 }, // 4: chicane in
  { x: 630, y: 300 }, // 5: chicane out
  { x: 630, y: 400 }, // 6: right lower
  { x: 580, y: 440 }, // 7: BR corner
  { x: 350, y: 440 }, // 8: bottom mid
  { x: 280, y: 380 }, // 9: hairpin apex
  { x: 200, y: 440 }, // 10: hairpin exit
  { x: 120, y: 440 }, // 11: BL
  { x: 70, y: 400 },  // 12: BL corner
  { x: 70, y: 120 },  // 13: left straight
  { x: 120, y: 70 },  // 14: back to start (closed)
];

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function gpRoadCheck(x: number, y: number): boolean {
  for (let i = 0; i < GP_POINTS.length - 1; i++) {
    const a = GP_POINTS[i], b = GP_POINTS[i + 1];
    if (distToSegment(x, y, a.x, a.y, b.x, b.y) < ROAD_HALF + 15) return true;
  }
  return false;
}

function gpCollectiblePoints(): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i < GP_POINTS.length - 1; i++) {
    const a = GP_POINTS[i], b = GP_POINTS[i + 1];
    pts.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }
  return pts;
}

function gpSvgPath(): string {
  return GP_POINTS.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ");
}

const gpTrack: TrackDef = {
  id: "grandprix", name: "Grand Prix", emoji: "🏎️",
  description: "Corners, chicanes & a hairpin!",
  isOnRoad: gpRoadCheck,
  startPos: { x: 130, y: 50 },
  startAngle: 0,
  gasStation: { x: 350, y: 150, w: 55, h: 45 },
  locations: makeLocations([
    { x: 250, y: 150 }, { x: 10, y: 10 }, { x: 480, y: 150 },
    { x: 130, y: 340 }, { x: 440, y: 340 },
  ]),
  collectiblePoints: gpCollectiblePoints(),
  renderRoad: () => (
    <svg className="absolute inset-0" width={CW} height={CH} style={{ pointerEvents: "none" }}>
      {/* Road surface */}
      <path d={gpSvgPath()} fill="none" stroke="#6B7280" strokeWidth={ROAD_HALF * 2}
        strokeLinejoin="round" strokeLinecap="round" />
      {/* Yellow edge lines */}
      <path d={gpSvgPath()} fill="none" stroke="#FCD34D" strokeWidth={ROAD_HALF * 2 + 6}
        strokeLinejoin="round" strokeLinecap="round" opacity="0.5" />
      <path d={gpSvgPath()} fill="none" stroke="#6B7280" strokeWidth={ROAD_HALF * 2 - 2}
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  ),
  renderDashes: () => (
    <svg className="absolute inset-0" width={CW} height={CH} style={{ pointerEvents: "none" }}>
      <path d={gpSvgPath()} fill="none" stroke="white" strokeWidth={2}
        strokeLinejoin="round" strokeLinecap="round"
        strokeDasharray="12 18" opacity="0.5" />
    </svg>
  ),
};

const ALL_TRACKS: TrackDef[] = [circleTrack, ovalTrack, fig8Track, gpTrack];

// ── Helpers ───────────────────────────────────────────────────────
function generateCollectibles(points: Vec2[]): Collectible[] {
  const types = [
    { type: "bone" as const, emoji: "🦴", points: 10 },
    { type: "badge" as const, emoji: "⭐", points: 25 },
    { type: "treat" as const, emoji: "🍖", points: 15 },
  ];
  return points.map((p, i) => ({
    id: i, x: p.x - COLL_SIZE / 2, y: p.y - COLL_SIZE / 2,
    ...types[i % types.length], collected: false,
  }));
}

function collidesWithRect(x: number, y: number, r: { x: number; y: number; w: number; h: number }) {
  return x + CAR_W > r.x && x < r.x + r.w && y + CAR_H > r.y && y < r.y + r.h;
}

function nearRect(px: number, py: number, r: { x: number; y: number; w: number; h: number }, range: number) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  return Math.hypot(px + CAR_W / 2 - cx, py + CAR_H / 2 - cy) < Math.max(r.w, r.h) / 2 + range;
}

function nearLocation(x: number, y: number, locations: LocationZone[]): LocationZone | null {
  for (const loc of locations) {
    if (nearRect(x, y, loc, INTERACT_RANGE)) return loc;
  }
  return null;
}

// ── Main Component ────────────────────────────────────────────────
export default function DrivingGame() {
  const { ref: fsRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  const [phase, setPhase] = useState<"track" | "pup" | "playing">("track");
  const [track, setTrack] = useState<TrackDef>(ALL_TRACKS[0]);
  const trackRoad = useMemo(() => track.renderRoad(), [track.id]);
  const trackDashes = useMemo(() => track.renderDashes(), [track.id]);
  const [pup, setPup] = useState<PupVehicle>(PUPS[0]);
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
  const [nearGas, setNearGas] = useState(false);
  const [finished, setFinished] = useState(false);
  const [outOfGas, setOutOfGas] = useState(false);

  const [musicOn, setMusicOn] = useState(true);
  const soundtrackRef = useRef<Soundtrack | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const animRef = useRef<number | null>(null);
  const posRef = useRef(pos);
  const angleRef = useRef(angle);
  const speedRef = useRef(speed);
  const fuelRef = useRef(fuel);
  const trackRef = useRef(track);

  posRef.current = pos;
  angleRef.current = angle;
  speedRef.current = speed;
  fuelRef.current = fuel;
  trackRef.current = track;

  // Responsive scaling
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      setScale(Math.min(w / CW, 1));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Action handler (Space key / touch ACT button)
  const handleActionRef = useRef<() => void>(() => {});
  const handleAction = () => {
    const t = trackRef.current;
    if (nearRect(posRef.current.x, posRef.current.y, t.gasStation, GAS_RANGE)) {
      setFuel((f) => { const n = Math.min(f + FUEL_REFILL, MAX_FUEL); fuelRef.current = n; return n; });
      setOutOfGas(false);
      setMsg("Fuel tank filled up! ⛽");
      playRefuelSound();
      return;
    }
    const loc = nearLocation(posRef.current.x, posRef.current.y, t.locations);
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
      playHonkSound();
    }
  };
  handleActionRef.current = handleAction;

  // Soundtrack management
  useEffect(() => {
    if (phase === "playing" && musicOn && !finished) {
      if (!soundtrackRef.current) soundtrackRef.current = new Soundtrack();
      soundtrackRef.current.start();
    } else {
      soundtrackRef.current?.stop();
      soundtrackRef.current = null;
    }
    return () => { soundtrackRef.current?.stop(); soundtrackRef.current = null; };
  }, [phase, musicOn, finished]);

  const allCollected = collectibles.every((c) => c.collected);
  const allVisited = track.locations.every((l) => visited.has(l.id));
  const missionDone = allCollected && allVisited;

  useEffect(() => {
    if (missionDone && !finished && phase === "playing") {
      setFinished(true);
      setMsg("");
      playVictorySound();
      speak("Patrol complete! No job is too big, no pup is too small!");
    }
  }, [missionDone, finished, phase]);

  const startPlaying = (t: TrackDef, p: PupVehicle) => {
    setTrack(t); setPup(p); setPhase("playing");
    setPos(t.startPos); setAngle(t.startAngle); setSpeed(0);
    setScore(0); setFuel(MAX_FUEL); fuelRef.current = MAX_FUEL;
    setCollectibles(generateCollectibles(t.collectiblePoints));
    setVisited(new Set()); setFinished(false); setOutOfGas(false);
    setBubble(null); setMsg(`${p.name} is on the case!`);
    speak(`${p.name} is on the case!`);
  };

  // ── Key handlers ────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (e.key === " " && phase === "playing") {
        e.preventDefault();
        handleActionRef.current();
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
    const t = trackRef.current;
    const curFuel = fuelRef.current;

    if (curFuel <= 0) {
      if (!outOfGas) { setOutOfGas(true); speak("Oh no! Out of gas!"); }
      setNearGas(nearRect(posRef.current.x, posRef.current.y, t.gasStation, GAS_RANGE));
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
    nx = Math.max(0, Math.min(CW - CAR_W, nx));
    ny = Math.max(0, Math.min(CH - CAR_H, ny));

    // Collision
    const hitsBuilding = t.locations.some((l) => collidesWithRect(nx, ny, l));
    const hitsGas = collidesWithRect(nx, ny, t.gasStation);
    if (hitsBuilding || hitsGas) { s = 0; nx = posRef.current.x; ny = posRef.current.y; }

    // Off-road
    if (!t.isOnRoad(nx + CAR_W / 2, ny + CAR_H / 2)) s *= 0.92;

    // Fuel drain
    if (Math.abs(s) > 0.1) {
      const nf = Math.max(0, curFuel - FUEL_DRAIN * Math.abs(s));
      fuelRef.current = nf; setFuel(nf);
      if (nf < 20 && nf > 19.5) { setMsg("Low fuel! Find the gas station! ⛽"); speak("Low fuel! Find the gas station!"); }
    }

    speedRef.current = s; setSpeed(s);
    posRef.current = { x: nx, y: ny }; setPos({ x: nx, y: ny });

    setNearLoc(nearLocation(nx, ny, t.locations));
    setNearGas(nearRect(nx, ny, t.gasStation, GAS_RANGE));

    // Collectibles
    setCollectibles((prev) => {
      let changed = false;
      const upd = prev.map((c) => {
        if (c.collected) return c;
        if (Math.hypot(nx + CAR_W / 2 - (c.x + COLL_SIZE / 2), ny + CAR_H / 2 - (c.y + COLL_SIZE / 2)) < (CAR_W + COLL_SIZE) / 2) {
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
  // TRACK SELECTION SCREEN
  // ═══════════════════════════════════════════════════════════════
  if (phase === "track") {
    return (
      <div className="flex flex-col items-center min-h-screen px-3 py-4 sm:py-8 select-none">
        <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2 drop-shadow-lg"
          style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.3)" }}>
          🏎️ Paw Patrol Racing 🏎️
        </h1>
        <p className="text-base sm:text-xl text-white/80 mb-4 sm:mb-6">Choose your track!</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-2xl w-full">
          {ALL_TRACKS.map((t) => (
            <button key={t.id}
              onClick={() => { setTrack(t); setPhase("pup"); }}
              className="bg-gradient-to-br from-gray-700 to-gray-900 rounded-2xl p-6 text-white shadow-xl hover:scale-105 transition-transform border-4 border-yellow-400/50">
              <div className="text-5xl mb-3">{t.emoji}</div>
              <h2 className="text-xl font-bold mb-1">{t.name}</h2>
              <p className="text-white/70 text-sm">{t.description}</p>
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
      <div className="flex flex-col items-center min-h-screen px-3 py-4 sm:py-8 select-none">
        <h1 className="text-2xl sm:text-4xl font-bold text-white mb-1 drop-shadow-lg"
          style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.3)" }}>
          🏎️ {track.name} 🏎️
        </h1>
        <p className="text-base sm:text-xl text-white/80 mb-4 sm:mb-6">Pick your race car!</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-lg">
          {PUPS.map((p) => (
            <button key={p.name} onClick={() => startPlaying(track, p)}
              className="rounded-2xl p-5 text-white font-bold shadow-xl hover:scale-110 transition-transform border-4 border-white/20 flex flex-col items-center gap-2"
              style={{ backgroundColor: p.color }}>
              <div className="transform scale-[2] mb-3 mt-2">
                <RaceCar color={p.color} darkColor={p.darkColor} accent={p.accentColor} num={p.number} />
              </div>
              <span className="text-lg">#{p.number} {p.name}</span>
            </button>
          ))}
        </div>
        <button onClick={() => setPhase("track")}
          className="mt-6 text-white/60 text-sm hover:text-white">
          ← Back to track selection
        </button>
        <div className="mt-4 text-white/70 text-sm text-center max-w-md">
          <p>Arrow keys / WASD to drive. Space to interact & refuel.</p>
          <p>Collect everything & visit all locations. Watch your fuel!</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // GAMEPLAY SCREEN
  // ═══════════════════════════════════════════════════════════════
  return (
    <div ref={fsRef} className="flex flex-col items-center min-h-screen px-4 py-3 select-none" style={{ backgroundColor: '#87CEEB' }}>
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
          Visited: {visited.size}/{track.locations.length}
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
        <button onClick={() => setMusicOn((m) => !m)}
          className="px-2 py-1 rounded-lg bg-white/20 text-white text-xs hover:bg-white/30">
          {musicOn ? "🔊" : "🔇"}
        </button>
        <button onClick={() => setPhase("track")}
          className="px-2 py-1 rounded-lg bg-white/20 text-white text-xs hover:bg-white/30">
          Menu
        </button>
        <button onClick={toggleFullscreen}
          className="px-2 py-1 rounded-lg bg-white/20 text-white text-xs hover:bg-white/30">
          {isFullscreen ? "↙" : "↗"}
        </button>
      </div>

      <div className="h-7 flex items-center justify-center">
        {msg && <div className="text-lg font-bold text-yellow-300 drop-shadow-lg">{msg}</div>}
        {!msg && nearGas && !bubble && !finished && !outOfGas && (
          <div className="text-xs font-semibold text-white bg-black/40 px-3 py-1 rounded-full">Press Space to refuel! ⛽</div>
        )}
        {!msg && nearLoc && !nearGas && !bubble && !finished && (
          <div className="text-xs font-semibold text-white bg-black/40 px-3 py-1 rounded-full">
            Press Space to talk to {nearLoc.label}! {nearLoc.emoji}
          </div>
        )}
      </div>

      {/* Landscape hint */}
      <div className="block sm:hidden landscape:hidden text-center bg-yellow-400/90 text-blue-900 text-xs font-bold px-3 py-1.5 rounded-full mb-1 animate-pulse">
        📱 Rotate your phone sideways for a better view!
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="w-full" style={{ maxWidth: CW }}>
      <div style={{ height: CH * scale, overflow: 'hidden' }}>
      <div className="relative rounded-xl border-4 border-white/30 overflow-hidden"
        style={{ width: CW, height: CH, background: "#4ADE80", transform: `scale(${scale})`, transformOrigin: 'top left', touchAction: 'none' }}>
        {/* Grass */}
        <div className="absolute inset-0" style={{
          backgroundImage: "radial-gradient(circle, rgba(34,197,94,0.3) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }} />

        {/* Road */}
        {trackRoad}
        {trackDashes}

        {/* Locations */}
        {track.locations.map((loc) => {
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

        {/* Gas Station */}
        <div className={`absolute rounded-lg flex flex-col items-center justify-center ${fuel <= 20 ? "animate-pulse ring-4 ring-red-400" : ""}`}
          style={{
            left: track.gasStation.x, top: track.gasStation.y,
            width: track.gasStation.w, height: track.gasStation.h,
            backgroundColor: "#374151", border: "3px solid #F59E0B",
            boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
          }}>
          <div className="text-xl">⛽</div>
          <div className="text-white text-[8px] font-bold">Gas Station</div>
        </div>

        {/* Interaction bubble */}
        {bubble && (() => {
          const loc = track.locations.find((l) => l.id === bubble.locId);
          if (!loc) return null;
          const bx = Math.max(5, Math.min(loc.x + loc.w / 2 - 100, CW - 210));
          const by = loc.y - 65 >= 5 ? loc.y - 65 : loc.y + loc.h + 10;
          return (
            <div className="absolute bg-white rounded-xl px-3 py-2 shadow-lg border-2 border-yellow-400 z-30 max-w-[200px]"
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
            filter: "drop-shadow(0 0 4px rgba(255,255,0,0.6))",
          }}>{c.emoji}</div>
        ))}

        {/* Race car */}
        <div className="absolute z-20" style={{
          left: pos.x, top: pos.y, width: CAR_W, height: CAR_H,
          transform: `rotate(${angle + 90}deg)`, transformOrigin: "center center",
          filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.4))",
        }}>
          <RaceCar color={pup.color} darkColor={pup.darkColor} accent={pup.accentColor} num={pup.number} />
        </div>

        {/* Honk */}
        {honking && (
          <div className="absolute text-2xl font-bold text-yellow-300 animate-ping pointer-events-none z-30"
            style={{ left: pos.x - 10, top: pos.y - 25, textShadow: "0 0 8px rgba(255,255,0,0.8)" }}>
            BEEP!
          </div>
        )}

        {/* Out of gas */}
        {outOfGas && !finished && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-40">
            <div className="text-6xl mb-4">⛽</div>
            <div className="text-3xl font-bold text-red-400 mb-2">Out of Gas!</div>
            <div className="text-lg text-white mb-4">
              {nearGas ? "Press Space to refuel!" : "Oh no! You ran out of fuel!"}
            </div>
            <button onClick={() => startPlaying(track, pup)}
              className="bg-yellow-500 text-black px-6 py-3 rounded-full text-lg font-bold hover:bg-yellow-400 transition-colors">
              Try Again
            </button>
          </div>
        )}

        {/* Finish */}
        {finished && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-40">
            <div className="text-6xl mb-4 animate-bounce">🏆</div>
            <div className="text-4xl font-bold text-yellow-300 mb-2" style={{ textShadow: "0 0 20px rgba(255,255,0,0.5)" }}>
              Patrol Complete!
            </div>
            <div className="text-2xl text-white mb-1">Final Score: {score}</div>
            <div className="text-lg text-white/80 mb-3">
              {pup.name} finished the {track.name}!
            </div>
            <div className="flex gap-3 text-3xl mb-3">
              {track.locations.map((l) => <span key={l.id} title={l.label}>{l.emoji}</span>)}
            </div>
            <div className="text-white text-lg mb-3">No job is too big, no pup is too small! 🐾</div>
            <button onClick={() => startPlaying(track, pup)}
              className="bg-green-500 text-white px-6 py-3 rounded-full text-xl font-bold hover:bg-green-600 transition-colors">
              Race Again!
            </button>
            <button onClick={() => setPhase("track")}
              className="text-white/70 text-sm mt-3 hover:text-white">
              Change track or pup
            </button>
          </div>
        )}
      </div>
      </div>
      </div>

      {/* Touch Controls */}
      <div className="flex justify-between items-start mt-2 w-full select-none" style={{ maxWidth: CW * scale, touchAction: 'none' }}>
        <div className="flex gap-2">
          <button className="w-14 h-14 rounded-2xl bg-white/20 text-2xl text-white active:bg-white/40"
            onPointerDown={(e) => { e.preventDefault(); keysRef.current.add("ArrowLeft"); }}
            onPointerUp={() => keysRef.current.delete("ArrowLeft")}
            onPointerLeave={() => keysRef.current.delete("ArrowLeft")}
            onPointerCancel={() => keysRef.current.delete("ArrowLeft")}
          >◀</button>
          <button className="w-14 h-14 rounded-2xl bg-white/20 text-2xl text-white active:bg-white/40"
            onPointerDown={(e) => { e.preventDefault(); keysRef.current.add("ArrowRight"); }}
            onPointerUp={() => keysRef.current.delete("ArrowRight")}
            onPointerLeave={() => keysRef.current.delete("ArrowRight")}
            onPointerCancel={() => keysRef.current.delete("ArrowRight")}
          >▶</button>
        </div>
        <button className="w-14 h-14 rounded-2xl bg-yellow-500/40 text-xl text-white active:bg-yellow-500/60 font-bold"
          onPointerDown={(e) => { e.preventDefault(); handleAction(); }}
        >ACT</button>
        <div className="flex gap-2">
          <button className="w-14 h-14 rounded-2xl bg-green-500/30 text-2xl text-white active:bg-green-500/50"
            onPointerDown={(e) => { e.preventDefault(); keysRef.current.add("ArrowUp"); }}
            onPointerUp={() => keysRef.current.delete("ArrowUp")}
            onPointerLeave={() => keysRef.current.delete("ArrowUp")}
            onPointerCancel={() => keysRef.current.delete("ArrowUp")}
          >▲</button>
          <button className="w-14 h-14 rounded-2xl bg-red-500/30 text-2xl text-white active:bg-red-500/50"
            onPointerDown={(e) => { e.preventDefault(); keysRef.current.add("ArrowDown"); }}
            onPointerUp={() => keysRef.current.delete("ArrowDown")}
            onPointerLeave={() => keysRef.current.delete("ArrowDown")}
            onPointerCancel={() => keysRef.current.delete("ArrowDown")}
          >▼</button>
        </div>
      </div>

      <div className="mt-2 text-white/70 text-xs text-center max-sm:hidden">
        Arrow keys / WASD to drive. Space to interact & refuel. Collect everything & visit all locations!
      </div>
    </div>
  );
}
