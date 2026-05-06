export const fixedWindowLua = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local windowStart = ARGV[3]

local current = redis.call('GET', key)
local count = 0

if current then
  local currentWindowStart, currentCount = string.match(current, '([^:]+):([^:]+)')
  if currentWindowStart == windowStart then
    count = tonumber(currentCount)
  end
end

if count >= limit then
  return {0, count, 0}
end

local newCount = count + 1
redis.call('SET', key, windowStart .. ':' .. newCount, 'EX', ttl)

local remaining = limit - newCount
if remaining < 0 then
  remaining = 0
end

return {1, newCount, remaining}
`;
