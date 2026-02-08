const HANGUL_SYLLABLES_START = 0xac00;
const HANGUL_SYLLABLES_END = 0xd7a3;

const CHOSUNG = [
  'ㄱ',
  'ㄲ',
  'ㄴ',
  'ㄷ',
  'ㄸ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅃ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅉ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
];

const JUNGSUNG = [
  'ㅏ',
  'ㅐ',
  'ㅑ',
  'ㅒ',
  'ㅓ',
  'ㅔ',
  'ㅕ',
  'ㅖ',
  'ㅗ',
  'ㅘ',
  'ㅙ',
  'ㅚ',
  'ㅛ',
  'ㅜ',
  'ㅝ',
  'ㅞ',
  'ㅟ',
  'ㅠ',
  'ㅡ',
  'ㅢ',
  'ㅣ',
];

const JONGSUNG = [
  '',
  'ㄱ',
  'ㄲ',
  'ㄳ',
  'ㄴ',
  'ㄵ',
  'ㄶ',
  'ㄷ',
  'ㄹ',
  'ㄺ',
  'ㄻ',
  'ㄼ',
  'ㄽ',
  'ㄾ',
  'ㄿ',
  'ㅀ',
  'ㅁ',
  'ㅂ',
  'ㅄ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
];

export type DecomposedHangul = {
  chosung: string;
  jungsung: string;
  jongsung: string;
};

export function isHangulSyllable(char: string): boolean {
  if (char.length === 0) {
    return false;
  }

  const code = char.charCodeAt(0);
  return code >= HANGUL_SYLLABLES_START && code <= HANGUL_SYLLABLES_END;
}

export function decomposeHangul(char: string): DecomposedHangul | null {
  if (!isHangulSyllable(char)) {
    return null;
  }

  const code = char.charCodeAt(0) - HANGUL_SYLLABLES_START;
  const jongsungIndex = code % 28;
  const jungsungIndex = ((code - jongsungIndex) / 28) % 21;
  const chosungIndex = Math.floor((code - jongsungIndex) / 28 / 21);

  return {
    chosung: CHOSUNG[chosungIndex],
    jungsung: JUNGSUNG[jungsungIndex],
    jongsung: JONGSUNG[jongsungIndex],
  };
}

export function extractChosung(text: string): string {
  return [...text]
    .map((char) => {
      const decomposed = decomposeHangul(char);
      if (!decomposed) {
        return char;
      }

      return decomposed.chosung;
    })
    .join('');
}

export function extractJamo(text: string): string {
  return [...text]
    .map((char) => {
      const decomposed = decomposeHangul(char);
      if (!decomposed) {
        return char;
      }

      return `${decomposed.chosung}${decomposed.jungsung}${decomposed.jongsung}`;
    })
    .join('');
}
