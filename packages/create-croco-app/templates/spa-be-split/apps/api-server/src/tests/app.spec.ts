import { createTestingApp } from "@croco/testing";
import { describe, expect, it } from "vitest";
import { UserController } from "../controllers/UserController";

describe("API server", () => {
  it("serves users through the Croco testing harness", async () => {
    const app = createTestingApp({ controllers: [UserController] });

    const response = await app.get("/users");
    const users = await app.readJson<Array<{ id: string; name: string }>>(response);

    expect(response.status).toBe(200);
    expect(users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "user-1",
          name: "Ada Lovelace",
        }),
      ]),
    );
    expect(users).toHaveLength(2);
  });
});
