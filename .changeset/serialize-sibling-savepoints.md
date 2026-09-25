---
"@croco/tx-core": patch
---

같은 트랜잭션 client를 공유하는 savepoint 자식을 순서대로 실행해 성공한 형제의 쓰기가 다른 형제의 rollback이나 상태 교체로 사라지지 않도록 합니다.
