export const tokenBucketLua = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local intervalMs = tonumber(ARGV[3])
local refillRate = tonumber(ARGV[4])
local ttl = tonumber(ARGV[5])

local bucketData = redis.call('GET', key)

local tokens
local lastRefill

if bucketData then
  local parts = {}
  for part in string.gmatch(bucketData, "([^:]+)") do
    table.insert(parts, part)
  end
  tokens = tonumber(parts[1])
  lastRefill = tonumber(parts[2])
else
  tokens = capacity
  lastRefill = now
end

local timePassed = now - lastRefill
local tokensToAdd = math.floor((timePassed / intervalMs) * refillRate)

if tokensToAdd > 0 then
  tokens = math.min(capacity, tokens + tokensToAdd)
  lastRefill = now
end

local success = 0
local remaining = tokens

if tokens >= 1 then
  tokens = tokens - 1
  success = 1
  remaining = tokens
end

redis.call('SET', key, tokens .. ':' .. lastRefill, 'EX', ttl)

return {success, tokens, remaining}
`;
