const { isWild, rankOf } = require("./deck");

// Greedy bot: play the stock top if possible, then any playable card that
// makes progress. If nothing plays, discard the highest-rank non-wild.
function topOf(a) { return a.length ? a[a.length - 1] : null; }
function nextTarget(pile) { return pile.length + 1; }

function findPlay(match, me) {
  const piles = match.buildPiles;
  const targets = piles.map(nextTarget);
  // 1. Play stock top
  const stockTop = topOf(match.stocks[me]);
  if (stockTop) {
    for (let i = 0; i < 4; i++) {
      if (isWild(stockTop) || rankOf(stockTop) === targets[i]) {
        return { type: "play", from: "stock", buildPileIndex: i };
      }
    }
  }
  // 2. Play discard-top matches
  for (let d = 0; d < 4; d++) {
    const t = topOf(match.discards[me][d]);
    if (!t) continue;
    for (let i = 0; i < 4; i++) {
      if (rankOf(t) === targets[i]) {
        return { type: "play", from: "discard", discardPileIndex: d, buildPileIndex: i };
      }
    }
  }
  // 3. Play hand exact matches (non-wild)
  const hand = match.hands[me] || [];
  for (let h = 0; h < hand.length; h++) {
    const c = hand[h];
    if (isWild(c)) continue;
    for (let i = 0; i < 4; i++) {
      if (rankOf(c) === targets[i]) {
        return { type: "play", from: "hand", handIndex: h, buildPileIndex: i };
      }
    }
  }
  // 4. Use wild if a low pile is empty or below 5 (rough heuristic)
  for (let h = 0; h < hand.length; h++) {
    if (isWild(hand[h])) {
      // Prefer emptiest pile
      let best = -1, bestLen = 12;
      for (let i = 0; i < 4; i++) if (piles[i].length < bestLen) { bestLen = piles[i].length; best = i; }
      if (best >= 0) return { type: "play", from: "hand", handIndex: h, buildPileIndex: best };
    }
  }
  return null;
}

function chooseDiscard(match, me) {
  const hand = match.hands[me] || [];
  if (hand.length === 0) return null;
  // Discard the highest non-wild, spread across 4 piles by lowest length.
  let idx = 0, bestRank = -1;
  for (let i = 0; i < hand.length; i++) {
    if (isWild(hand[i])) continue;
    const r = rankOf(hand[i]) ?? 0;
    if (r > bestRank) { bestRank = r; idx = i; }
  }
  // If all wilds, pick 0
  let pile = 0, bestLen = Infinity;
  for (let i = 0; i < 4; i++) {
    const l = match.discards[me][i].length;
    if (l < bestLen) { bestLen = l; pile = i; }
  }
  return { type: "discard", handIndex: idx, discardPileIndex: pile };
}

function chooseAction(match, me) {
  const play = findPlay(match, me);
  if (play) return play;
  const dis = chooseDiscard(match, me);
  if (dis) return dis;
  // Fallback: discard first card to pile 0
  return { type: "discard", handIndex: 0, discardPileIndex: 0 };
}

module.exports = { chooseAction };