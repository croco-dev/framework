import { betterAuth } from "@croco/auth-better-auth";
import { defineCrocoApplication } from "@croco/framework-module";
import { drizzle } from "drizzle-orm/node-postgres";

export function createAuthExample() {
  return defineCrocoApplication({
    name: "first-party-auth-example",
    imports: [
      betterAuth({
        db: drizzle.mock(),
        baseURL: "https://example.test",
        secret: "zero-credential-auth-secret-00000000",
      }),
    ],
  });
}
