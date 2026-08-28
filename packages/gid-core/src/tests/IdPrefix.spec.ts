import { describe, expect, expectTypeOf, it } from "vitest";
import type { IdOf } from "../libs/defineIdPrefixes";
import { defineIdPrefixes } from "../libs/defineIdPrefixes";
import { IdPrefix } from "../libs/IdPrefix";
import type { PrefixedId } from "../libs/IdPrefix";

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
    it("3자 미만 프리픽스는 에러를 던진다", () => {
      expect(() => new IdPrefix("ab")).toThrow("at least 3 characters");
      expect(() => new IdPrefix("a")).toThrow("at least 3 characters");
      expect(() => new IdPrefix("")).toThrow("at least 3 characters");
    });
  });
});

describe("defineIdPrefixes", () => {
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
});
