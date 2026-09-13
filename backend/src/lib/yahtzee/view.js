const { potentialScores, totalScore, upperSum, upperBonus, filledCount } = require("./scoring");
const { currentPlayer } = require("./engine");

function redactForUser(match, userId) {
  const view = { ...match };
  const me = userId;
  const cp = currentPlayer(match);
  view.currentPlayer = cp;
  view.myTurn = match.status === "in-progress" && cp === me;
  view.rollsLeft = Math.max(0, 3 - (match.rollsUsed || 0));
  if (match.scorecards && match.dice && cp && match.status === "in-progress") {
    view.potentials = potentialScores(match.dice, match.scorecards[cp]);
  }
  if (match.scorecards) {
    view.cardTotals = {};
    view.upperSums = {};
    view.upperBonuses = {};
    view.filledCounts = {};
    for (const [p, card] of Object.entries(match.scorecards)) {
      view.cardTotals[p] = totalScore(card);
      view.upperSums[p] = upperSum(card);
      view.upperBonuses[p] = upperBonus(card);
      view.filledCounts[p] = filledCount(card);
    }
  }
  return view;
}

module.exports = { redactForUser };
