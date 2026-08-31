export const slidingWindowLua = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowStart = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local timestamp = ARGV[4]
local ttl = tonumber(ARGV[5])

redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

local currentCount = redis.call('ZCARD', key)
local success = 0
local newCount = currentCount
local remaining = 0

if currentCount < limit then
  redis.call('ZADD', key, now, timestamp)
  redis.call('EXPIRE', key, ttl)

  success = 1
  newCount = currentCount + 1
  remaining = limit - newCount
end

local oldestEntry = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local oldestTimestamp = now
if #oldestEntry >= 2 then
  oldestTimestamp = tonumber(oldestEntry[2])
end

return {success, newCount, remaining, oldestTimestamp}
`;
