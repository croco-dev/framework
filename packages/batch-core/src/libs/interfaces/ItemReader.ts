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

export function isCheckpointable(obj: unknown): obj is Checkpointable {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'getCheckpoint' in obj &&
    typeof (obj as Checkpointable).getCheckpoint === 'function' &&
    'restoreCheckpoint' in obj &&
    typeof (obj as Checkpointable).restoreCheckpoint === 'function'
  );
}
