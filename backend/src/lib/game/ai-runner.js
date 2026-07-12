// Drives AI turns forward on an in-progress match. Called after any human
// action so bots take their turns before we save + respond to the client.
const { applyAction, currentPlayer } = require("./engine");
const { chooseAction } = require("./ai");

function runAITurns(state) {
  const aiPlayers = Array.isArray(state.aiPlayers) ? state.aiPlayers : [];
  if (aiPlayers.length === 0) return state;
  const aiSet = new Set(aiPlayers);
  let safety = 300;
  while (state.status === "in-progress" && safety-- > 0) {
    const cp = currentPlayer(state);
    if (!aiSet.has(cp)) break;
    // Draw (or lay-down if the pre-draw check allowed it — currently never).
    const a1 = chooseAction(state, cp);
    applyAction(state, cp, a1);
    if (a1.type === "lay-down" || a1.type === "discard") continue;
    if (state.status !== "in-progress") break;
    // Then either lay down or discard.
    const a2 = chooseAction(state, cp);
    applyAction(state, cp, a2);
  }
  return state;
}

module.exports = { runAITurns };