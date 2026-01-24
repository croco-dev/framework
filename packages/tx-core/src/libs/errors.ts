export class TxManagerNotRegisteredError extends Error {
  constructor(key: string) {
    super(`TxManager not registered for key: ${key}`);
    this.name = 'TxManagerNotRegisteredError';
  }
}

export class TxPropagationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TxPropagationError';
  }
}
