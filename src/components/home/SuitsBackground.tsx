import { useMemo } from "react";

const SUITS = ["♠", "♥", "♦", "♣"] as const;

type Particle = {
  suit: (typeof SUITS)[number];
  left: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  rotate: number;
  opacity: number;
};

function seededParticles(count: number): Particle[] {
  // Deterministic layout so SSR and client match.
  const rand = (i: number, salt: number) => {
    const x = Math.sin(i * 928.371 + salt * 13.17) * 43758.5453;
    return x - Math.floor(x);
  };
  return Array.from({ length: count }, (_, i) => {
    const suit = SUITS[i % SUITS.length];
    return {
      suit,
      left: rand(i, 1) * 100,
      size: 22 + rand(i, 2) * 44,
      delay: -rand(i, 3) * 22,
      duration: 18 + rand(i, 4) * 18,
      drift: (rand(i, 5) - 0.5) * 120,
      rotate: (rand(i, 6) - 0.5) * 60,
      opacity: 0.06 + rand(i, 7) * 0.14,
    };
  });
}

export function SuitsBackground() {
  const particles = useMemo(() => seededParticles(28), []);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* Radial glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at top, color-mix(in oklab, var(--primary) 18%, transparent), transparent 60%), radial-gradient(ellipse at bottom, color-mix(in oklab, var(--primary) 10%, transparent), transparent 55%)",
        }}
      />

      {particles.map((p, i) => {
        const isRed = p.suit === "♥" || p.suit === "♦";
        return (
          <span
            key={i}
            className={`suit-particle absolute bottom-[-10%] select-none font-semibold ${
              isRed ? "text-rose-400" : "text-foreground"
            }`}
            style={{
              left: `${p.left}%`,
              fontSize: `${p.size}px`,
              opacity: p.opacity,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              // custom props consumed by the keyframes
              ["--drift" as string]: `${p.drift}px`,
              ["--rot" as string]: `${p.rotate}deg`,
            }}
          >
            {p.suit}
          </span>
        );
      })}
    </div>
  );
}