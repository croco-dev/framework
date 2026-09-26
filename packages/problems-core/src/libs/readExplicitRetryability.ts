/**
 * 오류가 명시한 재시도 분류를 읽습니다.
 * 최상위 `retryable` boolean을 먼저 보고, 없으면 `extensions.retryable` boolean을 봅니다.
 * boolean이 아닌 값이나 읽을 수 없는 속성은 명시 분류로 취급하지 않습니다.
 * @param error - 분류를 읽을 오류 값
 * @returns 명시된 재시도 가능 여부, 명시 분류가 없으면 `undefined`
 */
export function readExplicitRetryability(error: unknown): boolean | undefined {
  const retryable = readProperty(error, "retryable");
  if (typeof retryable === "boolean") {
    return retryable;
  }

  const extensionRetryable = readProperty(readProperty(error, "extensions"), "retryable");
  return typeof extensionRetryable === "boolean" ? extensionRetryable : undefined;
}

function readProperty(value: unknown, property: "retryable" | "extensions"): unknown {
  if (typeof value !== "function" && (typeof value !== "object" || value === null)) {
    return undefined;
  }

  // A throwing accessor must not replace the failure being classified.
  try {
    return Reflect.get(value, property);
  } catch {
    return undefined;
  }
}
