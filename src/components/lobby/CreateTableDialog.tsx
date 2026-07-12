import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { CreateMatchPayload, Game } from "@/lib/api";

export function CreateTableDialog({
  game,
  open,
  onOpenChange,
  onSubmit,
  pending,
  error,
}: {
  game: Game | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (payload: CreateMatchPayload) => void;
  pending: boolean;
  error?: string | null;
}) {
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [password, setPassword] = useState("");
  const [solo, setSolo] = useState(false);
  const [aiCount, setAiCount] = useState(1);

  if (!game) return null;

  const maxAi = Math.max(1, game.maxPlayers - 1);
  const clampedAi = Math.min(Math.max(1, aiCount), maxAi);

  const disabled =
    pending ||
    (!solo && (maxPlayers < game.minPlayers || maxPlayers > game.maxPlayers)) ||
    (!solo && visibility === "private" && password.trim().length < 4);

  const submit = () => {
    if (solo) {
      onSubmit({
        gameId: game.id,
        maxPlayers: clampedAi + 1,
        visibility: "private",
        aiCount: clampedAi,
      });
      return;
    }
    onSubmit({
      gameId: game.id,
      maxPlayers,
      visibility,
      password: visibility === "private" ? password.trim() : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New {game.name} table</DialogTitle>
          <DialogDescription>Configure your table and invite others.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-md border border-border bg-muted/30 p-3">
            <div>
              <Label htmlFor="solo-toggle" className="cursor-pointer">Play solo vs AI</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Skip the lobby and start immediately against bots.
              </p>
            </div>
            <button
              id="solo-toggle"
              type="button"
              role="switch"
              aria-checked={solo}
              onClick={() => setSolo((v) => !v)}
              className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
                solo ? "border-primary bg-primary" : "border-border bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform ${
                  solo ? "translate-x-6" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {solo ? (
            <div>
              <Label htmlFor="ai-count">AI opponents</Label>
              <Input
                id="ai-count"
                type="number"
                min={1}
                max={maxAi}
                value={clampedAi}
                onChange={(e) => setAiCount(Number(e.target.value))}
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Between 1 and {maxAi}. You'll play immediately — no lobby wait.
              </p>
            </div>
          ) : (
          <>
          <div>
            <Label htmlFor="max-players">Max players</Label>
            <Input
              id="max-players"
              type="number"
              min={game.minPlayers}
              max={game.maxPlayers}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Between {game.minPlayers} and {game.maxPlayers}.
            </p>
          </div>

          <div>
            <Label>Visibility</Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVisibility("public")}
                className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                  visibility === "public"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                Public
              </button>
              <button
                type="button"
                onClick={() => setVisibility("private")}
                className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                  visibility === "private"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                Private
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {visibility === "public"
                ? "Anyone can find and join from the lobby."
                : "Hidden from the lobby. Only players with the ID + password can join."}
            </p>
          </div>

          {visibility === "private" && (
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="text"
                minLength={4}
                maxLength={64}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="4–64 characters"
                className="mt-1"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Share this password with players you invite.
              </p>
            </div>
          )}
          </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={disabled}>
            {pending ? "Creating…" : solo ? "Start solo game" : "Create table"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}