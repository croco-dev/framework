import { MetadataStorage } from '@croco/framework-context';
import { RESOLVERS_KEY } from '../constants';

export class ResolverRegistry {
  register(target: Function): void {
    MetadataStorage.define(RESOLVERS_KEY, target, true);
  }

  getAll(): Function[] {
    return MetadataStorage.getAll<boolean>(RESOLVERS_KEY).map((entry) => entry.target as Function);
  }

  clear(): void {
    const entries = MetadataStorage.getAll<boolean>(RESOLVERS_KEY);

    for (const entry of entries) {
      MetadataStorage.delete(RESOLVERS_KEY, entry.target, entry.propertyKey);
    }
  }
}

export const resolverRegistry = new ResolverRegistry();
