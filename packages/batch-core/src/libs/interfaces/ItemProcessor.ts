export interface ItemProcessor<I, O> {
  /**
   * Process the input item and return a modified item.
   * Returns null if the item should be filtered out.
   */
  process(item: I): Promise<O | null>;
}
