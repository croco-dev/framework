export const slidingWindowRefundLua = `
local key = KEYS[1]
local windowStart = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local receiptId = ARGV[3]
local ttl = tonumber(ARGV[4])

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

if removed == 1 then
  return {1, currentCount, remaining}
end

return {0, currentCount, remaining}
`;
