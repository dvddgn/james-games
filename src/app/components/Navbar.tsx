"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const games = [
  { name: "Home", path: "/", emoji: "🏠" },
  { name: "Paw Patrol Blocks", path: "/blocks", emoji: "🏗️" },
  { name: "Paw Patrol Lego", path: "/lego", emoji: "🧱" },
  { name: "Paw Patrol Driving", path: "/driving", emoji: "🚗" },
  { name: "Boats", path: "/boats", emoji: "🚢" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-blue-900/95 backdrop-blur-sm border-b-4 border-yellow-400 shadow-lg">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center h-14 gap-1">
          <span className="text-2xl font-bold text-white mr-4 whitespace-nowrap">
            🐾 James&apos;s Games
          </span>
          <div className="flex gap-1 overflow-x-auto">
            {games.map((game) => {
              const isActive = pathname === game.path;
              return (
                <Link
                  key={game.path}
                  href={game.path}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-yellow-400 text-blue-900"
                      : "text-white hover:bg-white/20"
                  }`}
                >
                  {game.emoji} {game.name}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
