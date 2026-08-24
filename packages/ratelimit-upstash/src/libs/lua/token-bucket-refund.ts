import { tokenBucketRefillLua } from "./token-bucket-refill";

export const tokenBucketRefundLua = `
local key = KEYS[1]
local receiptKey = KEYS[2]
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local intervalMs = tonumber(ARGV[3])
local refillRate = tonumber(ARGV[4])
local ttl = tonumber(ARGV[5])
local receiptId = ARGV[6]

${tokenBucketRefillLua}

local bucketData = redis.call('GET', key)

if not bucketData then
  redis.call('ZREM', receiptKey, receiptId)
  return {0, capacity, capacity, serializeRefillCursor(now)}
end

local parts = {}
for part in string.gmatch(bucketData, "([^:]+)") do
  table.insert(parts, part)
end
local tokens = tonumber(parts[1])
local lastRefill = tonumber(parts[2])

redis.call('ZREMRANGEBYSCORE', receiptKey, '-inf', now)
local receiptExpiresAt = redis.call('ZSCORE', receiptKey, receiptId)
local removed = 0
if receiptExpiresAt and tonumber(receiptExpiresAt) > now then
  removed = redis.call('ZREM', receiptKey, receiptId)
end

if removed ~= 1 then
  local changed
  tokens, lastRefill, changed = refillTokenBucket(tokens, lastRefill)
  if changed == 1 then
    redis.call('SET', key, tokens .. ':' .. serializeRefillCursor(lastRefill), 'EX', ttl)
  end

  return {0, tokens, tokens, serializeRefillCursor(lastRefill)}
end

tokens, lastRefill = refillTokenBucket(tokens, lastRefill)
tokens = math.min(capacity, tokens + 1)
if tokens == capacity then
  lastRefill = now
end

local serializedLastRefill = serializeRefillCursor(lastRefill)
redis.call('SET', key, tokens .. ':' .. serializedLastRefill, 'EX', ttl)
redis.call('EXPIRE', receiptKey, ttl)

return {1, tokens, tokens, serializedLastRefill}
`;
