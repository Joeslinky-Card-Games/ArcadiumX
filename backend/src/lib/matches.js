const { createHash } = require("crypto");

function hashPassword(pw) {
  return createHash("sha256").update(String(pw), "utf8").digest("hex");
}

function stripSecret(match) {
  if (!match) return match;
  const { passwordHash, ...rest } = match;
  return rest;
}

function validatePassword(pw) {
  if (typeof pw !== "string") return "Password is required";
  const trimmed = pw.trim();
  if (trimmed.length < 4) return "Password must be at least 4 characters";
  if (trimmed.length > 64) return "Password must be at most 64 characters";
  return null;
}

// TTL in epoch seconds. DynamoDB TTL auto-deletes items whose `ttl` attribute
// is <= current time, with a delay of up to 48h. Idle tables clear themselves
// so the storage doesn't accumulate.
//
//   open / in-progress / round-complete  → 24h idle window (refreshed on every write)
//   complete                              →  7d retention after final state
function ttlForStatus(status) {
  const now = Math.floor(Date.now() / 1000);
  const day = 86400;
  if (status === "complete") return now + 7 * day;
  return now + 1 * day; // idle timeout for active/lobby matches
}

// Set/refresh the TTL field on a match record. Call from every write path.
function withRefreshedTtl(match) {
  return { ...match, ttl: ttlForStatus(match.status) };
}

module.exports = { hashPassword, stripSecret, validatePassword, ttlForStatus, withRefreshedTtl };