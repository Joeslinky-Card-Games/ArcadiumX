const { randomUUID } = require("crypto");
const { UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb, tables } = require("../../lib/dynamo");
const { ok, badRequest, forbidden, serverError } = require("../../lib/response");
const { withAuth } = require("../../lib/auth");
const { ttlForStatus, stripSecret } = require("../../lib/matches");
const { acceptMessage, appendMessage } = require("../../lib/chat");

exports.handler = withAuth(async (event, { userId }) => {
  const matchId = event.pathParameters?.matchId;
  if (!matchId) return badRequest("matchId required");

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return badRequest("Invalid JSON"); }

  const now = Date.now();

  try {
    // First, load current chatMessages + players via a light update-of-nothing
    // isn't clean; use a Get through Update by reading current value with a
    // conditional expression + returning old values. Simpler: use GetCommand.
    const { GetCommand } = require("@aws-sdk/lib-dynamodb");
    const cur = await ddb.send(new GetCommand({
      TableName: tables.matches,
      Key: { matchId },
      ProjectionExpression: "players, chatMessages",
    }));
    if (!cur.Item) return badRequest("Match not found");
    if (!Array.isArray(cur.Item.players) || !cur.Item.players.includes(userId)) {
      return forbidden("Not a player on this table");
    }

    const decision = acceptMessage({
      existing: cur.Item.chatMessages,
      userId,
      text: body.text,
      now,
    });
    if (!decision.ok) return badRequest(decision.reason);

    const msg = {
      id: randomUUID(),
      userId,
      text: decision.text,
      at: now,
    };
    const next = appendMessage(cur.Item.chatMessages, msg);

    const res = await ddb.send(new UpdateCommand({
      TableName: tables.matches,
      Key: { matchId },
      ConditionExpression: "attribute_exists(matchId) AND contains(players, :uid)",
      UpdateExpression: "SET chatMessages = :msgs, #ttl = :ttl",
      ExpressionAttributeNames: { "#ttl": "ttl" },
      ExpressionAttributeValues: {
        ":uid": userId,
        ":msgs": next,
        // Use the current status if known; fall back to "open" idle window.
        ":ttl": ttlForStatus(cur.Item.status || "open"),
      },
      ReturnValues: "ALL_NEW",
    }));
    return ok(stripSecret(res.Attributes));
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") return forbidden("Not a player on this table");
    console.error(err);
    return serverError();
  }
});