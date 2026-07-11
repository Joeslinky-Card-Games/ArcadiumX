const { UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb, tables } = require("../../lib/dynamo");
const { ok, badRequest, serverError } = require("../../lib/response");
const { withAuth } = require("../../lib/auth");
const { stripSecret, ttlForStatus } = require("../../lib/matches");

function sanitizeName(v) {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, 64);
  return s || null;
}

function sanitizeAvatar(v) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!/^https?:\/\//i.test(s)) return null;
  return s.slice(0, 512);
}

/**
 * Refresh the caller's own username/avatar entry on a match.
 * Called by the match page on load — Clerk session JWTs don't carry
 * username/picture, so the client asserts them explicitly. Only updates
 * the caller's own key, only if they are already a player.
 */
exports.handler = withAuth(async (event, { userId }) => {
  const matchId = event.pathParameters?.matchId;
  if (!matchId) return badRequest("matchId required");

  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch { return badRequest("Invalid JSON"); }

  const name = sanitizeName(body.displayName);
  const avatar = sanitizeAvatar(body.avatarUrl);
  if (!name && !avatar) return badRequest("Nothing to update");

  const setExprs = ["#ttl = :ttl"];
  const names = { "#ttl": "ttl", "#uid": userId };
  const values = { ":ttl": ttlForStatus("open"), ":uid": userId };
  if (name) {
    setExprs.push("usernames.#uid = :name");
    values[":name"] = name;
  }
  if (avatar) {
    setExprs.push("avatars.#uid = :avatar");
    values[":avatar"] = avatar;
  }

  try {
    const res = await ddb.send(new UpdateCommand({
      TableName: tables.matches,
      Key: { matchId },
      // Only refresh if the caller is a seated player on this match.
      ConditionExpression: "attribute_exists(matchId) AND contains(players, :uid)",
      UpdateExpression: "SET " + setExprs.join(", "),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW",
    }));
    return ok(stripSecret(res.Attributes));
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") return badRequest("Not a player on this table");
    console.error(err);
    return serverError();
  }
});