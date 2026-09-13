import type { Game } from "@/lib/api";

/** Frontend catalog. Merged with GET /games so new titles still appear if the API is behind. */
export const LOCAL_GAMES: Game[] = [
  {
    id: "charlottes-web",
    name: "Charlotte's Web",
    description:
      "13-round rummy variant with escalating hand sizes and shifting wild ranks. Lowest score wins.",
    minPlayers: 2,
    maxPlayers: 6,
    status: "available",
  },
  {
    id: "stack-attack",
    name: "Stack Attack",
    description: "Skip-Bo–style stack racing. Empty your stockpile first by playing cards in 1→12 sequences.",
    minPlayers: 2,
    maxPlayers: 6,
    status: "available",
  },
  {
    id: "yahtzee",
    name: "Yahtzee",
    description: "Roll five dice for 13 turns. Fill every box on the scorecard — highest total wins.",
    minPlayers: 1,
    maxPlayers: 6,
    status: "available",
  },
  {
    id: "hearts",
    name: "Hearts",
    description: "Classic trick-taking game. Avoid the queen of spades.",
    minPlayers: 4,
    maxPlayers: 4,
    status: "coming-soon",
  },
  {
    id: "spades",
    name: "Spades",
    description: "Partnership bidding game with spades as trump.",
    minPlayers: 4,
    maxPlayers: 4,
    status: "coming-soon",
  },
  {
    id: "poker",
    name: "Texas Hold'em",
    description: "The world's most popular poker variant.",
    minPlayers: 2,
    maxPlayers: 9,
    status: "coming-soon",
  },
  {
    id: "rummy",
    name: "Gin Rummy",
    description: "Draw, discard, and be the first to knock.",
    minPlayers: 2,
    maxPlayers: 2,
    status: "coming-soon",
  },
];

export function mergeGameCatalog(apiGames?: Game[] | null): Game[] {
  const apiById = new Map((apiGames ?? []).map((g) => [g.id, g]));
  const seen = new Set<string>();
  const out: Game[] = [];
  for (const local of LOCAL_GAMES) {
    const api = apiById.get(local.id);
    out.push(api ? { ...local, ...api } : local);
    seen.add(local.id);
  }
  for (const g of apiGames ?? []) {
    if (!seen.has(g.id)) out.push(g);
  }
  return out;
}
