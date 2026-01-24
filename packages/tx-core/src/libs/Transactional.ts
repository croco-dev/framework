import { TxPropagationError } from './errors';
import { TxManagerRegistry } from './TxManagerRegistry';
import type { Propagation, TransactionalOptions } from './types';

type AsyncMethod = (...args: unknown[]) => Promise<unknown>;

export function Transactional<TOptions = unknown>(options?: TransactionalOptions<TOptions>): MethodDecorator {
  const propagation: Propagation = options?.propagation ?? 'REQUIRED';
  const managerKey = options?.managerKey;
  const nesting = options?.nesting;
  const txOptions = options?.options;

  return (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor | undefined => {
    const originalMethod = descriptor.value as AsyncMethod;

    if (typeof originalMethod !== 'function') {
      throw new Error('@Transactional can only be applied to methods');
    }

    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
      const txManager = TxManagerRegistry.get(managerKey);
      const isInTx = txManager.isInTransaction();

      switch (propagation) {
        case 'REQUIRED':
          return txManager.run(() => originalMethod.apply(this, args), {
            nesting: nesting ?? 'join',
            options: txOptions,
          });

        case 'REQUIRES_NEW':
          return txManager.suspend(() =>
            txManager.run(() => originalMethod.apply(this, args), { nesting: 'join', options: txOptions })
          );

        case 'MANDATORY':
          if (!isInTx) {
            throw new TxPropagationError('MANDATORY propagation requires an existing transaction');
          }
          return originalMethod.apply(this, args);

        case 'NEVER':
          if (isInTx) {
            throw new TxPropagationError('NEVER propagation does not allow existing transaction');
          }
          return originalMethod.apply(this, args);

        default:
          throw new TxPropagationError(`Unknown propagation: ${propagation}`);
      }
    };

    return descriptor;
  };
}
