const UPPER = ["ones", "twos", "threes", "fours", "fives", "sixes"];
const LOWER = [
  "threeKind",
  "fourKind",
  "fullHouse",
  "smallStraight",
  "largeStraight",
  "yahtzee",
  "chance",
];
const CATEGORIES = [...UPPER, ...LOWER];

const LABELS = {
  ones: "Aces",
  twos: "Twos",
  threes: "Threes",
  fours: "Fours",
  fives: "Fives",
  sixes: "Sixes",
  threeKind: "3 of a Kind",
  fourKind: "4 of a Kind",
  fullHouse: "Full House",
  smallStraight: "Sm. Straight",
  largeStraight: "Lg. Straight",
  yahtzee: "Yahtzee",
  chance: "Chance",
};

function emptyCard() {
  const card = { yahtzeeBonus: 0 };
  for (const c of CATEGORIES) card[c] = null;
  return card;
}

function counts(dice) {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d] += 1;
  return c;
}

function sumDice(dice) {
  return dice.reduce((a, b) => a + b, 0);
}

function sumOfFace(dice, face) {
  return dice.reduce((a, d) => a + (d === face ? d : 0), 0);
}

function isYahtzee(dice) {
  return dice.length === 5 && dice.every((d) => d === dice[0]);
}

function isFullHouse(c) {
  const faces = c.slice(1);
  return faces.includes(3) && faces.includes(2);
}

function uniqueSorted(dice) {
  return [...new Set(dice)].sort((a, b) => a - b);
}

function isSmallStraight(dice) {
  const s = new Set(dice);
  return (
    [1, 2, 3, 4].every((n) => s.has(n)) ||
    [2, 3, 4, 5].every((n) => s.has(n)) ||
    [3, 4, 5, 6].every((n) => s.has(n))
  );
}

function isLargeStraight(dice) {
  const s = uniqueSorted(dice).join("");
  return s === "12345" || s === "23456";
}

function hasNOfKind(c, n) {
  return c.some((x, i) => i > 0 && x >= n);
}

function upperSum(card) {
  return UPPER.reduce((s, k) => s + (card[k] ?? 0), 0);
}

function upperBonus(card) {
  return upperSum(card) >= 63 ? 35 : 0;
}

function filledCount(card) {
  return CATEGORIES.filter((k) => card[k] != null).length;
}

function isComplete(card) {
  return filledCount(card) === CATEGORIES.length;
}

function totalScore(card) {
  const boxes = CATEGORIES.reduce((s, k) => s + (card[k] ?? 0), 0);
  return boxes + upperBonus(card) + (card.yahtzeeBonus || 0);
}

function isJokerYahtzee(dice, card) {
  return isYahtzee(dice) && card.yahtzee != null;
}

function legalCategories(dice, card) {
  const open = CATEGORIES.filter((k) => card[k] == null);
  if (!isJokerYahtzee(dice, card)) return open;
  const face = dice[0];
  const upperCat = UPPER[face - 1];
  if (card[upperCat] == null) return [upperCat];
  const openLower = LOWER.filter((k) => k !== "yahtzee" && card[k] == null);
  if (openLower.length) return openLower;
  return UPPER.filter((k) => card[k] == null);
}

function scoreFor(category, dice, joker) {
  const c = counts(dice);
  const face = UPPER.indexOf(category) + 1;
  if (face > 0) return sumOfFace(dice, face);
  if (category === "threeKind") return hasNOfKind(c, 3) || joker ? sumDice(dice) : 0;
  if (category === "fourKind") return hasNOfKind(c, 4) || joker ? sumDice(dice) : 0;
  if (category === "fullHouse") return joker || isFullHouse(c) ? 25 : 0;
  if (category === "smallStraight") return joker || isSmallStraight(dice) ? 30 : 0;
  if (category === "largeStraight") return joker || isLargeStraight(dice) ? 40 : 0;
  if (category === "yahtzee") return isYahtzee(dice) ? 50 : 0;
  if (category === "chance") return sumDice(dice);
  throw new Error(`Unknown category ${category}`);
}

function applyScore(card, category, dice) {
  if (!CATEGORIES.includes(category)) throw new Error("Unknown category");
  if (card[category] != null) throw new Error("Category already filled");
  const legal = legalCategories(dice, card);
  if (!legal.includes(category)) {
    throw new Error("That box cannot be used with this roll");
  }
  const joker = isJokerYahtzee(dice, card);
  const next = { ...card };
  if (isYahtzee(dice) && card.yahtzee === 50) {
    next.yahtzeeBonus = (next.yahtzeeBonus || 0) + 100;
  }
  next[category] = scoreFor(category, dice, joker);
  return next;
}

function potentialScores(dice, card) {
  const legal = new Set(legalCategories(dice, card));
  const out = {};
  for (const cat of CATEGORIES) {
    if (card[cat] != null) {
      out[cat] = { filled: card[cat], legal: false };
    } else {
      const joker = isJokerYahtzee(dice, card);
      out[cat] = {
        filled: null,
        legal: legal.has(cat),
        potential: legal.has(cat) ? scoreFor(cat, dice, joker) : null,
      };
    }
  }
  return out;
}

module.exports = {
  UPPER,
  LOWER,
  CATEGORIES,
  LABELS,
  emptyCard,
  counts,
  sumDice,
  isYahtzee,
  isFullHouse,
  isSmallStraight,
  isLargeStraight,
  upperSum,
  upperBonus,
  filledCount,
  isComplete,
  totalScore,
  isJokerYahtzee,
  legalCategories,
  scoreFor,
  applyScore,
  potentialScores,
};
