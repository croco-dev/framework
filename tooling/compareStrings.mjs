/**
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
export function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
