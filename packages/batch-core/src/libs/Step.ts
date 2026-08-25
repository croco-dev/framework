import type { ItemProcessor } from "./interfaces/ItemProcessor";
import type { ItemReader } from "./interfaces/ItemReader";
import type { ItemWriter } from "./interfaces/ItemWriter";
import { assertValidChunkSize } from "./ChunkSize";
import { assertValidBatchStepName } from "./problems/BatchStepProblems";
import type { StepFailureClassifier } from "./StepFailure";

export interface StepOptions<I, O> {
  name: string;
  reader: ItemReader<I>;
  processor?: ItemProcessor<I, O>;
  writer: ItemWriter<O>;
  chunkSize?: number;
  classifyFailure?: StepFailureClassifier;
}

export class Step<I, O> {
  public readonly name: string;
  public readonly reader: ItemReader<I>;
  public readonly processor?: ItemProcessor<I, O>;
  public readonly writer: ItemWriter<O>;
  public readonly chunkSize: number;
  public readonly classifyFailure?: StepFailureClassifier;

  constructor(options: StepOptions<I, O>) {
    const chunkSize = options.chunkSize ?? 10;
    assertValidBatchStepName(options.name);
    assertValidChunkSize(chunkSize);
    this.name = options.name;
    this.reader = options.reader;
    this.processor = options.processor;
    this.writer = options.writer;
    this.chunkSize = chunkSize;
    this.classifyFailure = options.classifyFailure;
  }
}
