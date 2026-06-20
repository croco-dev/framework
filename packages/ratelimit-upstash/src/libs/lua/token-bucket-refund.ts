export const tokenBucketRefundLua = `
local key = KEYS[1]
local receiptKey = KEYS[2]
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local intervalMs = tonumber(ARGV[3])
local refillRate = tonumber(ARGV[4])
local ttl = tonumber(ARGV[5])
local receiptId = ARGV[6]

local bucketData = redis.call('GET', key)

if not bucketData then
  redis.call('ZREM', receiptKey, receiptId)
  return {0, capacity, capacity}
end

redis.call('ZREMRANGEBYSCORE', receiptKey, '-inf', now)
local receiptExpiresAt = redis.call('ZSCORE', receiptKey, receiptId)
if not receiptExpiresAt or tonumber(receiptExpiresAt) <= now then
  local currentTokens = capacity
  local currentLastRefill = now
  local parts = {}
  for part in string.gmatch(bucketData, "([^:]+)") do
    table.insert(parts, part)
  end
  currentTokens = tonumber(parts[1])
  currentLastRefill = tonumber(parts[2])

  local timePassed = now - currentLastRefill
  local tokensToAdd = math.floor((timePassed / intervalMs) * refillRate)

  if tokensToAdd > 0 then
    currentTokens = math.min(capacity, currentTokens + tokensToAdd)
    currentLastRefill = now
    redis.call('SET', key, currentTokens .. ':' .. currentLastRefill, 'EX', ttl)
  end

  return {0, currentTokens, currentTokens}
end

local removed = redis.call('ZREM', receiptKey, receiptId)
if removed ~= 1 then
  local currentTokens = capacity
  local currentLastRefill = now
  local parts = {}
  for part in string.gmatch(bucketData, "([^:]+)") do
    table.insert(parts, part)
  end
  currentTokens = tonumber(parts[1])
  currentLastRefill = tonumber(parts[2])

  local timePassed = now - currentLastRefill
  local tokensToAdd = math.floor((timePassed / intervalMs) * refillRate)

  if tokensToAdd > 0 then
    currentTokens = math.min(capacity, currentTokens + tokensToAdd)
    currentLastRefill = now
    redis.call('SET', key, currentTokens .. ':' .. currentLastRefill, 'EX', ttl)
  end

  return {0, currentTokens, currentTokens}
end

local tokens
local lastRefill

local parts = {}
for part in string.gmatch(bucketData, "([^:]+)") do
  table.insert(parts, part)
end
tokens = tonumber(parts[1])
lastRefill = tonumber(parts[2])

local timePassed = now - lastRefill
local tokensToAdd = math.floor((timePassed / intervalMs) * refillRate)

if tokensToAdd > 0 then
  tokens = math.min(capacity, tokens + tokensToAdd)
  lastRefill = now
end

tokens = math.min(capacity, tokens + 1)
redis.call('SET', key, tokens .. ':' .. lastRefill, 'EX', ttl)
redis.call('EXPIRE', receiptKey, ttl)

return {1, tokens, tokens}
`;
