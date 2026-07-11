// Stub backend data. Swap for AWS API calls later.
export type Game = {
  id: string;
  name: string;
  description: string;
  players: string;
  status: "available" | "coming-soon";
};

export const MOCK_GAMES: Game[] = [
  {
    id: "hearts",
    name: "Hearts",
    description: "Classic trick-taking game. Avoid the queen of spades.",
    players: "4 players",
    status: "coming-soon",
  },
  {
    id: "spades",
    name: "Spades",
    description: "Partnership bidding game with spades as trump.",
    players: "4 players",
    status: "coming-soon",
  },
  {
    id: "poker",
    name: "Texas Hold'em",
    description: "The world's most popular poker variant.",
    players: "2–9 players",
    status: "coming-soon",
  },
  {
    id: "rummy",
    name: "Gin Rummy",
    description: "Draw, discard, and be the first to knock.",
    players: "2 players",
    status: "coming-soon",
  },
];