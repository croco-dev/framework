import { ulid } from "ulid";
import { getInvalidIdPrefixReason, MINIMUM_ID_PREFIX_LENGTH } from "./idPrefixPolicy";
import { InvalidIdPrefixProblem } from "./problems/GidProblems";

const ULID_LENGTH = 26;
const ULID_REGEX = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;

export class IdPrefix<TPrefix extends string = string> {
  private readonly prefix: TPrefix;
  private readonly expectedLength: number;

  constructor(prefix: TPrefix) {
    const invalidReason = getInvalidIdPrefixReason(prefix);

    if (invalidReason !== undefined) {
      throw new InvalidIdPrefixProblem(prefix.length, MINIMUM_ID_PREFIX_LENGTH, invalidReason);
    }

    this.prefix = prefix;
    this.expectedLength = IdPrefix.getLength(prefix.length);

    this.generate = this.generate.bind(this);
    this.validate = this.validate.bind(this);
  }

  generate(): PrefixedId<TPrefix> {
    const id = `${this.prefix}_${ulid()}`;
    return id as PrefixedId<TPrefix>;
  }

  validate(id: unknown): id is PrefixedId<TPrefix> {
    if (typeof id !== "string") {
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

  static getLength(prefixLength = MINIMUM_ID_PREFIX_LENGTH): number {
    const actualPrefixLength = Math.max(prefixLength, MINIMUM_ID_PREFIX_LENGTH);
    return actualPrefixLength + 1 + ULID_LENGTH;
  }
}

export type PrefixedId<TPrefix extends string> = `${TPrefix}_${string}` & {
  readonly __brand: unique symbol;
};
