export interface TxAdapter<TClient, TOptions = unknown> {
  transaction<T>(fn: (client: TClient) => Promise<T>, options?: TOptions): Promise<T>;

  savepoint<T>(client: TClient, fn: (client: TClient) => Promise<T>, options?: TOptions): Promise<T>;

  supportsSavepoint(): boolean;
}



