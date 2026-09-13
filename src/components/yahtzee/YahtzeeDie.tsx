import { useEffect, useState } from "react";

const PIPS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};

export function YahtzeeDie({
  face,
  held,
  disabled,
  spinning,
  onClick,
}: {
  face: number;
  held?: boolean;
  disabled?: boolean;
  spinning?: boolean;
  onClick?: () => void;
}) {
  const [shown, setShown] = useState(face);
  useEffect(() => {
    if (!spinning) {
      setShown(face);
      return;
    }
    setShown(1 + Math.floor(Math.random() * 6));
    const t = setInterval(() => {
      setShown(1 + Math.floor(Math.random() * 6));
    }, 70);
    return () => clearInterval(t);
  }, [spinning, face]);

  const pips = PIPS[shown] ?? PIPS[1];
  return (
    <button
      type="button"
      disabled={disabled || spinning}
      onClick={onClick}
      aria-label={`Die showing ${face}${held ? ", kept" : ""}${spinning ? ", rolling" : ""}`}
      className={`relative h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem] rounded-2xl shadow-lg
        ${held ? "bg-amber-100 ring-2 ring-amber-400" : "bg-white"}
        ${disabled || spinning ? "cursor-default" : "cursor-pointer hover:-translate-y-0.5"}
      `}
    >
      {pips.map(([x, y], i) => (
        <span
          key={`${shown}-${i}`}
          className="absolute h-2.5 w-2.5 sm:h-3 sm:w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900"
          style={{ left: `${x}%`, top: `${y}%` }}
        />
      ))}
    </button>
  );
}
