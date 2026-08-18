---
editUrl: false
next: false
prev: false
title: "SeatLimitChecker"
---

좌석 제한 체커 인터페이스

## Description

entitlements-core와 연동하여 테넌트의 좌석 제한을 체크하는 인터페이스입니다.

## Example

**구현**

```typescript
class EntitlementSeatLimitChecker extends SeatLimitChecker {
  async checkSeatAvailability(tenantId: string): Promise<EntitlementQuotaStatus> {
    return this.entitlementManager.check(tenantId, "seats");
  }
  // 다른 메서드 구현...
}
```

## Constructors

### Constructor

> **new SeatLimitChecker**(): `SeatLimitChecker`

#### Returns

`SeatLimitChecker`

## Methods

### checkSeatAvailability()

> `abstract` **checkSeatAvailability**(`tenantId`): `Promise`\<[`EntitlementQuotaStatus`](/api/entitlements-core/src/type-aliases/entitlementquotastatus/)\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`EntitlementQuotaStatus`](/api/entitlements-core/src/type-aliases/entitlementquotastatus/)\>

---

### getCurrentMemberCount()

> `abstract` **getCurrentMemberCount**(`tenantId`): `Promise`\<`number`\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<`number`\>

---

### getMaxSeats()

> `abstract` **getMaxSeats**(`tenantId`): `Promise`\<`number`\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<`number`\>
