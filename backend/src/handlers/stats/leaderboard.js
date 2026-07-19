const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { ddb, tables } = require("../../lib/dynamo");
const { ok, badRequest, serverError } = require("../../lib/response");

const LEGACY_GAME_IDS = {
  "charlottes-web": ["rummy"],
};

function gameIdsForLeaderboard(gameId) {
  return [gameId, ...(LEGACY_GAME_IDS[gameId] || [])];
}

function n(value) {
  return Number(value || 0);
}

function mergeRows(rows, gameId) {
  const byUser = new Map();
  for (const row of rows) {
    const existing = byUser.get(row.userId) || {
      userId: row.userId,
      gameId,
      username: row.username,
      rating: 0,
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
      gamesWon: 0,
      roundsPlayed: 0,
      roundsWon: 0,
      updatedAt: row.updatedAt,
    };
    existing.username = row.username || existing.username;
    existing.rating += n(row.rating || row.roundsWon);
    existing.wins += n(row.wins);
    existing.losses += n(row.losses);
    existing.gamesPlayed += n(row.gamesPlayed);
    existing.gamesWon += n(row.gamesWon);
    existing.roundsPlayed += n(row.roundsPlayed);
    existing.roundsWon += n(row.roundsWon);
    if (!existing.updatedAt || (row.updatedAt && row.updatedAt > existing.updatedAt)) {
      existing.updatedAt = row.updatedAt;
    }
    byUser.set(row.userId, existing);
  }
  return Array.from(byUser.values()).sort((a, b) => {
    const aRate = a.roundsPlayed > 0 ? a.roundsWon / a.roundsPlayed : 0;
    const bRate = b.roundsPlayed > 0 ? b.roundsWon / b.roundsPlayed : 0;
    return b.roundsWon - a.roundsWon || b.gamesWon - a.gamesWon || bRate - aRate;
  });
}

exports.handler = async (event) => {
  const gameId = event.queryStringParameters?.gameId;
  if (!gameId) return badRequest("gameId query param required");
  try {
    const ids = gameIdsForLeaderboard(gameId);
    const names = { "#gameId": "gameId" };
    const values = Object.fromEntries(ids.map((id, i) => [`:g${i}`, id]));
    const filter = ids.map((_, i) => `#gameId = :g${i}`).join(" OR ");
    const items = [];
    let ExclusiveStartKey;
    do {
      const res = await ddb.send(
        new ScanCommand({
          TableName: tables.stats,
          FilterExpression: filter,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ExclusiveStartKey,
        })
      );
      items.push(...(res.Items || []));
      ExclusiveStartKey = res.LastEvaluatedKey;
    } while (ExclusiveStartKey);

    return ok({ gameId, leaderboard: mergeRows(items, gameId).slice(0, 25) });
  } catch (err) {
    console.error(err);
    return serverError();
  }
};

/*
exports.handler = async (event) => {
  const gameId = event.queryStringParameters?.gameId;
  if (!gameId) return badRequest("gameId query param required");
  try {
    const res = await ddb.send(
      new QueryCommand({
        TableName: tables.stats,
        IndexName: "byGame",
        KeyConditionExpression: "gameId = :g",
        ExpressionAttributeValues: { ":g": gameId },
        ScanIndexForward: false,
        Limit: 25,
      })
    );
    return ok({ gameId, leaderboard: res.Items || [] });
  } catch (err) {
    console.error(err);
    return serverError();
  }
};
*/