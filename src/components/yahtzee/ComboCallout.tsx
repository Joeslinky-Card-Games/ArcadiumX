import { AnimatePresence, motion } from "framer-motion";
import { COMBO_LABEL, type ComboKind } from "@/lib/yahtzee/combos";

const TONE: Record<ComboKind, string> = {
  yahtzee: "text-amber-300 drop-shadow-[0_0_28px_rgba(251,191,36,0.85)]",
  fourKind: "text-orange-300 drop-shadow-[0_0_18px_rgba(251,146,60,0.7)]",
  fullHouse: "text-emerald-300 drop-shadow-[0_0_18px_rgba(52,211,153,0.7)]",
  largeStraight: "text-sky-300 drop-shadow-[0_0_18px_rgba(125,211,252,0.7)]",
  smallStraight: "text-teal-200 drop-shadow-[0_0_16px_rgba(94,234,212,0.6)]",
  threeKind: "text-amber-100 drop-shadow-[0_0_12px_rgba(254,243,199,0.5)]",
};

export function ComboCallout({ combo }: { combo: ComboKind | null }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden">
      <AnimatePresence>
        {combo && (
          <motion.div
            key={combo}
            initial={{ opacity: 0, scale: 0.55, y: 18, rotate: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
            exit={{ opacity: 0, scale: 1.15, y: -12 }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
            className={`px-4 text-center font-black uppercase tracking-[0.12em] ${TONE[combo]} ${
              combo === "yahtzee" ? "text-5xl sm:text-7xl" : "text-3xl sm:text-5xl"
            }`}
          >
            {COMBO_LABEL[combo]}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
