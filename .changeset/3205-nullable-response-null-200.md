# 3205 nullable 응답 스키마의 유효 null JSON 200 반환

- `transports-http`가 선언된 응답 본문 계약이 있는 `null` 결과를 204 빈 응답 대신 `200 application/json` 본문 `null`로 유지한다.
- 응답 스키마가 없는 기존 `null`/`undefined` no-content 동작은 그대로 둔다.
