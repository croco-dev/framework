export const tokenBucketRefillLua = `
local function serializeRefillCursor(refillCursor)
  return string.format('%.17g', refillCursor)
end

local function refillTokenBucket(currentTokens, currentLastRefill)
  if currentTokens >= capacity then
    local nextLastRefill = math.max(currentLastRefill, now)
    local changed = 0
    if currentTokens ~= capacity or nextLastRefill ~= currentLastRefill then
      changed = 1
    end
    return capacity, nextLastRefill, changed
  end

  local timePassed = now - currentLastRefill
  local tokensToAdd = math.floor((timePassed / intervalMs) * refillRate)
  if tokensToAdd <= 0 then
    return currentTokens, currentLastRefill, 0
  end

  currentTokens = math.min(capacity, currentTokens + tokensToAdd)
  if currentTokens == capacity then
    currentLastRefill = now
  else
    currentLastRefill = currentLastRefill + (tokensToAdd * intervalMs) / refillRate
  end

  return currentTokens, currentLastRefill, 1
end
`;
