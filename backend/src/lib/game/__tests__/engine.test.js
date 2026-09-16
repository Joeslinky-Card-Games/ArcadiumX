const test = require("node:test");
const assert = require("node:assert/strict");
const { startMatch, startRound, applyAction, finalizeRound, nextRound, currentPlayer, TOTAL_ROUNDS } = require("../engine");
const { handSizeForRound, wildRankForRound } = require("../cards");

test("startMatch requires 2-6 players", () => {
  assert.throws(() => startMatch({ matchId: "m", players: ["a"] }));
  assert.throws(() => startMatch({ matchId: "m", players: ["a","b","c","d","e","f","g"] }));
  const s = startMatch({ matchId: "m", players: ["a", "b"] });
  assert.equal(s.status, "waiting");
  assert.deepEqual(s.scores, { a: 0, b: 0 });
});

test("startRound deals correct hand size and wild rank", () => {
  const m = startMatch({ matchId: "m1", players: ["a", "b", "c"] });
  const s = startRound(m, 1);
  assert.equal(s.handSize, 3);
  assert.equal(s.wildRank, "3");
  assert.equal(s.hands["a"].length, 3);
  assert.equal(s.hands["b"].length, 3);
  assert.equal(s.hands["c"].length, 3);
  assert.equal(s.discard.length, 1);
  assert.equal(s.stock.length, 108 - 3 * 3 - 1);
  assert.equal(s.status, "in-progress");
});

test("round parameters across all 13 rounds", () => {
  for (let r = 1; r <= TOTAL_ROUNDS; r++) {
    assert.equal(typeof handSizeForRound(r), "number");
    assert.equal(typeof wildRankForRound(r), "string");
  }
  assert.equal(handSizeForRound(1), 3);
  assert.equal(handSizeForRound(13), 15);
  assert.equal(wildRankForRound(9), "J");
  assert.equal(wildRankForRound(12), "A");
  assert.equal(wildRankForRound(13), "2");
});

test("draw then discard advances turn", () => {
  const m = startMatch({ matchId: "m2", players: ["a", "b"] });
  const s = startRound(m, 1);
  const first = currentPlayer(s);
  applyAction(s, first, { type: "draw-stock" });
  const toDiscard = s.hands[first][0];
  applyAction(s, first, { type: "discard", card: toDiscard });
  assert.notEqual(currentPlayer(s), first);
});

test("cannot discard without drawing", () => {
  const m = startMatch({ matchId: "m3", players: ["a", "b"] });
  const s = startRound(m, 1);
  const first = currentPlayer(s);
  assert.throws(() => applyAction(s, first, { type: "discard", card: s.hands[first][0] }));
});

test("cannot act on someone else's turn", () => {
  const m = startMatch({ matchId: "m4", players: ["a", "b"] });
  const s = startRound(m, 1);
  const other = s._order.find((p) => p !== currentPlayer(s));
  assert.throws(() => applyAction(s, other, { type: "draw-stock" }));
});

test("last-turn discard is what gets scored, not the pre-turn hand", () => {
  const m = startMatch({ matchId: "m-last-score", players: ["a", "b", "c"], dealSeed: "seed" });
  const s = startRound(m, 1);
  const [first, second, third] = s._order;
  // First player goes out immediately.
  s.hands[first] = ["7H1", "7S1", "7D1", "KC1"];
  s.hasDrawn = true;
  s.turn = 0;
  applyAction(s, first, {
    type: "lay-down",
    melds: [["7H1", "7S1", "7D1"]],
    discard: "KC1",
  });
  assert.equal(s.remainingFinalTurns, 2);

  // Second player's last turn: deadwood that cannot meld. Draw a king, dump the ace.
  // Before the turn: A=1, 5=5, 9=9 (15). After discard: 5+9+K=24.
  s.hands[second] = ["AH1", "5C1", "9D1"];
  s.stock = ["KC2", "2C1"];
  applyAction(s, second, { type: "draw-stock" });
  assert.deepEqual(s.hands[second].slice().sort(), ["5C1", "9D1", "AH1", "KC2"].sort());
  applyAction(s, second, { type: "discard", card: "AH1" });
  assert.equal(s.status, "in-progress");
  assert.equal(s.remainingFinalTurns, 1);

  // Third (last) player: draw a 2, keep a 4/6/8 deadwood = 18, dump the 2.
  s.hands[third] = ["4H1", "6C1", "8D1"];
  s.stock = ["2S1"];
  applyAction(s, third, { type: "draw-stock" });
  applyAction(s, third, { type: "discard", card: "2S1" });

  assert.equal(s.status, "round-complete");
  assert.equal(s.lastRoundScores[first], 0);
  assert.equal(s.lastRoundScores[second], 5 + 9 + 10);
  assert.equal(s.lastRoundScores[third], 4 + 6 + 8);
  assert.equal(s.scores[first], 0);
  assert.equal(s.scores[second], 24);
  assert.equal(s.scores[third], 18);
});

test("player immediately before the one who went out still gets a last turn", () => {
  const m = startMatch({ matchId: "m-wrap", players: ["a", "b", "c"], dealSeed: "seed" });
  const s = startRound(m, 1);
  const [p0, p1, p2] = s._order;
  // Middle player goes out so last turns wrap: p2 then p0.
  s.turn = 1;
  s.hands[p1] = ["8H1", "8S1", "8D1", "KC1"];
  s.hasDrawn = true;
  applyAction(s, p1, {
    type: "lay-down",
    melds: [["8H1", "8S1", "8D1"]],
    discard: "KC1",
  });
  assert.equal(currentPlayer(s), p2);
  assert.equal(s.remainingFinalTurns, 2);

  s.hands[p2] = ["AH1", "3C1", "5D1"];
  s.stock = ["4H2", "6C2"];
  applyAction(s, p2, { type: "draw-stock" });
  applyAction(s, p2, { type: "discard", card: "AH1" });
  assert.equal(currentPlayer(s), p0);
  assert.equal(s.remainingFinalTurns, 1);

  s.hands[p0] = ["2H1", "4C1", "9D1"];
  applyAction(s, p0, { type: "draw-stock" });
  applyAction(s, p0, { type: "discard", card: "2H1" });

  assert.equal(s.status, "round-complete");
  assert.equal(s.lastRoundScores[p1], 0);
  assert.equal(s.lastRoundScores[p2], 3 + 5 + 4);
  assert.equal(s.lastRoundScores[p0], 4 + 9 + 6);
});

test("going out on your last turn scores 0 for that round", () => {
  const m = startMatch({ matchId: "m-last-out", players: ["a", "b"], dealSeed: "seed" });
  const s = startRound(m, 1);
  const [first, second] = s._order;
  s.hands[first] = ["6H1", "6S1", "6D1", "KC1"];
  s.hasDrawn = true;
  s.turn = 0;
  applyAction(s, first, {
    type: "lay-down",
    melds: [["6H1", "6S1", "6D1"]],
    discard: "KC1",
  });
  assert.equal(s.remainingFinalTurns, 1);
  s.hands[second] = ["9H1", "9S1", "9D1"];
  s.stock = ["2C1"];
  applyAction(s, second, { type: "draw-stock" });
  applyAction(s, second, {
    type: "lay-down",
    melds: [["9H1", "9S1", "9D1"]],
    discard: "2C1",
  });
  assert.equal(s.status, "round-complete");
  assert.equal(s.lastRoundScores[first], 0);
  assert.equal(s.lastRoundScores[second], 0);
});

test("go-out flow: opponents get one more turn then round finalizes", () => {
  const m = startMatch({ matchId: "m5", players: ["a", "b", "c"] });
  const s = startRound(m, 1);
  // manually stage: player a has a valid 3-card set + 1 to discard
  const first = s._order[0];
  s.hands[first] = ["7H1", "7S1", "7D1", "KC1"];
  s.hasDrawn = true; // pretend they drew
  s.turn = 0;
  applyAction(s, first, {
    type: "lay-down",
    melds: [["7H1", "7S1", "7D1"]],
    discard: "KC1",
  });
  assert.equal(s.goneOutBy, first);
  // 2 opponents still to play
  assert.equal(s.remainingFinalTurns, 2);
  // each remaining player draws + discards
  for (let i = 0; i < 2; i++) {
    const cp = currentPlayer(s);
    applyAction(s, cp, { type: "draw-stock" });
    const card = s.hands[cp][0];
    applyAction(s, cp, { type: "discard", card });
  }
  assert.equal(s.status, "round-complete");
  assert.equal(s.lastRoundScores[first], 0);
});

test("nextRound advances to round 2 with new wild rank", () => {
  const m = startMatch({ matchId: "m6", players: ["a", "b"] });
  let s = startRound(m, 1);
  s.goneOutBy = "a";
  s.remainingFinalTurns = 0;
  s.hands["a"] = [];
  finalizeRound(s);
  assert.equal(s.status, "round-complete");
  s = nextRound(s);
  assert.equal(s.round, 2);
  assert.equal(s.handSize, 4);
  assert.equal(s.wildRank, "4");
});