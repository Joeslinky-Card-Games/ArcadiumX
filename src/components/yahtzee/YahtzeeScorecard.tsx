import type { MatchView, YahtzeeCard, YahtzeeCategory } from "@/lib/api";

const UPPER: YahtzeeCategory[] = ["ones", "twos", "threes", "fours", "fives", "sixes"];
const LOWER: YahtzeeCategory[] = [
  "threeKind",
  "fourKind",
  "fullHouse",
  "smallStraight",
  "largeStraight",
  "yahtzee",
  "chance",
];

const LABELS: Record<YahtzeeCategory, string> = {
  ones: "Aces",
  twos: "Twos",
  threes: "Threes",
  fours: "Fours",
  fives: "Fives",
  sixes: "Sixes",
  threeKind: "3 of a Kind",
  fourKind: "4 of a Kind",
  fullHouse: "Full House",
  smallStraight: "Sm. Straight",
  largeStraight: "Lg. Straight",
  yahtzee: "Yahtzee",
  chance: "Chance",
};

function displayName(match: MatchView, userId: string, self: string): string {
  if (userId === self) return "You";
  return match.usernames?.[userId] ?? userId.slice(0, 6);
}

function Row({
  cat,
  match,
  userId,
  myTurn,
  disabled,
  onScore,
}: {
  cat: YahtzeeCategory;
  match: MatchView;
  userId: string;
  myTurn: boolean;
  disabled: boolean;
  onScore: (c: YahtzeeCategory) => void;
}) {
  const order = match._order ?? match.players;
  const pot = match.potentials?.[cat];
  return (
    <tr className="border-t border-white/10">
      <th className="py-1.5 pr-2 text-left text-xs font-medium text-white/80">{LABELS[cat]}</th>
      {order.map((p) => {
        const card = match.scorecards?.[p] as YahtzeeCard | undefined;
        const filled = card?.[cat];
        const isMe = p === userId;
        const canScore =
          myTurn && isMe && filled == null && pot?.legal && match.status === "in-progress" && !disabled;
        const showPotential = canScore && pot?.potential != null;
        const joker =
          Boolean(match.dice?.length === 5 && match.dice.every((d) => d === match.dice![0])) &&
          (match.scorecards?.[userId]?.yahtzee != null);
        return (
          <td key={p} className="px-1 py-1 text-center">
            {canScore ? (
              <button
                type="button"
                onClick={() => onScore(cat)}
                className={`w-full rounded-md px-1 py-0.5 text-sm font-semibold tabular-nums
                  ${joker ? "ring-2 ring-amber-300 ring-offset-1 ring-offset-transparent" : ""}
                  ${pot?.potential ? "bg-amber-400/20 text-amber-200 hover:bg-amber-400/35" : "bg-white/5 text-white/40 hover:bg-rose-400/20 hover:text-rose-200"}
                `}
              >
                {showPotential ? pot!.potential : "0"}
              </button>
            ) : (
              <span className={`text-sm tabular-nums ${filled == null ? "text-white/20" : "text-white"}`}>
                {filled == null ? "—" : filled}
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

export function YahtzeeScorecard({
  match,
  userId,
  myTurn,
  disabled,
  onScore,
}: {
  match: MatchView;
  userId: string;
  myTurn: boolean;
  disabled: boolean;
  onScore: (c: YahtzeeCategory) => void;
}) {
  const order = match._order ?? match.players;
  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 p-3 overflow-x-auto">
      <table className="w-full min-w-[240px] border-collapse">
        <thead>
          <tr>
            <th className="text-left text-[10px] uppercase tracking-wider text-white/40 pb-2">Scorecard</th>
            {order.map((p) => (
              <th key={p} className="px-1 pb-2 text-center text-[10px] uppercase tracking-wider text-white/50">
                {displayName(match, p, userId)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {UPPER.map((cat) => (
            <Row
              key={cat}
              cat={cat}
              match={match}
              userId={userId}
              myTurn={myTurn}
              disabled={disabled}
              onScore={onScore}
            />
          ))}
          <tr className="border-t border-white/20 bg-white/5">
            <th className="py-1.5 pr-2 text-left text-xs text-amber-200/90">Upper bonus</th>
            {order.map((p) => (
              <td key={p} className="px-1 text-center text-sm tabular-nums text-amber-200">
                {match.upperBonuses?.[p] ? 35 : match.upperSums?.[p] != null ? `${match.upperSums[p]}/63` : "—"}
              </td>
            ))}
          </tr>
          {LOWER.map((cat) => (
            <Row
              key={cat}
              cat={cat}
              match={match}
              userId={userId}
              myTurn={myTurn}
              disabled={disabled}
              onScore={onScore}
            />
          ))}
          <tr className="border-t border-white/20 bg-white/5">
            <th className="py-1.5 pr-2 text-left text-xs text-amber-200/90">Yahtzee bonus</th>
            {order.map((p) => (
              <td key={p} className="px-1 text-center text-sm tabular-nums text-amber-200">
                {match.scorecards?.[p]?.yahtzeeBonus ?? 0}
              </td>
            ))}
          </tr>
          <tr className="border-t-2 border-amber-400/40">
            <th className="py-2 pr-2 text-left text-sm font-bold">Total</th>
            {order.map((p) => (
              <td key={p} className="px-1 py-2 text-center text-lg font-black tabular-nums text-amber-100">
                {match.cardTotals?.[p] ?? match.scores?.[p] ?? 0}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
