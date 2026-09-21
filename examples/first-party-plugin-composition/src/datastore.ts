import { defineCrocoApplication } from "@croco/framework-module";
import { drizzleTransaction } from "@croco/tx-drizzle";
import { drizzle } from "drizzle-orm/node-postgres";

export function createDatastoreExample() {
  return defineCrocoApplication({
    name: "first-party-datastore-example",
    imports: [drizzleTransaction({ db: drizzle.mock() })],
  });
}
