export const slidingWindowLua = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowStart = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local timestamp = ARGV[4]
local ttl = tonumber(ARGV[5])

redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

local currentCount = redis.call('ZCARD', key)

if currentCount >= limit then
  return {0, currentCount, 0}
end

redis.call('ZADD', key, now, timestamp)

redis.call('EXPIRE', key, ttl)

local newCount = currentCount + 1
local remaining = limit - newCount

return {1, newCount, remaining}
`;
