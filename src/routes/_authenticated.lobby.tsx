import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useUser } from "@clerk/tanstack-react-start";
import { API_URL, endpoints, useApi, type Game, type Match, type MatchView } from "@/lib/api";
import { MOCK_GAMES } from "@/lib/mock-games";

export const Route = createFileRoute("/_authenticated/lobby")({
  head: () => ({
    meta: [
      { title: "Lobby — Card Table" },
      { name: "description", content: "Browse and join card game tables." },
    ],
  }),
  component: LobbyPage,
});

function LobbyPage() {
  const api = useApi();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useUser();
  const userId = user?.id ?? "";
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [maxPlayers, setMaxPlayers] = useState(4);

  const gamesQuery = useQuery({
    queryKey: ["games"],
    queryFn: () => endpoints.listGames(),
    enabled: Boolean(API_URL),
  });
  const matchesQuery = useQuery({
    queryKey: ["matches", "open"],
    queryFn: () => endpoints.listMatches(),
    enabled: Boolean(API_URL),
    refetchInterval: 5000,
  });

  const games: Game[] = gamesQuery.data?.games ?? MOCK_GAMES.map((g) => ({
    id: g.id, name: g.name, description: g.description,
    minPlayers: 2, maxPlayers: 4, status: g.status,
  }));

  const createMut = useMutation({
    mutationFn: (payload: { gameId: string; maxPlayers: number }) =>
      api<Match>("/matches", { method: "POST", body: payload }),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["matches", "open"] });
      navigate({ to: "/match/$matchId", params: { matchId: m.matchId } });
    },
  });
  const joinMut = useMutation({
    mutationFn: (matchId: string) =>
      api<MatchView>(`/matches/${matchId}/join`, { method: "POST" }),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["matches", "open"] });
      navigate({ to: "/match/$matchId", params: { matchId: m.matchId } });
    },
  });

  const openMatches = matchesQuery.data?.matches ?? [];

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Lobby</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Start a new table or join an open match.
          </p>
        </div>
      </div>

      {!API_URL && (
        <div className="mb-6 rounded-md border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          Backend not configured — set <code>VITE_API_URL</code> to your API Gateway URL.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((game) => (
          <div
            key={game.id}
            className="flex flex-col justify-between rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/40"
          >
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-card-foreground">{game.name}</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {game.minPlayers === game.maxPlayers
                    ? `${game.maxPlayers} players`
                    : `${game.minPlayers}–${game.maxPlayers} players`}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{game.description}</p>
            </div>
            <div className="mt-6">
              {game.status === "available" ? (
                <button
                  onClick={() => { setSelectedGame(game.id); setMaxPlayers(Math.min(4, game.maxPlayers)); }}
                  className="w-full rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                >
                  Create table
                </button>
              ) : (
                <button
                  disabled
                  className="w-full cursor-not-allowed rounded-md border border-dashed border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
                >
                  Coming soon
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Open matches */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold">Open tables</h2>
        {openMatches.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No open tables. Create one above.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-md border border-border">
            {openMatches.map((m) => {
              const gameName = games.find((g) => g.id === m.gameId)?.name ?? m.gameId;
              const already = m.players.includes(userId);
              const full = m.players.length >= m.maxPlayers;
              return (
                <li key={m.matchId} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium">{gameName}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.players.length}/{m.maxPlayers} players · {new Date(m.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <button
                    disabled={joinMut.isPending || (full && !already)}
                    onClick={() => already
                      ? navigate({ to: "/match/$matchId", params: { matchId: m.matchId } })
                      : joinMut.mutate(m.matchId)}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-40"
                  >
                    {already ? "Enter" : full ? "Full" : "Join"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {joinMut.error instanceof Error && (
          <p className="mt-2 text-sm text-destructive">{joinMut.error.message}</p>
        )}
      </section>

      {/* Create modal */}
      {selectedGame && (() => {
        const g = games.find((x) => x.id === selectedGame)!;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl">
              <h3 className="text-lg font-semibold">New {g.name} table</h3>
              <label className="mt-4 block text-sm">
                Max players
                <input
                  type="number"
                  min={g.minPlayers}
                  max={g.maxPlayers}
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <p className="mt-2 text-xs text-muted-foreground">Between {g.minPlayers} and {g.maxPlayers}.</p>
              {createMut.error instanceof Error && (
                <p className="mt-2 text-sm text-destructive">{createMut.error.message}</p>
              )}
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setSelectedGame(null)}
                  className="rounded-md border border-border px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  disabled={createMut.isPending}
                  onClick={() => createMut.mutate({ gameId: g.id, maxPlayers })}
                  className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-40"
                >
                  {createMut.isPending ? "Creating…" : "Create"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}