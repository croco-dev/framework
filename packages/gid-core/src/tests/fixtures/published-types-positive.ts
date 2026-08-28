import { defineIdPrefixes, type IdOf, type PrefixedId } from "@croco/gid-core";

const Ids = defineIdPrefixes({
  USER: "usr",
  ORDER: "ord",
} as const);

type UserId = IdOf<typeof Ids.USER>;
type OrderId = IdOf<typeof Ids.ORDER>;

const userId: UserId = Ids.USER.generate();
const orderId: OrderId = Ids.ORDER.generate();
const prefixedUserId: PrefixedId<"usr"> = userId;
const userPrefix: "usr" = Ids.USER.getPrefix();

void [userId, orderId, prefixedUserId, userPrefix];
