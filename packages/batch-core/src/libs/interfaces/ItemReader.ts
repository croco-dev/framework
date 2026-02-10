export interface ItemReader<I> {
  /**
   * Reads a piece of input data.
   * Returns null if there is no more data.
   */
  read(): Promise<I | null>;
}

export interface Checkpointable {
  /**
   * Returns the current state of the component.
   */
  getCheckpoint(): unknown;

  /**
   * Restores the component to the given state.
   */
  restoreCheckpoint(checkpoint: unknown): void;
}
