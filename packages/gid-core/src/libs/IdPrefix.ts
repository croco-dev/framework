import { ulid } from 'ulid';

const MINIMUM_PREFIX_LENGTH = 3;
const ULID_LENGTH = 26;
const ULID_REGEX = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;

export class IdPrefix<TPrefix extends string = string> {
  private readonly prefix: TPrefix;
  private readonly expectedLength: number;

  constructor(prefix: TPrefix) {
    if (prefix.length < MINIMUM_PREFIX_LENGTH) {
      throw new Error(`Prefix must be at least ${MINIMUM_PREFIX_LENGTH} characters long, but got ${prefix.length}`);
    }

    this.prefix = prefix;
    this.expectedLength = IdPrefix.getLength(prefix.length);

    this.generate = this.generate.bind(this);
    this.validate = this.validate.bind(this);
  }

  generate(): `${TPrefix}_${string}` {
    return `${this.prefix}_${ulid()}` as `${TPrefix}_${string}`;
  }

  validate(id: unknown): id is `${TPrefix}_${string}` {
    if (typeof id !== 'string') {
      return false;
    }

    if (id.length !== this.expectedLength) {
      return false;
    }

    const expectedPrefixWithUnderscore = `${this.prefix}_`;
    if (!id.startsWith(expectedPrefixWithUnderscore)) {
      return false;
    }

    const ulidPart = id.slice(this.prefix.length + 1);
    return ULID_REGEX.test(ulidPart);
  }

  getPrefix(): TPrefix {
    return this.prefix;
  }

  getExpectedLength(): number {
    return this.expectedLength;
  }

  static getLength(prefixLength = MINIMUM_PREFIX_LENGTH): number {
    const actualPrefixLength = Math.max(prefixLength, MINIMUM_PREFIX_LENGTH);
    return actualPrefixLength + 1 + ULID_LENGTH;
  }
}

export type PrefixedId<TPrefix extends string> = `${TPrefix}_${string}` & {
  readonly __brand: TPrefix;
};
