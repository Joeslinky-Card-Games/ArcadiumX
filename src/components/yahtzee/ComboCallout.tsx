import { AnimatePresence, motion } from "framer-motion";
import { COMBO_LABEL, type ComboKind } from "@/lib/yahtzee/combos";

const TONE: Record<ComboKind, string> = {
  yahtzee: "text-amber-300",
  fourKind: "text-orange-300",
  fullHouse: "text-emerald-300",
  largeStraight: "text-sky-300",
  smallStraight: "text-teal-200",
  threeKind: "text-amber-100",
};

export function ComboCallout({ combo }: { combo: ComboKind | null }) {
  return (
    <div className="pointer-events-none flex h-14 w-full max-w-lg shrink-0 items-center justify-center overflow-hidden">
      <AnimatePresence mode="wait">
        {combo ? (
          <motion.p
            key={combo}
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            className={`px-3 text-center font-black uppercase leading-none tracking-[0.16em] ${TONE[combo]} ${
              combo === "yahtzee" ? "text-2xl sm:text-[1.75rem]" : "text-lg sm:text-xl"
            }`}
          >
            {COMBO_LABEL[combo]}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
