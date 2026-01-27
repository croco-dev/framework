export interface CallHandler<T = unknown> {
  handle(): Promise<T>;
}
