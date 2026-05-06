export type DatabaseClient = {
  execute: (query: unknown) => Promise<unknown>;
  transaction?: <T>(fn: (tx: DatabaseClient) => Promise<T>) => Promise<T>;
};
