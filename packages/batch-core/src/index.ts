/**
 * @packageDocumentation
 *
 * @croco/batch-core
 *
 * 대용량 데이터 처리를 위한 배치 프레임워크입니다. Spring Batch의 개념(Reader, Processor, Writer)을 차용하여 Node.js 환경에 맞게 구현했습니다.
 *
 * @remarks
 * 이 패키지는 청크(Chunk) 지향 처리, 체크포인트 기반 재시작, 타입 안전성을 제공합니다.
 *
 * @example
 * ```typescript
 * import { JobBuilder, Step } from '@croco/batch-core';
 * import type { ItemReader, ItemProcessor, ItemWriter } from '@croco/batch-core';
 *
 * const step = new Step({
 *   name: 'process-users',
 *   reader: new UserReader(),
 *   processor: new UserProcessor(),
 *   writer: new UserWriter(),
 *   chunkSize: 100
 * });
 *
 * const job = new JobBuilder('daily-batch').start(step).build();
 * await job.execute();
 * ```
 */

/**
 * ChunkExecutor - 청크 단위 실행기
 *
 * @description
 * ItemReader로 읽은 데이터를 청크 단위로 처리하고 ItemWriter로 일괄 저장합니다.
 * ItemProcessor를 통해 데이터 가공이 가능합니다.
 *
 * @remarks
 * 청크 크기는 메모리 효율성과 처리 성능의 균형을 고려하여 설정해야 합니다.
 *
 * @example
 * ```typescript
 * import { ChunkExecutor } from '@croco/batch-core';
 *
 * const executor = new ChunkExecutor(reader, processor, writer, { chunkSize: 100 });
 * await executor.execute();
 * ```
 */
export * from "./libs/ChunkExecutor";

/**
 * ItemProcessor - 아이템 처리기 인터페이스
 *
 * @description
 * Reader에서 읽은 아이템을 가공하는 역할을 담당합니다.
 * 입력 타입에서 출력 타입으로 변환하거나, null을 반환하여 필터링할 수 있습니다.
 *
 * @template I - 입력 타입
 * @template O - 출력 타입
 *
 * @example
 * ```typescript
 * class UserProcessor implements ItemProcessor<User, UserDTO> {
 *   async process(user: User): Promise<UserDTO> {
 *     return { id: user.id, name: user.name.toUpperCase() };
 *   }
 * }
 * ```
 */
export * from "./libs/interfaces/ItemProcessor";

/**
 * Checkpointable - 체크포인트 가능 인터페이스
 *
 * @description
 * 배치 작업의 재시작을 위해 현재 처리 위치를 저장하고 복구할 수 있는 기능을 정의합니다.
 *
 * @remarks
 * 대용량 배치 처리 중 실패가 발생했을 때, 마지막 체크포인트부터 재시작하기 위해 사용됩니다.
 *
 * @example
 * ```typescript
 * class DatabaseReader implements ItemReader<User>, Checkpointable {
 *   private lastId = 0;
 *
 *   async getCheckpoint(): Promise<number> {
 *     return this.lastId;
 *   }
 *
 *   async restoreCheckpoint(checkpoint: number): Promise<void> {
 *     this.lastId = checkpoint;
 *   }
 * }
 * ```
 */
export type { Checkpointable } from "./libs/interfaces/ItemReader";

/**
 * ItemReader - 아이템 리더 인터페이스 및 구현체
 *
 * @description
 * 배치 처리할 데이터 소스에서 아이템을 순차적으로 읽어오는 역할을 담당합니다.
 * 데이터가 더 이상 없을 때 null을 반환합니다.
 *
 * @template T - 읽어올 아이템 타입
 *
 * @remarks
 * 데이터베이스 커서, 파일 스트림, API 호출 등 다양한 데이터 소스를 추상화합니다.
 *
 * @example
 * ```typescript
 * class UserReader implements ItemReader<User> {
 *   private offset = 0;
 *
 *   async read(): Promise<User | null> {
 *     const user = await db.findOne({ skip: this.offset });
 *     this.offset++;
 *     return user;
 *   }
 * }
 * ```
 */
export * from "./libs/interfaces/ItemReader";

/**
 * ItemWriter - 아이템 라터 인터페이스
 *
 * @description
 * 처리가 완료된 아이템들을 일괄 저장하는 역할을 담당합니다.
 * 청크 단위로 배열을 받아서 처리합니다.
 *
 * @template T - 저장할 아이템 타입
 *
 * @remarks
 * 벌크 INSERT, 메시지 큐 발행, 파일 쓰기 등 일괄 처리 작업에 사용됩니다.
 *
 * @example
 * ```typescript
 * class UserWriter implements ItemWriter<UserDTO> {
 *   async write(items: UserDTO[]): Promise<void> {
 *     await db.users.insertMany(items);
 *   }
 * }
 * ```
 */
export * from "./libs/interfaces/ItemWriter";

/**
 * JobBuilder - 배치 잡 빌더
 *
 * @description
 * 여러 스텝(Step)을 조합하여 배치 잡(Job)을 구성하는 빌더 클래스입니다.
 *
 * @remarks
 * 복잡한 배치 작업을 유창한 API로 구성할 수 있습니다.
 *
 * @example
 * ```typescript
 * const job = new JobBuilder('daily-user-batch')
 *   .start(preprocessStep)
 *   .next(processStep)
 *   .next(cleanupStep)
 *   .build();
 *
 * await job.execute();
 * ```
 */
export * from "./libs/JobBuilder";
export * from "./libs/StepFailure";

/**
 * Step - 배치 스텝
 *
 * @description
 * Reader, Processor, Writer를 조합하여 단일 배치 처리 단계를 정의합니다.
 *
 * @remarks
 * 스텝은 배치 작업의 재사용 가능한 단위입니다. 실패 시 독립적으로 재시작할 수 있습니다.
 *
 * @example
 * ```typescript
 * const step = new Step({
 *   name: 'process-active-users',
 *   reader: new UserReader(),
 *   processor: new UserProcessor(),
 *   writer: new UserWriter(),
 *   chunkSize: 100
 * });
 * ```
 */
export * from "./libs/Step";
