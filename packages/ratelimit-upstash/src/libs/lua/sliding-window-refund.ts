export const slidingWindowRefundLua = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowStart = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local receiptId = ARGV[4]
local ttl = tonumber(ARGV[5])

redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

local removed = redis.call('ZREM', key, receiptId)

local currentCount = redis.call('ZCARD', key)

if currentCount == 0 then
  redis.call('DEL', key)
else
  redis.call('EXPIRE', key, ttl)
end

local remaining = limit - currentCount
if remaining < 0 then
  remaining = 0
end

local oldestTimestamp = now
if currentCount > 0 then
  local oldestEntry = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  oldestTimestamp = tonumber(oldestEntry[2])
end

if removed == 1 then
  return {1, currentCount, remaining, oldestTimestamp}
end

return {0, currentCount, remaining, oldestTimestamp}
`;
