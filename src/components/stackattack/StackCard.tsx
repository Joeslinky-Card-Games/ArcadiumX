import { motion } from "framer-motion";

export type StackCardValue = string | null | undefined; // "N7:3" | "W:5" | null (empty)

function parse(card: string) {
  if (card.startsWith("W:")) return { wild: true as const, rank: null as number | null };
  const m = /^N(\d+):/.exec(card);
  return { wild: false as const, rank: m ? Number(m[1]) : null };
}

// Twelve tiers, three chromatic bands. Low = teal, mid = amber, high = magenta.
function tierClasses(rank: number): { grad: string; ring: string; text: string } {
  if (rank <= 4) {
    return {
      grad: "from-teal-500 via-teal-600 to-cyan-700",
      ring: "ring-teal-300/40",
      text: "text-teal-50",
    };
  }
  if (rank <= 8) {
    return {
      grad: "from-amber-400 via-orange-500 to-rose-600",
      ring: "ring-amber-200/40",
      text: "text-amber-50",
    };
  }
  return {
    grad: "from-fuchsia-500 via-purple-600 to-indigo-700",
    ring: "ring-fuchsia-200/40",
    text: "text-fuchsia-50",
  };
}

type SizeKey = "xs" | "sm" | "md" | "lg";
const SIZES: Record<SizeKey, { w: string; h: string; rank: string; corner: string }> = {
  xs: { w: "w-8", h: "h-11", rank: "text-lg", corner: "text-[8px]" },
  sm: { w: "w-10", h: "h-14", rank: "text-xl", corner: "text-[9px]" },
  md: { w: "w-14", h: "h-20", rank: "text-3xl", corner: "text-[11px]" },
  lg: { w: "w-16", h: "h-24", rank: "text-4xl", corner: "text-xs" },
};

export function StackCard({
  card,
  displayRank,
  size = "md",
  selected = false,
  faded = false,
  onClick,
  label,
}: {
  card: string;
  displayRank?: number; // for cards on a build pile, show the effective rank
  size?: SizeKey;
  selected?: boolean;
  faded?: boolean;
  onClick?: () => void;
  label?: string;
}) {
  const info = parse(card);
  const s = SIZES[size];
  if (info.wild) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        whileTap={onClick ? { scale: 0.94 } : undefined}
        aria-label={label ?? (displayRank ? `Wild as ${displayRank}` : "Wild card")}
        className={`relative ${s.w} ${s.h} rounded-xl overflow-hidden shrink-0 shadow-lg
          bg-[conic-gradient(from_0deg,#0ea5e9,#a855f7,#f97316,#22c55e,#0ea5e9)]
          ring-2 ${selected ? "ring-white" : "ring-white/20"}
          ${faded ? "opacity-40" : ""}
          ${onClick ? "cursor-pointer hover:brightness-110" : ""}`}
      >
        <div className="absolute inset-[3px] rounded-lg bg-slate-950/70 flex items-center justify-center">
          <div className={`font-black tracking-tight text-white drop-shadow ${s.rank}`}>
            {displayRank ?? "★"}
          </div>
        </div>
        <span className={`absolute top-1 left-1 ${s.corner} font-bold text-white/90`}>W</span>
        <span className={`absolute bottom-1 right-1 ${s.corner} font-bold text-white/90`}>W</span>
      </motion.button>
    );
  }
  const rank = info.rank ?? 0;
  const t = tierClasses(rank);
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={onClick ? { scale: 0.94 } : undefined}
      aria-label={label ?? `Card ${rank}`}
      className={`relative ${s.w} ${s.h} rounded-xl overflow-hidden shrink-0 shadow-lg
        bg-gradient-to-br ${t.grad}
        ring-2 ${selected ? "ring-white" : `ring-white/10 ${t.ring}`}
        ${faded ? "opacity-40" : ""}
        ${onClick ? "cursor-pointer hover:brightness-110" : ""}`}
    >
      <div className={`absolute inset-0 flex items-center justify-center ${t.text}`}>
        <span className={`font-black tracking-tight drop-shadow ${s.rank}`}>{rank}</span>
      </div>
      <span className={`absolute top-1 left-1 ${s.corner} font-bold ${t.text}`}>{rank}</span>
      <span className={`absolute bottom-1 right-1 ${s.corner} font-bold ${t.text} rotate-180`}>
        {rank}
      </span>
    </motion.button>
  );
}

export function StackCardBack({ size = "md" }: { size?: SizeKey }) {
  const s = SIZES[size];
  return (
    <div
      className={`relative ${s.w} ${s.h} rounded-xl shrink-0 shadow-lg
        bg-gradient-to-br from-slate-800 via-slate-900 to-black
        ring-2 ring-white/10 overflow-hidden`}
    >
      <div className="absolute inset-1 rounded-lg border border-white/10
        bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.08),transparent_60%)]" />
      <div className="absolute inset-0 flex items-center justify-center text-white/40 font-black text-xs tracking-widest">
        SA
      </div>
    </div>
  );
}

export function EmptyStackSlot({ size = "md", label }: { size?: SizeKey; label?: string }) {
  const s = SIZES[size];
  return (
    <div
      className={`${s.w} ${s.h} rounded-xl shrink-0 border-2 border-dashed border-white/15
        flex items-center justify-center text-white/30 text-[10px] uppercase tracking-wider`}
    >
      {label ?? ""}
    </div>
  );
}

export function isWildCard(card: string): boolean {
  return card.startsWith("W:");
}
export function rankOfCard(card: string): number | null {
  if (isWildCard(card)) return null;
  const m = /^N(\d+):/.exec(card);
  return m ? Number(m[1]) : null;
}