import type { ReadRepository } from './ReadRepository';
import type { WriteRepository } from './WriteRepository';

export interface Repository<T, ID> extends ReadRepository<T, ID>, WriteRepository<T, ID> {}
