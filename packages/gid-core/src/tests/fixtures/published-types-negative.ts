import { defineIdPrefixes, type IdOf } from "@croco/gid-core";

const Ids = defineIdPrefixes({
  USER: "usr",
  ORDER: "ord",
} as const);

// @ts-expect-error duplicate prefix values remain rejected
defineIdPrefixes({ USER: "usr", ADMIN: "usr" } as const);

// @ts-expect-error registry entries do not expose a runtime type marker
void Ids.USER.Id;

// @ts-expect-error branded IDs from different registry entries remain isolated
const wrongPrefix: IdOf<typeof Ids.USER> = Ids.ORDER.generate();

// @ts-expect-error arbitrary strings are not branded IDs
const unbranded: IdOf<typeof Ids.USER> = "usr_01HXY5XM9Z8Y7W6V5U4T3S2R1";

void [wrongPrefix, unbranded];
