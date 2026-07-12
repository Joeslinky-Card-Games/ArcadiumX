const { PutCommand } = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");
const { ddb, tables } = require("../../lib/dynamo");
const { created, badRequest, serverError } = require("../../lib/response");
const { withAuth } = require("../../lib/auth");
const { byId } = require("../../lib/games");
const {
  hashPassword,
  stripSecret,
  validatePassword,
  ttlForStatus,
  generateCode,
} = require("../../lib/matches");

function sanitizeName(v) {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, 64);
  return s || null;
}

function displayName(userId, claims, body) {
  return (
    sanitizeName(body?.displayName) ||
    claims?.username ||
    claims?.preferred_username ||
    claims?.name ||
    claims?.email ||
    `player-${String(userId).slice(-4)}`
  );
}

function avatarUrl(claims, body) {
  const fromBody = typeof body?.avatarUrl === "string" ? body.avatarUrl.trim() : "";
  if (fromBody && /^https?:\/\//i.test(fromBody)) return fromBody.slice(0, 512);
  return claims?.picture || claims?.image_url || claims?.imageUrl || null;
}

exports.handler = withAuth(async (event, { userId, claims }) => {
  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return badRequest("Invalid JSON"); }
  const gameId = body.gameId;
  const game = byId(gameId);
  if (!game) return badRequest("Unknown gameId");
  if (game.status !== "available") return badRequest("Game not yet available");

  const requestedMax = Number(body.maxPlayers);
  const maxPlayers = Number.isInteger(requestedMax)
    ? Math.max(game.minPlayers, Math.min(game.maxPlayers, requestedMax))
    : game.maxPlayers;

  // Solo vs AI: fill the remaining seats with bots and hide the table from
  // the public lobby. AI matches always start with just the host — no
  // password / join flow.
  const requestedAI = Number(body.aiCount);
  const aiCount = Number.isInteger(requestedAI) && requestedAI > 0
    ? Math.min(requestedAI, game.maxPlayers - 1)
    : 0;

  const visibility = aiCount > 0
    ? "private"
    : (body.visibility === "private" ? "private" : "public");
  let passwordHash;
  if (visibility === "private" && aiCount === 0) {
    const err = validatePassword(body.password);
    if (err) return badRequest(err);
    passwordHash = hashPassword(String(body.password).trim());
  }

  const matchId = randomUUID();

  const hostName = displayName(userId, claims, body);
  const hostAvatar = avatarUrl(claims, body);
  const aiPlayers = [];
  const aiUsernames = {};
  for (let i = 1; i <= aiCount; i++) {
    const id = `ai-${matchId}-${i}`;
    aiPlayers.push(id);
    aiUsernames[id] = `Bot ${i}`;
  }
  const players = [userId, ...aiPlayers];
  // For AI tables, lock the seat count to exactly host + bots.
  const effectiveMax = aiCount > 0 ? players.length : maxPlayers;
  const effectiveMin = aiCount > 0 ? players.length : game.minPlayers;

  // Reserve a unique short code by conditional put on the codes table.
  // On the (rare) collision we retry with a fresh code.
  let code;
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = generateCode();
    try {
      await ddb.send(new PutCommand({
        TableName: tables.matchCodes,
        Item: { code: candidate, matchId, createdAt: new Date().toISOString(), ttl: ttlForStatus("open") },
        ConditionExpression: "attribute_not_exists(code)",
      }));
      code = candidate;
      break;
    } catch (err) {
      if (err.name !== "ConditionalCheckFailedException") {
        console.error("code reservation failed", err);
        return serverError();
      }
    }
  }
  if (!code) {
    console.error("could not allocate unique code after retries");
    return serverError();
  }

  const match = {
    matchId,
    code,
    gameId,
    status: "open",
    createdAt: new Date().toISOString(),
    createdBy: userId,
    players,
    usernames: { [userId]: hostName, ...aiUsernames },
    avatars: hostAvatar ? { [userId]: hostAvatar } : {},
    maxPlayers: effectiveMax,
    minPlayers: effectiveMin,
    ...(aiCount > 0 ? { aiPlayers } : {}),
    version: 0,
    visibility,
    ...(passwordHash ? { passwordHash } : {}),
    ttl: ttlForStatus("open"),
  };
  try {
    await ddb.send(new PutCommand({ TableName: tables.matches, Item: match }));
    return created(stripSecret(match));
  } catch (err) {
    console.error(err);
    return serverError();
  }
});