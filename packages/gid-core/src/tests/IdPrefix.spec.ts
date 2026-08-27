import { describe, expect, expectTypeOf, it } from "vitest";
import type { IdOf } from "../libs/defineIdPrefixes";
import { defineIdPrefixes } from "../libs/defineIdPrefixes";
import { IdPrefix } from "../libs/IdPrefix";
import type { PrefixedId } from "../libs/IdPrefix";
import { DuplicateIdPrefixProblem, InvalidIdPrefixProblem } from "../libs/problems/GidProblems";

describe("IdPrefix", () => {
  describe("generate", () => {
    it("올바른 형식의 ID를 생성한다", () => {
      const UserId = new IdPrefix("usr");
      const WorkspaceId = new IdPrefix("wks");

      const userId = UserId.generate();
      const workspaceId = WorkspaceId.generate();

      expect(userId).toMatch(/^usr_[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/);
      expect(workspaceId).toMatch(/^wks_[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/);
    });

    it("생성된 ID의 길이가 정확하다", () => {
      const prefix = new IdPrefix("tst");
      const id = prefix.generate();
      expect(id.length).toBe(IdPrefix.getLength(3));
    });

    it("긴 프리픽스도 지원한다", () => {
      const LongPrefix = new IdPrefix("longprefix");
      const id = LongPrefix.generate();
      expect(id).toMatch(/^longprefix_[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/);
      expect(id.length).toBe(IdPrefix.getLength(10));
    });
  });

  describe("validate", () => {
    it("유효한 ID를 검증한다", () => {
      const TestId = new IdPrefix("val");
      const validId = TestId.generate();
      expect(TestId.validate(validId)).toBe(true);
    });

    it("잘못된 prefix를 가진 ID는 거부한다", () => {
      const TypeA = new IdPrefix("tpa");
      const TypeB = new IdPrefix("tpb");
      const idA = TypeA.generate();
      expect(TypeB.validate(idA)).toBe(false);
    });

    it("길이가 잘못된 ID는 거부한다", () => {
      const TestId = new IdPrefix("len");
      expect(TestId.validate("len_123")).toBe(false);
      expect(TestId.validate("len_")).toBe(false);
    });

    it("prefix가 없는 ID는 거부한다", () => {
      const TestId = new IdPrefix("pfx");
      expect(TestId.validate("01HQVXYZ123456789012345678")).toBe(false);
    });

    it("잘못된 ULID 형식은 거부한다", () => {
      const TestId = new IdPrefix("uld");
      expect(TestId.validate("uld_invalidulid123456789012")).toBe(false);
      expect(TestId.validate("uld_01HQVXYZ12345678901234567!")).toBe(false);
    });

    it("빈 문자열은 거부한다", () => {
      const TestId = new IdPrefix("emp");
      expect(TestId.validate("")).toBe(false);
    });

    it("null이나 undefined는 거부한다", () => {
      const TestId = new IdPrefix("nul");
      expect(TestId.validate(null)).toBe(false);
      expect(TestId.validate(undefined)).toBe(false);
    });

    it("숫자나 객체는 거부한다", () => {
      const TestId = new IdPrefix("obj");
      expect(TestId.validate(123)).toBe(false);
      expect(TestId.validate({})).toBe(false);
      expect(TestId.validate([])).toBe(false);
    });
  });

  describe("getLength", () => {
    it("올바른 ID 길이를 반환한다", () => {
      const expectedLength = 3 + 1 + 26;
      expect(IdPrefix.getLength()).toBe(expectedLength);
    });

    it("긴 prefix 길이도 지원한다", () => {
      const expectedLength = 5 + 1 + 26;
      expect(IdPrefix.getLength(5)).toBe(expectedLength);
    });
  });

  describe("constructor", () => {
    it.each(["", "a", "ab"])("3자 미만 프리픽스 '%s'는 거부한다", (prefix) => {
      expect(() => new IdPrefix(prefix)).toThrow(InvalidIdPrefixProblem);
      expect(() => new IdPrefix(prefix)).toThrow("between 3 and 32 characters");
    });

    it("최소 및 최대 길이의 canonical 프리픽스를 허용한다", () => {
      const minimumPrefix = new IdPrefix("a0z");
      const maximumPrefixValue = "a".repeat(32);
      const maximumPrefix = new IdPrefix(maximumPrefixValue);

      expect(minimumPrefix.getPrefix()).toBe("a0z");
      expect(minimumPrefix.validate(minimumPrefix.generate())).toBe(true);
      expect(maximumPrefix.getPrefix()).toBe(maximumPrefixValue);
      expect(maximumPrefix.validate(maximumPrefix.generate())).toBe(true);
    });

    it("32자를 초과하는 프리픽스를 거부한다", () => {
      expect(() => new IdPrefix("a".repeat(33))).toThrow(InvalidIdPrefixProblem);
      expect(() => new IdPrefix("a".repeat(33))).toThrow("between 3 and 32 characters");
    });

    it.each([
      ["공백", "usr name"],
      ["앞쪽 공백", " usr"],
      ["뒤쪽 공백", "usr "],
      ["제어 문자", "usr\n"],
      ["NUL", "usr\u0000"],
      ["ID 구분자", "usr_id"],
      ["하이픈", "usr-id"],
      ["마침표", "usr.id"],
      ["대문자", "USR"],
      ["비 ASCII 문자", "사용자"],
    ])("%s를 포함한 프리픽스를 거부한다", (_caseName, prefix) => {
      expect(() => new IdPrefix(prefix)).toThrow(InvalidIdPrefixProblem);
      expect(() => new IdPrefix(prefix)).toThrow("lowercase ASCII letters and digits");
    });

    it("오류에는 prefix 원문을 노출하지 않고 안전한 이유 메타데이터를 남긴다", () => {
      const unsafePrefix = "secret\nvalue";

      try {
        new IdPrefix(unsafePrefix);
        expect.unreachable("Expected invalid prefix construction to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidIdPrefixProblem);
        expect(error).toMatchObject({
          extensions: {
            reason: "invalid-characters",
            length: unsafePrefix.length,
            minimumLength: 3,
            maximumLength: 32,
            grammar: "^[a-z0-9]{3,32}$",
            retryable: false,
          },
        });
        expect((error as InvalidIdPrefixProblem).detail).not.toContain(unsafePrefix);
      }
    });
  });
});

describe("defineIdPrefixes", () => {
  it("IdPrefix와 동일한 canonical 프리픽스 검증을 적용한다", () => {
    expect(() =>
      defineIdPrefixes({
        USER: "usr_id",
      } as const),
    ).toThrow(InvalidIdPrefixProblem);
  });

  it("리터럴 중복 프리픽스를 컴파일 타임에 거부한다", () => {
    const compileTimeCheck = () => {
      // @ts-expect-error Literal prefix values must remain unique.
      defineIdPrefixes({ USER: "usr", ACCOUNT: "usr" } as const);
    };

    expect(compileTimeCheck).toBeTypeOf("function");
  });

  it("유한 유니온 타입의 고유 프리픽스를 허용한다", () => {
    const userPrefix = "usr" as "usr" | "ord";
    const accountPrefix = "ord" as "usr" | "ord";
    const Ids = defineIdPrefixes({ USER: userPrefix, ACCOUNT: accountPrefix } as const);

    expect(Ids.USER.getPrefix()).toBe("usr");
    expect(Ids.ACCOUNT.getPrefix()).toBe("ord");
  });

  it("유한 유니온 타입의 중복 프리픽스를 런타임에 거부한다", () => {
    const userPrefix = "usr" as "usr" | "ord";
    const accountPrefix = "usr" as "usr" | "ord";

    expect(() => defineIdPrefixes({ USER: userPrefix, ACCOUNT: accountPrefix } as const)).toThrow(
      DuplicateIdPrefixProblem,
    );
  });

  it("IdPrefix 인스턴스들을 생성한다", () => {
    const Ids = defineIdPrefixes({
      USER: "usr",
      ORDER: "ord",
    } as const);

    expect(typeof Ids.USER.generate).toBe("function");
    expect(typeof Ids.USER.validate).toBe("function");
    expect(typeof Ids.ORDER.generate).toBe("function");
  });

  it("generate가 올바른 형식의 ID를 생성한다", () => {
    const Ids = defineIdPrefixes({
      PRODUCT: "prd",
    } as const);

    const id = Ids.PRODUCT.generate();
    expect(id).toMatch(/^prd_[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/);
  });

  it("validate가 올바르게 동작한다", () => {
    const Ids = defineIdPrefixes({
      ITEM: "itm",
    } as const);

    const id = Ids.ITEM.generate();
    expect(Ids.ITEM.validate(id)).toBe(true);
    expect(Ids.ITEM.validate("wrong_id")).toBe(false);
  });

  it("getPrefix가 프리픽스를 반환한다", () => {
    const Ids = defineIdPrefixes({
      CATEGORY: "cat",
    } as const);

    expect(Ids.CATEGORY.getPrefix()).toBe("cat");
  });

  it("공개된 모든 필드를 안전하게 열거할 수 있다", () => {
    const Ids = defineIdPrefixes({
      TEST: "tst",
    } as const);

    expect(() => Object.values(Ids.TEST)).not.toThrow();
    expect(Object.keys(Ids.TEST)).toEqual([
      "generate",
      "validate",
      "getPrefix",
      "getExpectedLength",
    ]);
    expect("Id" in Ids.TEST).toBe(false);
  });

  it("IdOf가 registry entry의 literal prefix를 보존한다", () => {
    const Ids = defineIdPrefixes({
      USER: "usr",
      ORDER: "ord",
    } as const);

    expectTypeOf<IdOf<typeof Ids.USER>>().toEqualTypeOf<PrefixedId<"usr">>();
    expectTypeOf<IdOf<typeof Ids.ORDER>>().toEqualTypeOf<PrefixedId<"ord">>();
    expectTypeOf(Ids.USER.generate()).toEqualTypeOf<IdOf<typeof Ids.USER>>();

    // @ts-expect-error runtime-only entries no longer expose a type marker property
    void Ids.USER.Id;
  });

  it("계산된 동적 설정의 중복 프리픽스를 거부한다", () => {
    const prefix = "usr";
    const config: Record<string, string> = {
      USER: prefix,
      ACCOUNT: prefix,
      ORDER: "ord",
    };

    expect(() => defineIdPrefixes(config)).toThrow(DuplicateIdPrefixProblem);
    expect(() => defineIdPrefixes(config)).toThrow(
      "GID prefix 'usr' is configured for both 'USER' and 'ACCOUNT'.",
    );
  });

  it("스프레드로 조합된 동적 설정의 중복 프리픽스를 거부한다", () => {
    const shared: Record<string, string> = { USER: "usr" };
    const config: Record<string, string> = {
      ...shared,
      ACCOUNT: "usr",
    };

    expect(() => defineIdPrefixes(config)).toThrow(DuplicateIdPrefixProblem);
  });

  it("JSON에서 파생된 동적 설정의 중복 프리픽스를 거부한다", () => {
    const config = JSON.parse('{"USER":"usr","ACCOUNT":"usr"}') as Record<string, string>;

    expect(() => defineIdPrefixes(config)).toThrow(DuplicateIdPrefixProblem);
  });

  it("고유한 동적 설정은 기존과 동일하게 동작한다", () => {
    const config: Record<string, string> = {
      USER: "usr",
      ORDER: "ord",
    };

    const Ids = defineIdPrefixes(config);

    expect(Ids.USER?.getPrefix()).toBe("usr");
    expect(Ids.ORDER?.getPrefix()).toBe("ord");
    expect(Ids.USER?.validate(Ids.USER.generate())).toBe(true);
  });

  it("리터럴과 넓은 문자열 타입이 섞인 고유 설정을 허용한다", () => {
    const userPrefix = "usr" as string;
    const Ids = defineIdPrefixes({
      USER: userPrefix,
      ORDER: "ord",
    } as const);

    expect(Ids.USER.getPrefix()).toBe("usr");
    expect(Ids.ORDER.getPrefix()).toBe("ord");
  });
});
