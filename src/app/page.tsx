import Link from "next/link";

const games = [
  {
    name: "Paw Patrol Blocks",
    description: "Stack blocks to build the Lookout Tower! Match pups for combos!",
    path: "/blocks",
    emoji: "🏗️",
    color: "from-blue-500 to-blue-700",
  },
  {
    name: "Paw Patrol Lego",
    description: "Build awesome Paw Patrol creations with colorful LEGO bricks!",
    path: "/lego",
    emoji: "🧱",
    color: "from-red-500 to-red-700",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-12">
      <h1
        className="text-5xl font-bold text-white mb-2 drop-shadow-lg"
        style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.3)" }}
      >
        🐾 James&apos;s Games 🐾
      </h1>
      <p className="text-xl text-white/80 mb-10">Pick a game to play!</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl w-full">
        {games.map((game) => (
          <Link
            key={game.path}
            href={game.path}
            className={`bg-gradient-to-br ${game.color} rounded-2xl p-8 text-white shadow-xl hover:scale-105 transition-transform border-4 border-white/20`}
          >
            <div className="text-5xl mb-4">{game.emoji}</div>
            <h2 className="text-2xl font-bold mb-2">{game.name}</h2>
            <p className="text-white/80">{game.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
