// Minimum unmelded-card points for a leftover hand after the last discard.
const { validateMeld } = require("./melds");
const { cardPoints } = require("./cards");

function combinations(arr, k, cb) {
  const cur = [];
  const rec = (start) => {
    if (cur.length === k) { cb(cur); return; }
    for (let i = start; i <= arr.length - (k - cur.length); i++) {
      cur.push(arr[i]); rec(i + 1); cur.pop();
    }
  };
  rec(0);
}

function sumBitsPts(mask, pts) {
  let s = 0, i = 0;
  while (mask) { if (mask & 1) s += pts[i]; mask >>>= 1; i++; }
  return s;
}

function scoreDeadwood(hand, wildRank) {
  const n = hand.length;
  if (n === 0) return { points: 0, unmelded: [] };
  const pts = hand.map((c) => cardPoints(c));
  const total = pts.reduce((a, b) => a + b, 0);
  const indices = hand.map((_, i) => i);
  const cands = [];
  const maxSize = Math.min(n, 8);
  for (let k = 3; k <= maxSize; k++) {
    combinations(indices, k, (combo) => {
      const cards = combo.map((i) => hand[i]);
      if (validateMeld(cards, wildRank)) {
        let mask = 0;
        for (const i of combo) mask |= 1 << i;
        cands.push({ mask, pts: sumBitsPts(mask, pts) });
      }
    });
  }

  const N = 1 << n;
  const dp = new Int32Array(N);
  dp.fill(-1);
  dp[0] = 0;
  for (let mask = 0; mask < N; mask++) {
    if (dp[mask] < 0) continue;
    for (const c of cands) {
      if (c.mask & mask) continue;
      const next = mask | c.mask;
      const val = dp[mask] + c.pts;
      if (val > dp[next]) dp[next] = val;
    }
  }
  let bestMask = 0;
  for (let mask = 1; mask < N; mask++) {
    if (dp[mask] > dp[bestMask]) bestMask = mask;
  }
  const unmelded = [];
  for (let i = 0; i < n; i++) {
    if (((bestMask >> i) & 1) === 0) unmelded.push(hand[i]);
  }
  return { points: total - (dp[bestMask] || 0), unmelded };
}

function minUnmeldedPoints(hand, wildRank) {
  return scoreDeadwood(hand, wildRank).points;
}

module.exports = { minUnmeldedPoints, scoreDeadwood };
