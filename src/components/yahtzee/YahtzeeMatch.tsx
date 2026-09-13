import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useUser } from "@clerk/tanstack-react-start";
import { motion, LayoutGroup } from "framer-motion";
import { useApi, type MatchView, type YahtzeeCategory } from "@/lib/api";
import { useClerkIdentity } from "@/lib/identity";
import { RulesDialog } from "@/components/game/RulesDialog";
import { YahtzeeDie } from "./YahtzeeDie";
import { YahtzeeScorecard } from "./YahtzeeScorecard";
import { YahtzeeResultsDialog } from "./YahtzeeResultsDialog";
import { ComboCallout } from "./ComboCallout";
import { arrangeDice, bestCallableCombo, COMBO_RANK, type ComboKind, type TableDie } from "@/lib/yahtzee/combos";

function botStepDelay(match: MatchView): number {
  const last = match.lastAction;
  if (last === "open") return 2200;
  if (last === "roll") return 1700;
  if (last === "hold") return 600;
  if (last === "score") return 1100;
  return 1800;
}

function displayName(match: MatchView, userId: string, self: string): string {
  if (userId === self) return "You";
  return match.usernames?.[userId] ?? userId.slice(0, 6);
}

export function YahtzeeMatch({ matchId }: { matchId: string }) {
  const { user } = useUser();
  const userId = user?.id ?? "";
  const api = useApi();
  const qc = useQueryClient();
  const identity = useClerkIdentity();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [held, setHeld] = useState<boolean[]>([false, false, false, false, false]);
  const [comboBurst, setComboBurst] = useState<ComboKind | null>(null);
  const comboSeen = useRef({ turn: -1, rank: 0 });
  const [spinning, setSpinning] = useState<boolean[]>([false, false, false, false, false]);
  const lastSpinKey = useRef("");
  const [settledSpinKey, setSettledSpinKey] = useState("");
  const settledLayout = useRef<{
    kept: number[];
    rolling: number[];
    showAllKept: boolean;
  }>({ kept: [], rolling: [0, 1, 2, 3, 4], showAllKept: false });

  const query = useQuery({
    queryKey: ["match", matchId],
    queryFn: () => api<MatchView>(`/matches/${matchId}`),
    refetchInterval: 1500,
    enabled: Boolean(matchId),
  });
  const match = query.data;

  const storedName = match?.usernames?.[userId] ?? null;
  const storedAvatar = match?.avatars?.[userId] ?? null;
  const isPlayer = Boolean(userId) && Array.isArray(match?.players) && match!.players.includes(userId);
  const needsRefresh =
    isPlayer &&
    ((identity.displayName && identity.displayName !== storedName) ||
      (identity.avatarUrl && identity.avatarUrl !== storedAvatar));
  useEffect(() => {
    if (!needsRefresh) return;
    let cancelled = false;
    api<MatchView>(`/matches/${matchId}/identify`, {
      method: "POST",
      body: { displayName: identity.displayName, avatarUrl: identity.avatarUrl },
    })
      .then((data) => {
        if (!cancelled) qc.setQueryData(["match", matchId], data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsRefresh, matchId, identity.displayName, identity.avatarUrl]);

  useEffect(() => {
    if (!match || match.status !== "in-progress") return;
    if (match.lastAction !== "roll" && match.lastAction !== "open") return;
    const key = `${match.turn}-${match.rollSeq}-${match.lastAction}`;
    if (key === lastSpinKey.current) return;
    lastSpinKey.current = key;
    const mask = (match.dice ?? [1, 1, 1, 1, 1]).map(
      (_, i) => match.lastAction === "open" || !match.held?.[i],
    );
    setSpinning(mask);
    const t = setTimeout(() => {
      setSpinning([false, false, false, false, false]);
      setSettledSpinKey(key);
    }, 720);
    return () => clearTimeout(t);
  }, [match?.rollSeq, match?.turn, match?.lastAction, match?.status]);

  useEffect(() => {
    if (!match?.held) return;
    if (spinning.some(Boolean)) return;
    setHeld(match.held.map(Boolean));
  }, [match?.dice?.join(","), match?.rollsUsed, match?.turn, match?.held?.join(","), spinning]);

  useEffect(() => {
    if (!match?.dice || match.status !== "in-progress") return;
    if (spinning.some(Boolean)) return;
    const spinKey = `${match.turn}-${match.rollSeq}-${match.lastAction}`;
    if (
      (match.lastAction === "roll" || match.lastAction === "open") &&
      spinKey !== settledSpinKey
    ) {
      return;
    }
    const card = match.scorecards?.[match.currentPlayer ?? match._order?.[(match.turn ?? 0) % (match._order?.length || 1)] ?? ""];
    const next = bestCallableCombo(match.dice, card);
    const rank = next ? COMBO_RANK[next] : 0;
    if ((match.turn ?? 0) !== comboSeen.current.turn) {
      comboSeen.current = { turn: match.turn ?? 0, rank: 0 };
    }
    if (!next || rank <= comboSeen.current.rank) return;
    comboSeen.current = { turn: match.turn ?? 0, rank };
    setComboBurst(next);
    const t = setTimeout(() => setComboBurst(null), next === "yahtzee" ? 2400 : 1700);
    return () => clearTimeout(t);
  }, [match?.dice?.join(","), match?.rollSeq, match?.turn, match?.status, match?.scorecards, match?.currentPlayer, spinning, settledSpinKey]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["match", matchId] });

  const startMut = useMutation({
    mutationFn: () => api<MatchView>(`/matches/${matchId}/start`, { method: "POST" }),
    onSuccess: (data) => qc.setQueryData(["match", matchId], data),
  });
  const actionMut = useMutation({
    mutationFn: (action: unknown) =>
      api<MatchView>(`/matches/${matchId}/action`, { method: "POST", body: action }),
    onSuccess: (data) => {
      qc.setQueryData(["match", matchId], data);
      setError(null);
    },
    onError: (e: unknown) => setError((e as Error).message ?? "Move failed"),
  });
  const playAgainMut = useMutation({
    mutationFn: () => api<MatchView>(`/matches/${matchId}/play-again`, { method: "POST" }),
    onSuccess: (data) => {
      if (data && data.matchId !== matchId) {
        qc.removeQueries({ queryKey: ["match", matchId] });
        navigate({ to: "/match/$matchId", params: { matchId: data.matchId } });
      } else invalidate();
    },
  });

  const currentTurn = match?._order?.[(match?.turn ?? 0) % (match?._order?.length || 1)];
  const aiSet = new Set(match?.aiPlayers ?? []);
  const shouldStepAI = Boolean(
    match?.status === "in-progress" && currentTurn && aiSet.has(currentTurn),
  );
  useEffect(() => {
    if (!shouldStepAI) return;
    const t = setTimeout(() => {
      api<MatchView>(`/matches/${matchId}/ai-step`, { method: "POST" })
        .then((data) => qc.setQueryData(["match", matchId], data))
        .catch(() => {});
    }, match ? botStepDelay(match) : 1800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldStepAI, currentTurn, match?.rollsUsed, match?.dice?.join(","), match?.lastAction, matchId]);

  if (!match) {
    return <div className="p-8 text-white/70">Loading match…</div>;
  }

  if (match.status === "open") {
    const canStart = match.players.length >= (match.minPlayers ?? 1);
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-emerald-950 via-slate-950 to-amber-950 text-white p-6">
        <div className="max-w-2xl mx-auto space-y-5">
          <h1 className="text-3xl font-black tracking-tight">Yahtzee</h1>
          <p className="text-white/60">
            Table code <span className="font-mono text-white">{match.code ?? "—"}</span>
          </p>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
            <div className="text-sm text-white/60">Players ({match.players.length})</div>
            {match.players.map((p) => (
              <div key={p} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{displayName(match, p, userId)}</span>
                {aiSet.has(p) && <span className="text-xs text-amber-300">(bot)</span>}
              </div>
            ))}
          </div>
          {match.createdBy === userId && (
            <button
              className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-40 font-semibold"
              disabled={!canStart || startMut.isPending}
              onClick={() => startMut.mutate()}
            >
              {startMut.isPending ? "Starting…" : canStart ? "Start match" : `Need ${match.minPlayers ?? 1}+ players`}
            </button>
          )}
        </div>
      </div>
    );
  }

  const myTurn = currentTurn === userId && match.status === "in-progress";
  const dice = match.dice ?? [1, 1, 1, 1, 1];
  const rollsLeft = match.rollsLeft ?? Math.max(0, 3 - (match.rollsUsed ?? 0));
  const order = match._order ?? match.players;
  const busy = actionMut.isPending;
  const isSpinning = spinning.some(Boolean);
  const incomingSpinKey =
    match.lastAction === "roll" || match.lastAction === "open"
      ? `${match.turn}-${match.rollSeq}-${match.lastAction}`
      : settledSpinKey;
  const freezeLayout = isSpinning || incomingSpinKey !== settledSpinKey;

  const toggleHold = (i: number) => {
    if (!myTurn || rollsLeft <= 0 || busy || freezeLayout) return;
    setHeld((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  };

  const doRoll = () => {
    if (!myTurn || rollsLeft <= 0 || busy || freezeLayout) return;
    setSpinning(held.map((h) => !h));
    actionMut.mutate({ type: "roll", held });
  };

  const doScore = (category: YahtzeeCategory) => {
    if (!myTurn || busy || freezeLayout) return;
    actionMut.mutate({ type: "score", category });
  };

  const tableDice: TableDie[] = dice.map((face, index) => ({ face, index }));
  const showAllKept = freezeLayout ? settledLayout.current.showAllKept : rollsLeft <= 0;
  const kept = freezeLayout
    ? settledLayout.current.kept.map((index) => tableDice[index]).filter(Boolean)
    : arrangeDice(tableDice.filter((d) => showAllKept || held[d.index]));
  const rolling = freezeLayout
    ? settledLayout.current.rolling.map((index) => tableDice[index]).filter(Boolean)
    : arrangeDice(tableDice.filter((d) => !showAllKept && !held[d.index]));
  if (!freezeLayout) {
    settledLayout.current = {
      kept: kept.map((d) => d.index),
      rolling: rolling.map((d) => d.index),
      showAllKept,
    };
  }
  const canToggle = myTurn && rollsLeft > 0 && !busy && !freezeLayout;

  return (
    <div
      className="min-h-[100dvh] text-white flex flex-col"
      style={{
        background:
          "radial-gradient(900px 500px at 50% -80px, rgba(251,191,36,0.18), transparent 55%), radial-gradient(700px 380px at 80% 110%, rgba(16,185,129,0.18), transparent 50%), linear-gradient(180deg, #052e1f 0%, #07140f 100%)",
      }}
    >
      <div className="flex items-center justify-between px-4 py-2 text-sm border-b border-white/10 bg-black/30">
        <div className="flex items-center gap-3">
          <span className="font-black text-amber-300 tracking-wide">YAHTZEE</span>
          <span className="text-white/40">Code {match.code}</span>
          <span className="text-white/50">Turn {match.round ?? 1}/13</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="text-xs text-white/60 hover:text-white underline-offset-2 hover:underline"
            onClick={() => setRulesOpen(true)}
          >
            Rules
          </button>
          {match.status === "in-progress" &&
            (myTurn ? (
              <span className="text-emerald-300 font-semibold">Your turn</span>
            ) : (
              <span>{displayName(match, currentTurn ?? "", userId)}&apos;s turn</span>
            ))}
          {match.status === "complete" && (
            <span className="text-amber-300 font-semibold">
              {match.winner === userId ? "You won!" : `${displayName(match, match.winner ?? "", userId)} won`}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 p-4 max-w-6xl mx-auto w-full">
        <div className="flex flex-col">
          <div className="flex gap-2 overflow-x-auto pb-3">
            {order.map((p) => {
              const isTurn = p === currentTurn && match.status === "in-progress";
              const total = match.cardTotals?.[p] ?? match.scores?.[p] ?? 0;
              const upper = match.upperSums?.[p] ?? 0;
              const bonus = match.upperBonuses?.[p] ?? 0;
              return (
                <div
                  key={p}
                  className={`min-w-[140px] rounded-2xl px-3 py-2 border ${
                    isTurn ? "border-amber-400/70 bg-amber-400/10" : "border-white/10 bg-black/20"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    <span className="truncate">{displayName(match, p, userId)}</span>
                    {aiSet.has(p) && <span className="text-[10px] text-amber-300 font-normal">bot</span>}
                  </div>
                  <div className="text-2xl font-black tabular-nums text-amber-200">{total}</div>
                  <div className="text-[11px] text-white/55">
                    Upper {upper}/63{bonus ? " · +35" : ""}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative flex flex-1 flex-col items-center justify-center overflow-visible rounded-3xl border border-emerald-500/20 bg-emerald-950/40 px-4 py-6">
            <ComboCallout combo={comboBurst} />
            <div className="mb-2 text-xs uppercase tracking-[0.2em] text-emerald-200/70">
              {rollsLeft === 2 ? "First reroll" : rollsLeft === 1 ? "Last reroll" : rollsLeft === 0 ? "Score this roll" : "Roll"}
            </div>
            <LayoutGroup>
              <div className="w-full max-w-lg rounded-2xl border border-amber-400/25 bg-amber-400/5 px-3 py-3">
                <div className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/80">
                  Keep
                </div>
                <div className="flex min-h-[4.75rem] flex-wrap items-center justify-center gap-3 py-1 sm:gap-4">
                  {kept.map((d) => (
                    <motion.div
                      key={d.index}
                      layout={!freezeLayout}
                      layoutId={`yz-die-${d.index}`}
                      initial={false}
                      transition={{ type: "spring", stiffness: 380, damping: 22 }}
                    >
                      <YahtzeeDie
                        face={d.face}
                        held
                        spinning={spinning[d.index]}
                        disabled={!canToggle}
                        onClick={() => toggleHold(d.index)}
                      />
                    </motion.div>
                  ))}
                  {kept.length === 0 && (
                    <span className="text-sm text-amber-100/40">Tap dice below to keep them</span>
                  )}
                </div>
              </div>
              <div className="mt-6 w-full max-w-lg">
                <div className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                  {showAllKept ? "All dice locked this turn" : "Roll"}
                </div>
                <div className="flex min-h-[4.75rem] flex-wrap items-center justify-center gap-3 py-1 sm:gap-4">
                  {rolling.map((d) => (
                    <motion.div
                      key={d.index}
                      layout={!freezeLayout}
                      layoutId={`yz-die-${d.index}`}
                      initial={false}
                      transition={{ type: "spring", stiffness: 380, damping: 22 }}
                    >
                      <YahtzeeDie
                        face={d.face}
                        held={false}
                        spinning={spinning[d.index]}
                        disabled={!canToggle}
                        onClick={() => toggleHold(d.index)}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            </LayoutGroup>
            <p className="mt-5 text-sm text-white/60">
              {myTurn
                ? rollsLeft > 0
                  ? "Keep dice move to the top row, grouped by the best pattern."
                  : "Choose a box on the scorecard."
                : `Waiting for ${displayName(match, currentTurn ?? "", userId)}…`}
            </p>
            <button
              className="mt-5 px-8 py-3 rounded-2xl bg-amber-400 text-slate-950 font-black tracking-wide disabled:opacity-35 hover:bg-amber-300"
              disabled={!myTurn || rollsLeft <= 0 || busy || freezeLayout}
              onClick={doRoll}
            >
              {busy || freezeLayout ? "Rolling…" : rollsLeft > 0 ? `Roll (${rollsLeft} left)` : "No rerolls left"}
            </button>
            {error && <div className="mt-3 text-sm text-rose-300">{error}</div>}
          </div>
        </div>

        <YahtzeeScorecard
          match={match}
          userId={userId}
          myTurn={myTurn}
          disabled={busy || !myTurn || freezeLayout}
          onScore={doScore}
        />
      </div>

      {match.status === "complete" && (
        <YahtzeeResultsDialog
          match={match}
          userId={userId}
          onPlayAgain={() => playAgainMut.mutate()}
          playAgainPending={playAgainMut.isPending}
        />
      )}

      <RulesDialog
        open={rulesOpen}
        onOpenChange={setRulesOpen}
        onDontShowAgain={() => setRulesOpen(false)}
        gameId="yahtzee"
      />
    </div>
  );
}

export default YahtzeeMatch;
