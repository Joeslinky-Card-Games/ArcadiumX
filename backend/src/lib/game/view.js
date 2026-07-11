// Redact a match state for a given viewer: replace other players' hands
// with counts during play, expose all hands once a round/match is complete,
// and hide the stock pile contents.
function redactForUser(match, userId) {
  const view = { ...match };
  const roundOver = match.status === "round-complete" || match.status === "complete";
  // A viewer who has already gone out / laid down is effectively a spectator
  // for the rest of the round — reveal every hand to them so they can follow
  // the remaining final turns.
  const viewerDone =
    Boolean(match.goneOutBy && match.goneOutBy === userId) ||
    Boolean(match.laidMelds && match.laidMelds[userId]);
  // Once someone goes out, each remaining player gets one final turn. After a
  // player ends that final turn their hand is no longer secret.
  const finalTurnDone = finalTurnDonePlayers(match);
  if (match.hands) {
    const handCounts = {};
    const hands = {};
    for (const [p, cards] of Object.entries(match.hands)) {
      handCounts[p] = cards.length;
      if (p === userId || roundOver || viewerDone || finalTurnDone.has(p)) hands[p] = cards;
    }
    view.hands = hands;
    view.handCounts = handCounts;
  }
  if (Array.isArray(match.stock)) {
    view.stockCount = match.stock.length;
    delete view.stock;
  }
  return view;
}

function finalTurnDonePlayers(match) {
  const order = match._order;
  if (!match.goneOutBy || !order || order.length === 0) return new Set();
  const startIdx = order.indexOf(match.goneOutBy);
  if (startIdx === -1) return new Set();
  const n = order.length;
  const totalFinalTurns = n - 1;
  const completed = Math.max(0, totalFinalTurns - (match.remainingFinalTurns ?? 0));
  const set = new Set();
  for (let i = 1; i <= completed; i++) {
    set.add(order[(startIdx + i) % n]);
  }
  return set;
}

module.exports = { redactForUser };