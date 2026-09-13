const {
  UPPER,
  CATEGORIES,
  counts,
  isYahtzee,
  isFullHouse,
  isSmallStraight,
  isLargeStraight,
  legalCategories,
  scoreFor,
  isJokerYahtzee,
  filledCount,
  upperSum,
} = require("./scoring");
const { currentPlayer } = require("./engine");

function holdForKind(dice, face) {
  return dice.map((d) => d === face);
}

function holdFullHouse(dice) {
  const c = counts(dice);
  const faces = [];
  for (let n = 1; n <= 6; n++) if (c[n] >= 2) faces.push(n);
  if (c.some((x, i) => i > 0 && x >= 4)) {
    const face = c.findIndex((x, i) => i > 0 && x >= 4);
    let kept = 0;
    return dice.map((d) => {
      if (d === face && kept < 3) {
        kept += 1;
        return true;
      }
      return false;
    });
  }
  return dice.map((d) => faces.includes(d));
}

function holdLargeStraight(dice) {
  const used = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const keep = [false, false, false, false, false];
  for (let i = 0; i < 5; i++) {
    const d = dice[i];
    if (d >= 2 && d <= 5 && used[d] === 0) {
      keep[i] = true;
      used[d] = 1;
    }
  }
  const keptCore = keep.filter(Boolean).length;
  for (const extra of [1, 6]) {
    if (used[extra]) continue;
    const idx = dice.findIndex((d, i) => d === extra && !keep[i]);
    if (idx < 0) continue;
    if (keptCore + 1 >= 4) {
      keep[idx] = true;
      used[extra] = 1;
    }
  }
  return keep;
}

function holdSmallStraight(dice) {
  const c = counts(dice);
  if (c[3] === 0 && c[4] === 0) return [false, false, false, false, false];
  const used = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const keep = [false, false, false, false, false];
  const takeOne = (n) => {
    const i = dice.findIndex((d, idx) => d === n && !keep[idx]);
    if (i >= 0) {
      keep[i] = true;
      used[n] = 1;
    }
  };
  takeOne(3);
  takeOne(4);
  takeOne(2);
  takeOne(5);
  if (used[1] === 0 && used[2] && !used[5]) takeOne(1);
  if (used[6] === 0 && used[5] && !used[2]) takeOne(6);
  return keep;
}

function holdChance(dice, rollsLeft) {
  const minKeep = rollsLeft >= 2 ? 5 : 4;
  return dice.map((d) => d >= minKeep);
}

function bestKindFace(c, card) {
  let best = null;
  let bestScore = -Infinity;
  for (let n = 6; n >= 1; n--) {
    if (c[n] === 0) continue;
    const upperOpen = card[UPPER[n - 1]] == null;
    let s = c[n] * 10 + n;
    if (upperOpen) s += 8 + n;
    if (c[n] >= 3 && upperOpen) s += 12;
    if (c[n] >= 4 && n >= 4 && upperOpen) s += 20;
    if (s > bestScore) {
      bestScore = s;
      best = n;
    }
  }
  return best || 6;
}

function pickGoal(dice, card, rollsLeft) {
  const c = counts(dice);
  const maxC = Math.max(...c.slice(1));

  if (isYahtzee(dice)) return { type: "keep-all" };
  if (isLargeStraight(dice) && card.largeStraight == null) return { type: "keep-all" };
  if (isFullHouse(dice) && card.fullHouse == null) return { type: "keep-all" };

  for (let n = 6; n >= 1; n--) {
    if (c[n] >= 4 && card[UPPER[n - 1]] == null) return { type: "kind", face: n };
  }

  if (isSmallStraight(dice) && card.largeStraight == null && rollsLeft > 0) {
    return { type: "largeStraight" };
  }
  if (isSmallStraight(dice) && card.smallStraight == null) return { type: "keep-all" };

  if (maxC >= 3) return { type: "kind", face: bestKindFace(c, card) };

  const pairs = [];
  for (let n = 1; n <= 6; n++) if (c[n] >= 2) pairs.push(n);
  if (pairs.length >= 1 && card.fullHouse == null && maxC >= 2) {
    if (card.smallStraight == null || card.largeStraight == null) {
      const ss = holdSmallStraight(dice).filter(Boolean).length;
      if (ss >= 3 && maxC < 3) return { type: "smallStraight" };
    }
    return { type: "fullHouse" };
  }

  if (card.largeStraight == null) {
    const ls = holdLargeStraight(dice).filter(Boolean).length;
    if (ls >= 3) return { type: "largeStraight" };
  }
  if (card.smallStraight == null) {
    const ss = holdSmallStraight(dice).filter(Boolean).length;
    if (ss >= 2) return { type: "smallStraight" };
  }

  if (maxC >= 2) return { type: "kind", face: bestKindFace(c, card) };
  return { type: "chance" };
}

function holdsForGoal(goal, dice, rollsLeft) {
  if (goal.type === "keep-all") return [true, true, true, true, true];
  if (goal.type === "kind") return holdForKind(dice, goal.face);
  if (goal.type === "fullHouse") return holdFullHouse(dice);
  if (goal.type === "largeStraight") return holdLargeStraight(dice);
  if (goal.type === "smallStraight") return holdSmallStraight(dice);
  return holdChance(dice, rollsLeft);
}

function opponentLead(match, me) {
  const mine = match.scores[me] ?? 0;
  let bestOther = 0;
  for (const p of match.players) {
    if (p === me) continue;
    bestOther = Math.max(bestOther, match.scores[p] ?? 0);
  }
  return mine - bestOther;
}

function categoryHeuristic(cat, points, card, filled, behind) {
  let v = points;
  if (UPPER.includes(cat)) {
    const face = UPPER.indexOf(cat) + 1;
    const expected = 3 * face;
    const upper = upperSum(card);
    if (upper < 63) {
      if (points >= expected) v += 10 + face;
      if (points >= expected + face) v += 14;
      if (points <= expected - 2 * face) v -= 18 + face * 2;
      if (points === 0 && face >= 3) v -= 45;
      if (points <= face && face >= 4) v -= 30;
    }
  }
  if (cat === "fourKind" && filled === 0 && points > 0) v -= 20;
  if (cat === "fourKind" && points === 0 && filled < 7) v += 6;
  if (cat === "yahtzee" && points === 0 && filled >= 6) v += 10;
  if (cat === "yahtzee" && points === 0 && behind && filled < 10) v -= 20;
  if (cat === "smallStraight" && points === 0) v -= 22;
  if (cat === "largeStraight" && points === 0 && filled < 9) v -= 16;
  if (cat === "fullHouse" && points === 0 && filled < 8) v -= 8;
  if (cat === "chance" && points < 20 && filled < 10) v -= 14;
  if (cat === "chance" && points >= 23) v += 4;
  if (cat === "yahtzee" && points === 50) v += 40;
  if (cat === "largeStraight" && points === 40) v += 12;
  if (cat === "fullHouse" && points === 25) v += 8;
  return v;
}

function chooseCategory(dice, card, match, me) {
  const legal = legalCategories(dice, card);
  if (legal.length === 0) return CATEGORIES.find((c) => card[c] == null);
  const joker = isJokerYahtzee(dice, card);
  const filled = filledCount(card);
  const behind = opponentLead(match, me) < -20;
  let best = legal[0];
  let bestV = -Infinity;
  for (const cat of legal) {
    const points = scoreFor(cat, dice, joker);
    // Opening: never park a 4-of-a-kind in fourKind if the matching upper is open.
    if (filled === 0 && cat === "fourKind" && points > 0) continue;
    const c = counts(dice);
    if (filled === 0 && UPPER.includes(cat)) {
      const face = UPPER.indexOf(cat) + 1;
      if (c[face] <= 1 && face > 1) continue;
      if (c[face] <= 2 && face >= 4) continue;
    }
    const v = categoryHeuristic(cat, points, card, filled, behind);
    if (v > bestV) {
      bestV = v;
      best = cat;
    }
  }
  return best;
}

function shouldScoreNow(dice, card, rollsLeft) {
  if (rollsLeft <= 0) return true;
  if (isYahtzee(dice) && (card.yahtzee == null || card.yahtzee === 50)) return true;
  if (isLargeStraight(dice) && card.largeStraight == null) return true;
  const c = counts(dice);
  for (let n = 6; n >= 4; n--) {
    if (c[n] >= 4 && card[UPPER[n - 1]] == null) return true;
  }
  if (isFullHouse(dice) && card.fullHouse == null && rollsLeft <= 1) return true;
  return false;
}

function holdsEqual(a, b) {
  return a.length === b.length && a.every((v, i) => Boolean(v) === Boolean(b[i]));
}

function chooseAction(match, userId) {
  const me = userId || currentPlayer(match);
  const card = match.scorecards[me];
  const dice = match.dice;
  const rollsLeft = 3 - (match.rollsUsed || 0);

  if (rollsLeft > 0 && !shouldScoreNow(dice, card, rollsLeft)) {
    const goal = pickGoal(dice, card, rollsLeft);
    const held = holdsForGoal(goal, dice, rollsLeft);
    if (!holdsEqual(match.held || [], held)) {
      return { type: "roll", held };
    }
    const allHeld = held.every(Boolean);
    if (allHeld) {
      return { type: "score", category: chooseCategory(dice, card, match, me) };
    }
    return { type: "roll", held };
  }

  return { type: "score", category: chooseCategory(dice, card, match, me) };
}

module.exports = {
  chooseAction,
  pickGoal,
  holdsForGoal,
  chooseCategory,
};
