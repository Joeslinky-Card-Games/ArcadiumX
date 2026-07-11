const { GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb, tables } = require("../../lib/dynamo");
const { ok, badRequest, unauthorized, notFound, serverError } = require("../../lib/response");
const { withAuth } = require("../../lib/auth");
const { hashPassword, stripSecret, ttlForStatus } = require("../../lib/matches");

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
  const matchId = event.pathParameters?.matchId;
  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch { return badRequest("Invalid JSON"); }
  const name = displayName(userId, claims, body);
  const avatar = avatarUrl(claims, body);

  try {
    // Load first to validate visibility/password and handle idempotent re-entry.
    const existing = await ddb.send(new GetCommand({ TableName: tables.matches, Key: { matchId } }));
    if (!existing.Item) return notFound("Table not found");
    const match = existing.Item;

    if (match.visibility === "private") {
      const pw = typeof body.password === "string" ? body.password.trim() : "";
      if (!pw) return unauthorized("Password required");
      if (hashPassword(pw) !== match.passwordHash) return unauthorized("Incorrect password");
    }

    // Idempotent re-entry: already a player, return current state.
    if (Array.isArray(match.players) && match.players.includes(userId)) {
      return ok(stripSecret(match));
    }

    const res = await ddb.send(
      new UpdateCommand({
        TableName: tables.matches,
        Key: { matchId },
        ConditionExpression: "attribute_exists(matchId) AND #s = :open AND size(players) < maxPlayers AND NOT contains(players, :uid)",
        UpdateExpression:
          "SET players = list_append(players, :p), usernames.#uid = :name, #ttl = :ttl" +
          (avatar ? ", avatars.#uid = :avatar" : "") +
          " ADD version :one",
        ExpressionAttributeNames: { "#s": "status", "#uid": userId, "#ttl": "ttl" },
        ExpressionAttributeValues: {
          ":open": "open",
          ":uid": userId,
          ":p": [userId],
          ":one": 1,
          ":name": name,
          ":ttl": ttlForStatus("open"),
          ...(avatar ? { ":avatar": avatar } : {}),
        },
        ReturnValues: "ALL_NEW",
      })
    );
    return ok(stripSecret(res.Attributes));
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") return badRequest("Cannot join match");
    console.error(err);
    return serverError();
  }
});