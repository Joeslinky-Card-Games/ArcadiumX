import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { MatchView } from "@/lib/api";

function displayName(match: MatchView, userId: string, self: string): string {
  if (userId === self) return "You";
  return match.usernames?.[userId] ?? userId.slice(0, 6);
}

export function YahtzeeResultsDialog({
  match,
  userId,
  onPlayAgain,
  playAgainPending,
}: {
  match: MatchView;
  userId: string;
  onPlayAgain: () => void;
  playAgainPending: boolean;
}) {
  const navigate = useNavigate();
  const scores = match.scores ?? match.cardTotals ?? {};
  const ranked = [...(match._order ?? match.players)].sort(
    (a, b) => (scores[b] ?? 0) - (scores[a] ?? 0),
  );
  const winners = match.winners?.length ? match.winners : match.winner ? [match.winner] : [];
  const tied = winners.length > 1;
  const youWon = winners.includes(userId);
  const aiSet = new Set(match.aiPlayers ?? []);
  const humans = match.players.filter((p) => !aiSet.has(p) && !String(p).startsWith("ai-"));
  const votes = new Set(match.playAgain ?? []);
  const myVote = votes.has(userId);
  const votedCount = humans.filter((p) => votes.has(p)).length;
  const headline = tied
    ? "It's a tie!"
    : youWon
      ? "You win!"
      : `${displayName(match, winners[0] ?? "", userId)} wins`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 250, damping: 20 }}
        className="w-full max-w-md rounded-2xl border border-amber-300/30 bg-gradient-to-br from-emerald-950 to-emerald-900 p-6 text-white shadow-2xl"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/70">
          Match complete
        </p>
        <h2 className="mt-1 font-serif text-3xl font-bold text-amber-100">{headline}</h2>
        <p className="mt-2 text-sm text-white/70">
          Highest score wins. Gamerscore, wins, and points are saved to your profile
          like other ArcadiumX games.
        </p>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-amber-200/70">
              <th className="py-1">Player</th>
              <th className="text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((p, i) => {
              const isWin = winners.includes(p);
              return (
                <tr key={p} className="border-t border-white/10">
                  <td className="py-1.5">
                    <span className={isWin ? "font-semibold text-amber-100" : "text-white/85"}>
                      {i + 1}. {displayName(match, p, userId)}
                    </span>
                    {aiSet.has(p) && (
                      <span className="ml-1 text-[10px] uppercase tracking-wider text-amber-300/80">
                        bot
                      </span>
                    )}
                    {isWin && !tied && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-emerald-300">
                        winner
                      </span>
                    )}
                  </td>
                  <td className="text-right font-semibold tabular-nums text-amber-200">
                    {scores[p] ?? 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-6 flex items-start justify-end gap-2">
          <div className="mr-auto text-left text-xs text-white/70">
            <div className="font-semibold uppercase tracking-widest text-amber-200/70">
              Play again — {votedCount}/{humans.length} ready
            </div>
            <ul className="mt-1 space-y-0.5">
              {humans.map((p) => (
                <li key={p} className="flex items-center gap-1.5">
                  <span
                    className={
                      votes.has(p)
                        ? "inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"
                        : "inline-block h-1.5 w-1.5 rounded-full bg-white/25"
                    }
                  />
                  <span className={votes.has(p) ? "text-emerald-200" : "text-white/60"}>
                    {displayName(match, p, userId)}
                    {votes.has(p) ? " · ready" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <button
            onClick={() => navigate({ to: "/lobby" })}
            className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
          >
            Lobby
          </button>
          <button
            onClick={onPlayAgain}
            disabled={myVote || playAgainPending}
            className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-amber-300 disabled:opacity-50"
          >
            {myVote ? "Waiting…" : playAgainPending ? "Voting…" : "Play again"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
