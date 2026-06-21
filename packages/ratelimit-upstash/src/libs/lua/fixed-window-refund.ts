export const fixedWindowRefundLua = `
local key = KEYS[1]
local receiptKey = KEYS[2]
local limit = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local windowStart = ARGV[3]
local receiptId = ARGV[4]

local current = redis.call('GET', key)
if not current then
  return {0, 0, limit}
end

local currentWindowStart, currentCount = string.match(current, '([^:]+):([^:]+)')
local count = tonumber(currentCount) or 0

if currentWindowStart ~= windowStart then
  local remaining = limit - count
  if remaining < 0 then
    remaining = 0
  end
  redis.call('SREM', receiptKey, receiptId)
  return {0, count, remaining}
end

local removed = redis.call('SREM', receiptKey, receiptId)
if removed ~= 1 then
  local remaining = limit - count
  if remaining < 0 then
    remaining = 0
  end
  return {0, count, remaining}
end

if count <= 1 then
  redis.call('DEL', key)
  redis.call('DEL', receiptKey)
  return {1, 0, limit}
end

local newCount = count - 1
redis.call('SET', key, windowStart .. ':' .. newCount, 'EX', ttl)
redis.call('EXPIRE', receiptKey, ttl)

local remaining = limit - newCount
if remaining < 0 then
  remaining = 0
end

return {1, newCount, remaining}
`;
