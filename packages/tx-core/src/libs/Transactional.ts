import { recordEvent, withSpan } from "@croco/telemetry-api";
import { TxPropagationError } from "./errors";
import { TransactionDecoratorProblem } from "./problems/TransactionProblems";
import type { TxManager } from "./TxManager";
import type { Propagation, TransactionalOptions } from "./types";

type AsyncMethod = (...args: unknown[]) => Promise<unknown>;

/**
 * 메서드 실행에 트랜잭션 전파 규칙과 타임아웃을 적용하는 데코레이터입니다.
 */
export function Transactional<TReceiver, TOptions = unknown>(
  resolveManager: (receiver: TReceiver) => TxManager<unknown, TOptions>,
  options?: TransactionalOptions<TOptions>,
): MethodDecorator {
  const propagation: Propagation = options?.propagation ?? "REQUIRED";
  const nesting = options?.nesting;
  const txOptions = options?.options;
  const timeout = options?.timeout;

  return (
    _target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor | undefined => {
    const originalMethod = descriptor.value as AsyncMethod;

    if (typeof originalMethod !== "function") {
      throw new TransactionDecoratorProblem();
    }

    descriptor.value = async function (this: TReceiver, ...args: unknown[]): Promise<unknown> {
      const txManager = resolveManager(this);
      const isInTx = txManager.isInTransaction();
      const methodName = String(propertyKey);

      const executeInTransaction = async (): Promise<unknown> => {
        switch (propagation) {
          case "REQUIRED":
            return txManager.run(() => originalMethod.apply(this, args), {
              nesting: nesting ?? "join",
              ...(txOptions !== undefined && { options: txOptions }),
              ...(timeout !== undefined && { timeout }),
            });

          case "REQUIRES_NEW":
            return txManager.suspend(() =>
              txManager.run(() => originalMethod.apply(this, args), {
                nesting: "join",
                ...(txOptions !== undefined && { options: txOptions }),
                ...(timeout !== undefined && { timeout }),
              }),
            );

          case "MANDATORY":
            if (!isInTx) {
              throw new TxPropagationError(
                "MANDATORY propagation requires an existing transaction",
              );
            }
            return originalMethod.apply(this, args);

          case "NEVER":
            if (isInTx) {
              throw new TxPropagationError("NEVER propagation does not allow existing transaction");
            }
            return originalMethod.apply(this, args);

          default:
            throw new TxPropagationError(`Unknown propagation: ${propagation}`);
        }
      };

      // MANDATORY and NEVER don't create transactions, so skip telemetry
      if (propagation === "MANDATORY" || propagation === "NEVER") {
        return executeInTransaction();
      }

      return withSpan(
        async () => {
          recordEvent("tx.begin", {
            "tx.propagation": propagation,
            "tx.method": methodName,
          });

          try {
            const result = await executeInTransaction();

            recordEvent("tx.commit", {
              "tx.propagation": propagation,
              "tx.method": methodName,
            });

            return result;
          } catch (error) {
            recordEvent("tx.rollback", {
              "tx.propagation": propagation,
              "tx.method": methodName,
              "tx.error": error instanceof Error ? error.message : String(error),
            });

            throw error;
          }
        },
        {
          name: `tx:${methodName}`,
          attributes: {
            "tx.propagation": propagation,
            "tx.method": methodName,
          },
        },
      );
    };

    return descriptor;
  };
}
