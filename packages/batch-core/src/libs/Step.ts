import type { ItemProcessor } from './interfaces/ItemProcessor';
import type { ItemReader } from './interfaces/ItemReader';
import type { ItemWriter } from './interfaces/ItemWriter';

export interface StepOptions<I, O> {
  name: string;
  reader: ItemReader<I>;
  processor?: ItemProcessor<I, O>;
  writer: ItemWriter<O>;
  chunkSize?: number;
}

export class Step<I, O> {
  public readonly name: string;
  public readonly reader: ItemReader<I>;
  public readonly processor?: ItemProcessor<I, O>;
  public readonly writer: ItemWriter<O>;
  public readonly chunkSize: number;

  constructor(options: StepOptions<I, O>) {
    this.name = options.name;
    this.reader = options.reader;
    this.processor = options.processor;
    this.writer = options.writer;
    this.chunkSize = options.chunkSize ?? 10;
  }
}
