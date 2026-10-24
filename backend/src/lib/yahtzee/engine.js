const {
  emptyCard,
  applyScore,
  totalScore,
  isComplete,
  CATEGORIES,
} = require("./scoring");
const { makeRng, hashSeed, rollDice, rollDie } = require("./rng");

function rngFor(state) {
  const seed = hashSeed(
    `yz:${state.matchId}:${state.dealSeed ?? ""}:${state.rollSeq ?? 0}`,
  );
  return makeRng(seed);
}

function beginTurn(state) {
  const rng = rngFor(state);
  state.dice = rollDice(5, rng);
  state.held = [false, false, false, false, false];
  state.rollsUsed = 1;
  state.rollSeq = (state.rollSeq ?? 0) + 1;
  state.lastAction = "open";
}

function startMatch({ matchId, players, dealSeed }) {
  if (!Array.isArray(players) || players.length < 1 || players.length > 6) {
    throw new Error("Yahtzee requires 1-6 players");
  }
  return {
    matchId,
    gameId: "yahtzee",
    dealSeed: dealSeed || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    players: players.slice(),
    round: 1,
    scores: Object.fromEntries(players.map((p) => [p, 0])),
    scorecards: Object.fromEntries(players.map((p) => [p, emptyCard()])),
    status: "waiting",
    version: 0,
    dice: [1, 1, 1, 1, 1],
    held: [false, false, false, false, false],
    rollsUsed: 0,
    rollSeq: 0,
    turn: 0,
    winner: null,
    _order: players.slice(),
  };
}

function startRound(state, round) {
  const next = {
    ...state,
    round: round || 1,
    scores: Object.fromEntries(state.players.map((p) => [p, 0])),
    scorecards: Object.fromEntries(state.players.map((p) => [p, emptyCard()])),
    status: "in-progress",
    dice: [1, 1, 1, 1, 1],
    held: [false, false, false, false, false],
    rollsUsed: 0,
    turn: 0,
    winner: null,
    _order: state.players.slice(),
  };
  beginTurn(next);
  return next;
}

function currentPlayer(state) {
  if (!state._order || state._order.length === 0) return null;
  return state._order[state.turn % state._order.length];
}

function parseHeld(action, current) {
  if (!action || action.held == null) return current.slice();
  const held = action.held;
  if (!Array.isArray(held) || held.length !== 5) throw new Error("held must be 5 booleans");
  return held.map(Boolean);
}

function applyAction(match, userId, action) {
  if (match.status !== "in-progress") throw new Error("Match is not in progress");
  if (currentPlayer(match) !== userId) throw new Error("Not your turn");
  if (!action || typeof action.type !== "string") throw new Error("Missing action.type");

  const state = JSON.parse(JSON.stringify(match));

  if (action.type === "hold") {
    if (state.rollsUsed < 1) throw new Error("Roll before holding dice");
    if (state.rollsUsed >= 3) throw new Error("No rerolls left");
    if (!Number.isInteger(action.dieIndex) || action.dieIndex < 0 || action.dieIndex > 4) {
      throw new Error("Invalid die");
    }
    state.held[action.dieIndex] = !state.held[action.dieIndex];
    state.lastAction = "hold";
    state.version++;
    return state;
  }

  if (action.type === "set-hold") {
    if (state.rollsUsed < 1) throw new Error("Roll before holding dice");
    if (state.rollsUsed >= 3) throw new Error("No rerolls left");
    state.held = parseHeld(action, state.held);
    state.lastAction = "hold";
    state.version++;
    return state;
  }

  if (action.type === "roll") {
    if (state.rollsUsed >= 3) throw new Error("No rerolls left");
    if (state.rollsUsed < 1) {
      beginTurn(state);
      state.version++;
      return state;
    }
    if (action.held != null) state.held = parseHeld(action, state.held);
    const rng = rngFor(state);
    for (let i = 0; i < 5; i++) {
      if (!state.held[i]) state.dice[i] = rollDie(rng);
    }
    state.rollsUsed += 1;
    state.rollSeq = (state.rollSeq ?? 0) + 1;
    state.lastAction = "roll";
    state.version++;
    return state;
  }

  if (action.type === "score") {
    if (state.rollsUsed < 1) throw new Error("Roll before scoring");
    const category = action.category;
    if (!CATEGORIES.includes(category)) throw new Error("Unknown category");
    const card = applyScore(state.scorecards[userId], category, state.dice);
    state.scorecards[userId] = card;
    state.scores[userId] = totalScore(card);

    state.lastAction = "score";
    const allDone = state.players.every((p) => isComplete(state.scorecards[p]));
    if (allDone) {
      state.status = "complete";
      let best = -1;
      const winners = [];
      for (const p of state._order) {
        const sc = state.scores[p] ?? 0;
        if (sc > best) {
          best = sc;
          winners.length = 0;
          winners.push(p);
        } else if (sc === best) {
          winners.push(p);
        }
      }
      state.winner = winners[0];
      state.winners = winners;
      state.goneOutBy = winners.length === 1 ? winners[0] : null;
      state.lastRoundScores = { ...state.scores };
      state.version++;
      return state;
    }

    state.turn = (state.turn + 1) % state._order.length;
    if (state.turn === 0) state.round = (state.round || 1) + 1;
    beginTurn(state);
    state.version++;
    return state;
  }

  throw new Error(`Unknown action ${action.type}`);
}

function nextRound(state) {
  if (state.status === "complete") return state;
  return { ...state, status: "complete" };
}

module.exports = {
  startMatch,
  startRound,
  applyAction,
  currentPlayer,
  nextRound,
  beginTurn,
};
