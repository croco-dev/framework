export interface ItemWriter<O> {
  /**
   * Writes a list of items.
   */
  write(items: O[]): Promise<void>;
}
