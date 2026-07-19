// Stack Attack: 162-card deck — 12 copies of ranks 1..12 plus 18 wilds.
const { shuffle } = require("../game/deck");

function buildDeck() {
  const cards = [];
  for (let rank = 1; rank <= 12; rank++) {
    for (let i = 0; i < 12; i++) cards.push(`N${rank}:${i}`);
  }
  for (let i = 0; i < 18; i++) cards.push(`W:${i}`);
  return cards; // 12*12 + 18 = 162
}

function isWild(card) { return typeof card === "string" && card.startsWith("W:"); }
function rankOf(card) {
  if (isWild(card)) return null;
  const m = /^N(\d+):/.exec(card);
  return m ? Number(m[1]) : null;
}

module.exports = { buildDeck, shuffle, isWild, rankOf };