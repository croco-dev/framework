export const fixedWindowLua = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])

local current = redis.call('GET', key)
local count = 0

if current then
  count = tonumber(current)
end

if count >= limit then
  return {0, count, 0}
end

local newCount = redis.call('INCR', key)

if newCount == 1 then
  redis.call('EXPIRE', key, ttl)
end

local remaining = limit - newCount
if remaining < 0 then
  remaining = 0
end

return {1, newCount, remaining}
`;
