import { describe, expect, it } from "vitest";
import {
  chosung,
  decomposeHangul,
  extractChosung,
  extractJamo,
  isHangulSyllable,
  jamo,
  KoreanChosungAdapter,
  KoreanJamoAdapter,
} from "../ko";

describe("Korean Hangul utilities", () => {
  describe("Unicode normalization", () => {
    const nfc = "한국 보고서";
    const nfd = nfc.normalize("NFD");

    it("extracts the same compatibility initials from NFC and NFD Hangul", () => {
      expect(extractChosung(nfc)).toBe("ㅎㄱ ㅂㄱㅅ");
      expect(extractChosung(nfd)).toBe(extractChosung(nfc));
    });

    it("extracts the same compatibility jamo from NFC and NFD Hangul", () => {
      expect(extractJamo(nfc)).toBe("ㅎㅏㄴㄱㅜㄱ ㅂㅗㄱㅗㅅㅓ");
      expect(extractJamo(nfd)).toBe(extractJamo(nfc));
    });

    it.each([{}, { locale: "ko" }])(
      "normalizes Korean adapter input with options %j",
      (options) => {
        const initials = new KoreanChosungAdapter();
        const decomposed = new KoreanJamoAdapter();
        expect(initials.transform(nfd, options)).toBe("ㅎㄱ ㅂㄱㅅ");
        expect(initials.transform(nfd, options)).toBe(initials.transform(nfc, options));
        expect(decomposed.transform(nfd, options)).toBe("ㅎㅏㄴㄱㅜㄱ ㅂㅗㄱㅗㅅㅓ");
        expect(decomposed.transform(nfd, options)).toBe(decomposed.transform(nfc, options));
      },
    );

    it("normalizes non-Hangul combining characters alongside Hangul", () => {
      expect(extractChosung("e\u0301 한😀")).toBe("é ㅎ😀");
      expect(extractJamo("e\u0301 한😀")).toBe("é ㅎㅏㄴ😀");
    });

    it("preserves compatibility and uncomposable archaic jamo", () => {
      const text = "ㄱㅏ \u1113\u1176";
      expect(extractChosung(text)).toBe(text);
      expect(extractJamo(text)).toBe(text);
    });
  });

  describe("isHangulSyllable", () => {
    it("returns true only for Hangul syllables block", () => {
      expect(isHangulSyllable("가")).toBe(true);
      expect(isHangulSyllable("힣")).toBe(true);
      expect(isHangulSyllable("ㄱ")).toBe(false);
      expect(isHangulSyllable("A")).toBe(false);
    });
  });

  describe("decomposeHangul", () => {
    it("decomposes Hangul syllables to chosung/jungsung/jongsung", () => {
      expect(decomposeHangul("한")).toEqual({ chosung: "ㅎ", jungsung: "ㅏ", jongsung: "ㄴ" });
      expect(decomposeHangul("가")).toEqual({ chosung: "ㄱ", jungsung: "ㅏ", jongsung: "" });
      expect(decomposeHangul("각")).toEqual({ chosung: "ㄱ", jungsung: "ㅏ", jongsung: "ㄱ" });
    });

    it("returns null for non-Hangul syllables", () => {
      expect(decomposeHangul("A")).toBeNull();
      expect(decomposeHangul("ㄱ")).toBeNull();
    });
  });

  describe("extractChosung", () => {
    it("extracts initial consonants from Hangul syllables", () => {
      expect(extractChosung("한글")).toBe("ㅎㄱ");
      expect(extractChosung("서울대학교")).toBe("ㅅㅇㄷㅎㄱ");
      expect(extractChosung("컴퓨터공학")).toBe("ㅋㅍㅌㄱㅎ");
    });

    it("preserves non-Hangul characters", () => {
      expect(extractChosung("iPhone 15 프로")).toBe("iPhone 15 ㅍㄹ");
      expect(extractChosung("123가나다")).toBe("123ㄱㄴㄷ");
    });

    it("handles edge cases", () => {
      expect(extractChosung("")).toBe("");
      expect(extractChosung("ABC")).toBe("ABC");
    });
  });

  describe("extractJamo", () => {
    it("decomposes Hangul syllables to jamo", () => {
      expect(extractJamo("한")).toBe("ㅎㅏㄴ");
      expect(extractJamo("글")).toBe("ㄱㅡㄹ");
      expect(extractJamo("가")).toBe("ㄱㅏ");
    });

    it("preserves non-Hangul characters", () => {
      expect(extractJamo("A한B")).toBe("AㅎㅏㄴB");
      expect(extractJamo("123")).toBe("123");
    });
  });

  describe("chosung() sugar", () => {
    it("returns SearchDerivedFieldConfig with Korean locale", () => {
      const config = chosung();

      expect(config.transformId).toBe("text.initials");
      expect(config.options).toEqual({ locale: "ko" });
    });
  });

  describe("jamo() sugar", () => {
    it("returns SearchDerivedFieldConfig with Korean locale and jamo form", () => {
      const config = jamo();

      expect(config.transformId).toBe("text.decomposed");
      expect(config.options).toEqual({ locale: "ko", form: "jamo" });
    });
  });
});
