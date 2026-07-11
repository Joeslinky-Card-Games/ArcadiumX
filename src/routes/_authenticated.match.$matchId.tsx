import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useUser } from "@clerk/tanstack-react-start";
import { useApi, type GameAction, type MatchView } from "@/lib/api";
import { PlayingCard, CardBack, EmptyCardSlot } from "@/components/game/PlayingCard";
import { sortHand, cardPoints } from "@/lib/game/cards";

export const Route = createFileRoute("/_authenticated/match/$matchId")({
  head: () => ({
    meta: [
      { title: "Match — Card Table" },
      { name: "description", content: "Live Charlotte's Web match." },
    ],
  }),
  component: MatchPage,
});

function shortId(id: string): string {
  return id.length <= 8 ? id : id.slice(0, 4) + "…" + id.slice(-4);
}

function MatchPage() {
  const { matchId } = Route.useParams();
  const { user } = useUser();
  const userId = user?.id ?? "";
  const api = useApi();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["match", matchId],
    queryFn: () => api<MatchView>(`/matches/${matchId}`),
    refetchInterval: 2000,
    enabled: Boolean(matchId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["match", matchId] });

  const startMut = useMutation({
    mutationFn: () => api<MatchView>(`/matches/${matchId}/start`, { method: "POST" }),
    onSuccess: (data) => { qc.setQueryData(["match", matchId], data); },
  });
  const actionMut = useMutation({
    mutationFn: (action: GameAction) =>
      api<MatchView>(`/matches/${matchId}/action`, { method: "POST", body: action }),
    onSuccess: (data) => { qc.setQueryData(["match", matchId], data); },
  });
  const nextRoundMut = useMutation({
    mutationFn: () => api<MatchView>(`/matches/${matchId}/next-round`, { method: "POST" }),
    onSuccess: (data) => { qc.setQueryData(["match", matchId], data); },
  });

  if (query.isLoading) return <Centered>Loading match…</Centered>;
  if (query.error) return <Centered>Failed to load match. <button className="underline" onClick={invalidate}>Retry</button></Centered>;
  const match = query.data!;

  if (match.status === "open") {
    return (
      <LobbyView
        match={match}
        userId={userId}
        onStart={() => startMut.mutate()}
        starting={startMut.isPending}
        startError={startMut.error instanceof Error ? startMut.error.message : null}
      />
    );
  }

  return (
    <GameView
      match={match}
      userId={userId}
      onAction={(a) => actionMut.mutate(a)}
      onNextRound={() => nextRoundMut.mutate()}
      pending={actionMut.isPending || nextRoundMut.isPending}
      actionError={actionMut.error instanceof Error ? actionMut.error.message : null}
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">{children}</div>;
}

function LobbyView({
  match,
  userId,
  onStart,
  starting,
  startError,
}: {
  match: MatchView;
  userId: string;
  onStart: () => void;
  starting: boolean;
  startError: string | null;
}) {
  const isCreator = match.createdBy === userId;
  const minPlayers = match.minPlayers ?? 2;
  const canStart = isCreator && match.players.length >= minPlayers;
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-4 text-sm text-muted-foreground">
        <Link to="/lobby" className="underline hover:text-foreground">← Lobby</Link>
      </div>
      <h1 className="text-3xl font-bold tracking-tight">Charlotte's Web</h1>
      <p className="mt-1 text-sm text-muted-foreground">Waiting for players. Match {shortId(match.matchId)}.</p>

      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">Players ({match.players.length}/{match.maxPlayers})</h2>
        <ul className="mt-3 space-y-2">
          {match.players.map((p) => (
            <li key={p} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
              <span className="font-mono">{p === userId ? "You" : shortId(p)}</span>
              {p === match.createdBy && <span className="text-xs text-muted-foreground">host</span>}
            </li>
          ))}
        </ul>
        {isCreator ? (
          <button
            disabled={!canStart || starting}
            onClick={onStart}
            className="mt-6 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {starting ? "Starting…" : canStart ? "Start match" : `Need ${minPlayers}+ players`}
          </button>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">Waiting for the host to start.</p>
        )}
        {startError && <p className="mt-2 text-sm text-destructive">{startError}</p>}
      </div>
    </main>
  );
}

// -------- Game view --------

type UiMode = "idle" | "meld";

function GameView({
  match,
  userId,
  onAction,
  onNextRound,
  pending,
  actionError,
}: {
  match: MatchView;
  userId: string;
  onAction: (a: GameAction) => void;
  onNextRound: () => void;
  pending: boolean;
  actionError: string | null;
}) {
  const order = match._order ?? match.players;
  const currentUser = order[(match.turn ?? 0) % order.length];
  const isMyTurn = currentUser === userId;
  const myHand = match.hands?.[userId] ?? [];
  const sorted = useMemo(() => sortHand(myHand, match.wildRank), [myHand, match.wildRank]);
  const wildRank = match.wildRank ?? null;

  // Meld staging state (client-only until "Lay down" fires).
  const [mode, setMode] = useState<UiMode>("idle");
  const [currentMeld, setCurrentMeld] = useState<string[]>([]);
  const [stagedMelds, setStagedMelds] = useState<string[][]>([]);
  const usedInMelds = new Set([...stagedMelds.flat(), ...currentMeld]);

  const opponents = order.filter((p) => p !== userId);
  const goneOut = match.goneOutBy;
  const roundComplete = match.status === "round-complete";
  const matchComplete = match.status === "complete";

  const discardTop = match.discard && match.discard.length > 0 ? match.discard[match.discard.length - 1] : null;

  const resetMeld = () => { setMode("idle"); setCurrentMeld([]); setStagedMelds([]); };

  const toggleCardForMeld = (card: string) => {
    if (usedInMelds.has(card)) {
      // remove from wherever it is
      if (currentMeld.includes(card)) setCurrentMeld(currentMeld.filter((c) => c !== card));
      else setStagedMelds(stagedMelds.map((m) => m.filter((c) => c !== card)).filter((m) => m.length > 0));
    } else {
      setCurrentMeld([...currentMeld, card]);
    }
  };

  const commitCurrentMeld = () => {
    if (currentMeld.length >= 3) {
      setStagedMelds([...stagedMelds, currentMeld]);
      setCurrentMeld([]);
    }
  };

  const handleCardClick = (card: string) => {
    if (mode === "meld") { toggleCardForMeld(card); return; }
    if (!isMyTurn || !match.hasDrawn || goneOut) return;
    onAction({ type: "discard", card });
  };

  const handleLayDown = () => {
    // discard the last unused, unmelded card in hand
    const remaining = sorted.filter((c) => !usedInMelds.has(c));
    if (remaining.length !== 1) {
      alert("Lay down requires all cards melded except exactly one to discard.");
      return;
    }
    onAction({ type: "lay-down", melds: stagedMelds.concat(currentMeld.length ? [currentMeld] : []), discard: remaining[0] });
    resetMeld();
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link to="/lobby" className="text-muted-foreground underline hover:text-foreground">← Lobby</Link>
        <div className="flex items-center gap-3 text-muted-foreground">
          <span>Round <b className="text-foreground">{match.round}/13</b></span>
          <span>Hand size <b className="text-foreground">{match.handSize}</b></span>
          <span>Wild: <b className="text-amber-600">{wildRank === null ? "—" : wildRank === "T" ? "10" : wildRank}</b> + Jokers</span>
        </div>
      </div>

      {/* Opponents */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {opponents.map((p) => (
          <OpponentPanel
            key={p}
            playerId={p}
            isTurn={p === currentUser}
            count={match.handCounts?.[p] ?? 0}
            score={match.scores?.[p] ?? 0}
            wentOut={goneOut === p}
          />
        ))}
      </div>

      {/* Table center */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-6 rounded-lg border border-border bg-card/50 py-6">
        <div className="flex flex-col items-center gap-1">
          <CardBack size="lg" count={match.stockCount} />
          <button
            disabled={!isMyTurn || match.hasDrawn || pending || Boolean(goneOut) || roundComplete}
            onClick={() => onAction({ type: "draw-stock" })}
            className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-40"
          >
            Draw stock
          </button>
        </div>
        <div className="flex flex-col items-center gap-1">
          {discardTop ? <PlayingCard id={discardTop} wildRank={wildRank} size="lg" /> : <EmptyCardSlot size="lg" label="empty" />}
          <button
            disabled={!isMyTurn || match.hasDrawn || !discardTop || pending || Boolean(goneOut) || roundComplete}
            onClick={() => onAction({ type: "draw-discard" })}
            className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-40"
          >
            Take discard
          </button>
        </div>
      </div>

      <div className="mt-3 text-center text-sm">
        {matchComplete ? (
          <span className="text-emerald-600">
            Match complete. Winner: <b>{match.winner === userId ? "You" : shortId(match.winner ?? "")}</b>
          </span>
        ) : roundComplete ? (
          <span className="text-muted-foreground">Round {match.round} complete.</span>
        ) : goneOut ? (
          <span className="text-amber-600">
            {goneOut === userId ? "You went out." : `${shortId(goneOut)} went out.`}
            {" "}Final turns remaining: {match.remainingFinalTurns}.
          </span>
        ) : isMyTurn ? (
          <span className="text-primary">Your turn — {match.hasDrawn ? "discard or lay down" : "draw a card"}.</span>
        ) : (
          <span className="text-muted-foreground">Waiting on {shortId(currentUser)}…</span>
        )}
        {actionError && <div className="mt-1 text-xs text-destructive">{actionError}</div>}
      </div>

      {/* My hand */}
      <section className="mt-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Your hand — {sorted.length} card{sorted.length === 1 ? "" : "s"} · unmelded score {" "}
            <b className="text-foreground">{sorted.filter((c) => !usedInMelds.has(c)).reduce((s, c) => s + cardPoints(c), 0)}</b>
          </h2>
          <div className="flex gap-2">
            {mode === "idle" ? (
              <button
                disabled={!isMyTurn || !match.hasDrawn || Boolean(goneOut) || roundComplete}
                onClick={() => setMode("meld")}
                className="rounded-md border border-primary px-3 py-1 text-xs text-primary disabled:opacity-40"
              >
                Lay down…
              </button>
            ) : (
              <>
                <button
                  disabled={currentMeld.length < 3}
                  onClick={commitCurrentMeld}
                  className="rounded-md border border-primary px-3 py-1 text-xs text-primary disabled:opacity-40"
                >
                  Add meld ({currentMeld.length})
                </button>
                <button
                  disabled={stagedMelds.length === 0 && currentMeld.length === 0}
                  onClick={handleLayDown}
                  className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-40"
                >
                  Lay down
                </button>
                <button onClick={resetMeld} className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground">
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {mode === "meld" && (
          <div className="mb-3 rounded-md border border-dashed border-border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">
              Tap cards to add them to the current meld, then "Add meld". Repeat until only one card remains (the discard). Naturals must strictly outnumber wilds.
            </p>
            {stagedMelds.map((m, i) => (
              <div key={i} className="mt-2 flex flex-wrap items-center gap-1">
                <span className="text-xs text-muted-foreground">#{i + 1}</span>
                {m.map((c) => <PlayingCard key={c} id={c} wildRank={wildRank} size="sm" />)}
              </div>
            ))}
            {currentMeld.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1">
                <span className="text-xs text-primary">current</span>
                {currentMeld.map((c) => <PlayingCard key={c} id={c} wildRank={wildRank} size="sm" />)}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {sorted.map((c) => (
            <PlayingCard
              key={c}
              id={c}
              wildRank={wildRank}
              selected={mode === "meld" && (currentMeld.includes(c) || stagedMelds.some((m) => m.includes(c)))}
              faded={mode === "meld" && usedInMelds.has(c) && !currentMeld.includes(c)}
              onClick={() => handleCardClick(c)}
            />
          ))}
          {sorted.length === 0 && <p className="text-sm text-muted-foreground">No cards in hand.</p>}
        </div>
      </section>

      {/* Round complete modal */}
      {(roundComplete || matchComplete) && (
        <RoundSummary
          match={match}
          userId={userId}
          onNext={onNextRound}
          pending={pending}
        />
      )}
    </main>
  );
}

function OpponentPanel({
  playerId,
  isTurn,
  count,
  score,
  wentOut,
}: {
  playerId: string;
  isTurn: boolean;
  count: number;
  score: number;
  wentOut: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${isTurn ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-mono">{shortId(playerId)}</span>
        <span className="text-xs text-muted-foreground">total {score}</span>
      </div>
      <div className="mt-2 flex items-center gap-1">
        {Array.from({ length: Math.min(count, 8) }).map((_, i) => <CardBack key={i} size="sm" />)}
        {count > 8 && <span className="ml-1 text-xs text-muted-foreground">+{count - 8}</span>}
        {count === 0 && wentOut && <span className="text-xs text-emerald-600">went out</span>}
      </div>
    </div>
  );
}

function RoundSummary({
  match,
  userId,
  onNext,
  pending,
}: {
  match: MatchView;
  userId: string;
  onNext: () => void;
  pending: boolean;
}) {
  const navigate = useNavigate();
  const deltas = match.lastRoundScores ?? {};
  const scores = match.scores ?? {};
  const complete = match.status === "complete";
  const sorted = [...match.players].sort((a, b) => (scores[a] ?? 0) - (scores[b] ?? 0));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
        <h2 className="text-lg font-semibold">
          {complete ? "Match complete" : `Round ${match.round} complete`}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {complete
            ? `Winner: ${match.winner === userId ? "You" : shortId(match.winner ?? "")}`
            : `Lowest total after 13 rounds wins.`}
        </p>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="py-1">Player</th>
              <th>+ Round</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p} className="border-t border-border">
                <td className="py-1 font-mono">{p === userId ? "You" : shortId(p)}</td>
                <td>{deltas[p] ?? 0}</td>
                <td className="font-semibold">{scores[p] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-6 flex justify-end gap-2">
          {complete ? (
            <button
              onClick={() => navigate({ to: "/lobby" })}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Back to lobby
            </button>
          ) : (
            <button
              disabled={pending}
              onClick={onNext}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-40"
            >
              {pending ? "Starting…" : "Start next round"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}