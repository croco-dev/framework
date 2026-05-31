import type { ErrorRecord } from "./types";

/**
 * 고정 크기 원형 버퍼로 ErrorRecord를 저장하는 클래스.
 *
 * push 연산은 O(1) amortized이며, maxSize 초과 시 가장 오래된 항목이 자동 제거된다.
 */
export class ErrorHistoryRingBuffer {
  private readonly _maxSize: number;
  private readonly _buffer: (ErrorRecord | undefined)[];
  private _start: number;
  private _count: number;

  constructor(maxSize: number = 100) {
    if (maxSize < 1) {
      throw new Error("maxSize must be at least 1");
    }
    this._maxSize = maxSize;
    this._buffer = Array.from({ length: maxSize });
    this._start = 0;
    this._count = 0;
  }

  get maxSize(): number {
    return this._maxSize;
  }

  get size(): number {
    return this._count;
  }

  push(record: ErrorRecord): void {
    const pos = (this._start + this._count) % this._maxSize;
    this._buffer[pos] = record;

    if (this._count < this._maxSize) {
      this._count += 1;
    } else {
      this._start = (this._start + 1) % this._maxSize;
    }
  }

  getAll(): readonly ErrorRecord[] {
    return Array.from({ length: this._count }, (_, i) => {
      const idx = (this._start + this._count - 1 - i + this._maxSize) % this._maxSize;
      return this._buffer[idx] as ErrorRecord;
    });
  }

  clear(): void {
    this._start = 0;
    this._count = 0;
  }
}
