const test = require("node:test");
const assert = require("node:assert/strict");
const { startMatch, startRound, applyAction, currentPlayer } = require("../engine");
const {
  applyScore,
  emptyCard,
  scoreFor,
  legalCategories,
  isYahtzee,
  isSmallStraight,
  isLargeStraight,
  isFullHouse,
  counts,
  totalScore,
} = require("../scoring");
const { chooseAction } = require("../ai");

test("startMatch requires 1-6 players", () => {
  assert.throws(() => startMatch({ matchId: "m", players: [] }));
  assert.throws(() => startMatch({ matchId: "m", players: ["a", "b", "c", "d", "e", "f", "g"] }));
  const s = startMatch({ matchId: "m", players: ["a"] });
  assert.equal(s.status, "waiting");
  assert.equal(s.gameId, "yahtzee");
});

test("startRound auto-rolls five dice", () => {
  const m = startMatch({ matchId: "m1", players: ["a", "b"], dealSeed: "seed" });
  const s = startRound(m, 1);
  assert.equal(s.status, "in-progress");
  assert.equal(s.dice.length, 5);
  assert.ok(s.dice.every((d) => d >= 1 && d <= 6));
  assert.equal(s.rollsUsed, 1);
  assert.equal(currentPlayer(s), "a");
});

test("hold then roll rerolls only unheld dice", () => {
  const m = startMatch({ matchId: "m2", players: ["a"], dealSeed: "seed-hold" });
  let s = startRound(m, 1);
  const first = s.dice.slice();
  s = applyAction(s, "a", { type: "set-hold", held: [true, true, true, true, true] });
  s = applyAction(s, "a", { type: "roll" });
  assert.deepEqual(s.dice, first);
  assert.equal(s.rollsUsed, 2);
});

test("cannot roll more than three times", () => {
  const m = startMatch({ matchId: "m3", players: ["a"], dealSeed: "seed-rolls" });
  let s = startRound(m, 1);
  s = applyAction(s, "a", { type: "roll", held: [false, false, false, false, false] });
  s = applyAction(s, "a", { type: "roll", held: [false, false, false, false, false] });
  assert.equal(s.rollsUsed, 3);
  assert.throws(() => applyAction(s, "a", { type: "roll" }));
});

test("cannot act on someone else's turn", () => {
  const m = startMatch({ matchId: "m4", players: ["a", "b"], dealSeed: "seed-turn" });
  const s = startRound(m, 1);
  assert.throws(() => applyAction(s, "b", { type: "score", category: "chance" }));
});

test("scoring chance writes the dice sum and passes the turn", () => {
  const m = startMatch({ matchId: "m5", players: ["a", "b"], dealSeed: "seed-score" });
  let s = startRound(m, 1);
  s.dice = [6, 6, 5, 4, 3];
  s.rollsUsed = 3;
  const sum = 24;
  s = applyAction(s, "a", { type: "score", category: "chance" });
  assert.equal(s.scorecards.a.chance, sum);
  assert.equal(s.scores.a, sum);
  assert.equal(currentPlayer(s), "b");
  assert.equal(s.rollsUsed, 1);
});

test("upper bonus is 35 once aces-sixes reach 63", () => {
  const card = emptyCard();
  card.ones = 3;
  card.twos = 6;
  card.threes = 9;
  card.fours = 12;
  card.fives = 15;
  card.sixes = 18;
  assert.equal(totalScore(card), 63 + 35);
});

test("small/large straight and full house detection", () => {
  assert.equal(isSmallStraight([1, 2, 3, 4, 6]), true);
  assert.equal(isSmallStraight([1, 2, 3, 5, 6]), false);
  assert.equal(isLargeStraight([2, 3, 4, 5, 6]), true);
  assert.equal(isLargeStraight([1, 2, 3, 4, 4]), false);
  assert.equal(isFullHouse(counts([2, 2, 5, 5, 5])), true);
  assert.equal(isFullHouse(counts([6, 6, 6, 6, 6])), false);
  assert.equal(scoreFor("fullHouse", [6, 6, 6, 6, 6], false), 0);
  assert.equal(scoreFor("fullHouse", [6, 6, 6, 6, 6], true), 25);
  assert.equal(scoreFor("threeKind", [2, 2, 2, 5, 6], false), 17);
  assert.equal(scoreFor("fourKind", [2, 2, 2, 5, 6], false), 0);
});

test("joker Yahtzee must fill the matching upper box if open", () => {
  const card = emptyCard();
  card.yahtzee = 50;
  const dice = [4, 4, 4, 4, 4];
  assert.equal(isYahtzee(dice), true);
  assert.deepEqual(legalCategories(dice, card), ["fours"]);
});

test("joker Yahtzee can score full points in lower boxes when upper is filled", () => {
  const card = emptyCard();
  card.yahtzee = 50;
  card.fours = 12;
  const dice = [4, 4, 4, 4, 4];
  const legal = legalCategories(dice, card);
  assert.ok(legal.includes("fullHouse"));
  assert.ok(legal.includes("smallStraight"));
  const next = applyScore(card, "largeStraight", dice);
  assert.equal(next.largeStraight, 40);
  assert.equal(next.yahtzeeBonus, 100);
});

test("scratched Yahtzee still uses joker placement but awards no bonus", () => {
  const card = emptyCard();
  card.yahtzee = 0;
  card.fives = 15;
  const dice = [5, 5, 5, 5, 5];
  const next = applyScore(card, "fullHouse", dice);
  assert.equal(next.fullHouse, 25);
  assert.equal(next.yahtzeeBonus, 0);
});

test("AI finishes a solo game without throwing", () => {
  let s = startRound(
    startMatch({ matchId: "ai1", players: ["bot"], dealSeed: "ai-seed" }),
    1,
  );
  let safety = 400;
  while (s.status === "in-progress" && safety-- > 0) {
    const action = chooseAction(s, "bot");
    s = applyAction(s, "bot", action);
  }
  assert.equal(s.status, "complete");
  assert.equal(s.winner, "bot");
  assert.equal(s.goneOutBy, "bot");
  assert.equal(s.lastRoundScores.bot, s.scores.bot);
  assert.ok(s.scores.bot >= 0);
  assert.ok(Object.values(s.scorecards.bot).every((v) => v != null || v === 0));
  const filled = Object.keys(s.scorecards.bot).filter((k) => k !== "yahtzeeBonus");
  assert.equal(filled.length, 13);
  assert.ok(filled.every((k) => s.scorecards.bot[k] != null));
});

test("two-player game ends after 13 scores each", () => {
  let s = startRound(
    startMatch({ matchId: "p2", players: ["a", "b"], dealSeed: "p2-seed" }),
    1,
  );
  let safety = 800;
  while (s.status === "in-progress" && safety-- > 0) {
    const p = currentPlayer(s);
    const action = chooseAction(s, p);
    s = applyAction(s, p, action);
  }
  assert.equal(s.status, "complete");
  assert.ok(["a", "b"].includes(s.winner));
});
