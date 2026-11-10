import { Auditable, AuditInterceptor } from "@croco/audit-core";
import { Container, Context } from "@croco/framework-context";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditLogRepository } from "@croco/audit-core";
import type { ILogger } from "@croco/framework-context";

export function defineBigintAuditPersistenceTests(getRepository: () => AuditLogRepository): void {
  describe("bigint audit persistence", () => {
    beforeEach(() => Container.reset());
    afterEach(() => Container.reset());

    it.each(["decorator", "interceptor"] as const)(
      "persists exact bigint snapshots through the %s without warnings",
      async (path) => {
        const repository = getRepository();
        const logger: ILogger = {
          debug: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          fatal: vi.fn(),
          child() {
            return this;
          },
        };
        const input = {
          amount: BigInt("9007199254740993"),
          items: [{ delta: BigInt("-9007199254740995") }, BigInt("0")],
          accessToken: BigInt("123456789"),
          diff: {
            amount: { before: BigInt("9007199254740997"), after: BigInt("9007199254740993") },
          },
        };
        const result = {
          balance: BigInt("9007199254740999"),
          nested: [BigInt("-1")],
          password: BigInt("987654321"),
        };
        class AccountService {
          @Auditable({
            action: "account.update",
            resourceType: "Account",
            resourceIdIndex: 0,
            payloadIndex: 1,
            includeResult: true,
            throwOnFailure: true,
            dependencies: () => ({ repository, logger }),
          })
          async update(_id: string, _input: typeof input): Promise<typeof result> {
            return result;
          }
        }
        const output = await Context.run(
          { requestId: `bigint-${path}`, tenantId: "tenant-bigint", user: { id: "actor-bigint" } },
          () =>
            path === "decorator"
              ? new AccountService().update("account-bigint", input)
              : new AuditInterceptor(repository, logger).intercept(
                  {
                    getClass: () => ({ name: "AccountController" }),
                    getHandler: () => "update",
                    getMethod: () => "PATCH",
                    getPath: () => "/accounts/account-bigint",
                    getRequest: () => ({ headers: {}, body: input }) as unknown as Request,
                  },
                  { handle: async () => result },
                ),
        );

        expect(output).toBe(result);
        const entries = await repository.find({ tenantId: "tenant-bigint" });
        expect(entries).toHaveLength(1);
        const entry = entries[0];
        const expectedResult = {
          balance: "9007199254740999",
          nested: ["-1"],
          password: "[Redacted]",
        };
        expect(entry?.payload.result).toEqual(expectedResult);
        const expectedInput = {
          amount: "9007199254740993",
          items: [{ delta: "-9007199254740995" }, "0"],
          accessToken: "[Redacted]",
          diff: { amount: { before: "9007199254740997", after: "9007199254740993" } },
        };
        expect(entry).toMatchObject(
          path === "decorator"
            ? {
                payload: {
                  arguments: ["account-bigint", expectedInput],
                  input: expectedInput,
                  result: expectedResult,
                },
                diff: expectedInput.diff,
              }
            : { payload: { result: expectedResult }, metadata: { http: { body: expectedInput } } },
        );
        expect(logger.warn).not.toHaveBeenCalled();
        expect(result.balance).toBe(BigInt("9007199254740999"));
        expect(input.amount).toBe(BigInt("9007199254740993"));
      },
    );
  });
}
