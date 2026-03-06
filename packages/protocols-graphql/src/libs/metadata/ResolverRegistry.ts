import { MetadataStorage } from '@croco/framework-context';
import { RESOLVERS_KEY } from '../constants';

export class ResolverRegistry {
  private static instance: ResolverRegistry;

  private readonly resolvers: Set<Function>;

  constructor(resolvers?: Iterable<Function>) {
    this.resolvers = new Set(resolvers);
  }

  static getInstance(): ResolverRegistry {
    if (!ResolverRegistry.instance) {
      ResolverRegistry.instance = new ResolverRegistry();
    }

    return ResolverRegistry.instance;
  }

  static fromMetadata(resolvers: Function[] = ResolverRegistry.getMetadataResolvers()): ResolverRegistry {
    return new ResolverRegistry(resolvers);
  }

  register(target: Function): void {
    this.resolvers.add(target);
  }

  getAll(): Function[] {
    return [...this.resolvers];
  }

  collectFromMetadata(resolvers: Function[] = ResolverRegistry.getMetadataResolvers()): void {
    for (const resolver of resolvers) {
      this.resolvers.add(resolver);
    }
  }

  clear(): void {
    this.resolvers.clear();
  }

  private static getMetadataResolvers(): Function[] {
    return MetadataStorage.getAll<boolean>(RESOLVERS_KEY).map((entry) => entry.target as Function);
  }
}

export const resolverRegistry = ResolverRegistry.getInstance();
