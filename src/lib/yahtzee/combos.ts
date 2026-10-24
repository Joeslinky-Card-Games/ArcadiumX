export type ComboKind =
  | "yahtzee"
  | "fourKind"
  | "fullHouse"
  | "largeStraight"
  | "smallStraight"
  | "threeKind";

export type TableDie = { index: number; face: number };

export const COMBO_LABEL: Record<ComboKind, string> = {
  yahtzee: "YAHTZEE!",
  fourKind: "FOUR OF A KIND",
  fullHouse: "FULL HOUSE",
  largeStraight: "LARGE STRAIGHT",
  smallStraight: "SMALL STRAIGHT",
  threeKind: "THREE OF A KIND",
};

export const COMBO_RANK: Record<ComboKind, number> = {
  yahtzee: 6,
  fourKind: 5,
  fullHouse: 4,
  largeStraight: 3,
  smallStraight: 2,
  threeKind: 1,
};

function counts(dice: number[]): number[] {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) if (d >= 1 && d <= 6) c[d] += 1;
  return c;
}

function isSmallStraight(dice: number[]): boolean {
  const s = new Set(dice);
  return (
    [1, 2, 3, 4].every((n) => s.has(n)) ||
    [2, 3, 4, 5].every((n) => s.has(n)) ||
    [3, 4, 5, 6].every((n) => s.has(n))
  );
}

function isLargeStraight(dice: number[]): boolean {
  const s = [...new Set(dice)].sort((a, b) => a - b).join("");
  return s === "12345" || s === "23456";
}

export function detectCombos(dice: number[]): ComboKind[] {
  if (dice.length !== 5) return [];
  const c = counts(dice);
  const out: ComboKind[] = [];
  if (c.some((n, i) => i > 0 && n === 5)) out.push("yahtzee");
  if (c.some((n, i) => i > 0 && n >= 4)) out.push("fourKind");
  if (c.slice(1).includes(3) && c.slice(1).includes(2)) out.push("fullHouse");
  if (isLargeStraight(dice)) out.push("largeStraight");
  if (isSmallStraight(dice)) out.push("smallStraight");
  if (c.some((n, i) => i > 0 && n >= 3)) out.push("threeKind");
  return out.sort((a, b) => COMBO_RANK[b] - COMBO_RANK[a]);
}

export function bestCombo(dice: number[]): ComboKind | null {
  return detectCombos(dice)[0] ?? null;
}

/** Yahtzee can still score after the box is filled (bonus / joker). Other boxes call out once. */
export function comboStillScorable(
  kind: ComboKind,
  card?: { [K in ComboKind]?: number | null } | null,
): boolean {
  if (!card) return true;
  if (kind === "yahtzee") return true;
  return card[kind] == null;
}

export function bestCallableCombo(
  dice: number[],
  card?: { [K in ComboKind]?: number | null } | null,
): ComboKind | null {
  return detectCombos(dice).find((kind) => comboStillScorable(kind, card)) ?? null;
}

const UPPER_BOXES = ["ones", "twos", "threes", "fours", "fives", "sixes"] as const;
const UPPER_BOX_LABEL: Record<(typeof UPPER_BOXES)[number], string> = {
  ones: "Aces",
  twos: "Twos",
  threes: "Threes",
  fours: "Fours",
  fives: "Fives",
  sixes: "Sixes",
};

export function isFiveOfAKind(dice: number[]): boolean {
  return dice.length === 5 && dice.every((d) => d === dice[0]);
}

/** Extra Yahtzee is never written in the Yahtzee box again — joker + optional +100. */
export function extraYahtzeeHelp(
  dice: number[],
  card?: { yahtzee?: number | null; [key: string]: number | null | undefined } | null,
): { bonus: boolean; message: string } | null {
  if (!card || !isFiveOfAKind(dice) || card.yahtzee == null) return null;
  const face = dice[0];
  const upper = UPPER_BOXES[face - 1];
  const bonus = card.yahtzee === 50;
  const bonusBit = bonus ? "+100 bonus. " : "";
  if (upper && card[upper] == null) {
    return {
      bonus,
      message: `Second Yahtzee — ${bonusBit}Leave the Yahtzee box. Tap ${UPPER_BOX_LABEL[upper]} on the scorecard (required).`,
    };
  }
  return {
    bonus,
    message: `Second Yahtzee — ${bonusBit}Leave the Yahtzee box. Tap a highlighted lower box as a joker.`,
  };
}

function takeFace(dice: TableDie[], used: Set<number>, face: number): TableDie[] {
  const out: TableDie[] = [];
  for (const d of dice) {
    if (d.face === face && !used.has(d.index)) {
      used.add(d.index);
      out.push(d);
    }
  }
  return out;
}

/** Order dice so the strongest pattern reads left-to-right. */
export function arrangeDice(dice: TableDie[]): TableDie[] {
  if (dice.length <= 1) return dice.slice();
  const faces = dice.map((d) => d.face);
  const c = counts(faces);
  const used = new Set<number>();
  const result: TableDie[] = [];
  const restHighToLow = () => {
    for (let f = 6; f >= 1; f--) result.push(...takeFace(dice, used, f));
  };

  const maxCount = Math.max(0, ...c.slice(1));
  if (maxCount >= 3) {
    let face = 0;
    for (let f = 6; f >= 1; f--) {
      if (c[f] === maxCount) {
        face = f;
        break;
      }
    }
    result.push(...takeFace(dice, used, face));
    let pair = 0;
    for (let f = 6; f >= 1; f--) {
      if (c[f] === 2) {
        pair = f;
        break;
      }
    }
    if (pair) result.push(...takeFace(dice, used, pair));
    restHighToLow();
    return result;
  }

  const unique = [...new Set(faces)].sort((a, b) => a - b);
  const isRun =
    unique.length >= 3 && unique.every((f, i) => i === 0 || f === unique[i - 1] + 1);
  if (isRun) {
    const sorted = [...dice].sort((a, b) => a.face - b.face || a.index - b.index);
    const seq: TableDie[] = [];
    const dupes: TableDie[] = [];
    let last = 0;
    for (const d of sorted) {
      if (d.face !== last) {
        seq.push(d);
        last = d.face;
      } else {
        dupes.push(d);
      }
    }
    return [...seq, ...dupes];
  }

  restHighToLow();
  return result;
}
