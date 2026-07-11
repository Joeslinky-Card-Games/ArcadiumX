import { createFileRoute, Link } from "@tanstack/react-router";
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
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Lobby</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a game to open a table. Game logic is coming soon.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_GAMES.map((game) => (
          <div
            key={game.id}
            className="flex flex-col justify-between rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/40"
          >
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-card-foreground">{game.name}</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {game.players}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{game.description}</p>
            </div>
            <div className="mt-6">
              <button
                disabled
                className="w-full cursor-not-allowed rounded-md border border-dashed border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
              >
                Coming soon
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        Backend is stubbed. Real tables will be served by the AWS API — see{" "}
        <Link to="/profile" className="underline hover:text-foreground">
          your profile
        </Link>{" "}
        for account details.
      </p>
    </main>
  );
}