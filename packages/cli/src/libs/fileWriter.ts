import { writeFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { ok as assert } from "node:assert/strict";
import { dirname } from "node:path";

export type WriteStatus = "created" | "skipped-dry-run" | "overwritten" | "exists-no-overwrite";

export interface WriteOptions {
  dryRun?: boolean;
  overwrite?: boolean;
}

export interface WriteResult {
  status: WriteStatus;
  path: string;
  diff?: string;
}

type DiffLine = {
  text: string;
  hasNewline: boolean;
};

type DiffOperation = {
  kind: "context" | "delete" | "insert";
  line: DiffLine;
};

type LineEdit = {
  kind: "delete" | "insert";
  oldIndex: number;
  newIndex: number;
};

type PatienceAnchor = {
  oldIndex: number;
  newIndex: number;
};

type OperationRecord = {
  operation: DiffOperation;
  oldLinesBefore: number;
  newLinesBefore: number;
};

type HunkAccumulator = {
  oldLinesBefore: number;
  newLinesBefore: number;
  oldCount: number;
  newCount: number;
  bodyLineCount: number;
  bodyLines: string[];
  trailingContext: OperationRecord[];
};

const DIFF_CONTEXT_LINES = 3;
const MAX_DIFF_OUTPUT_LINES = 200;
const MAX_EXACT_EDIT_DISTANCE = MAX_DIFF_OUTPUT_LINES;
const FALLBACK_ALIGNMENT_WINDOW = 64;

export async function write(
  targetPath: string,
  content: string,
  options: WriteOptions = {},
): Promise<WriteResult> {
  const { dryRun = false, overwrite = false } = options;
  const exists = existsSync(targetPath);

  if (dryRun) {
    const diff = exists
      ? await generateDiff(targetPath, content)
      : `+${content.split("\n").length} lines`;
    return { status: "skipped-dry-run", path: targetPath, diff };
  }

  if (exists && !overwrite) {
    return { status: "exists-no-overwrite", path: targetPath };
  }

  await mkdir(dirname(targetPath), { recursive: true });
  const diff = exists ? await generateDiff(targetPath, content) : undefined;
  await writeFile(targetPath, content, "utf-8");
  return {
    status: exists ? "overwritten" : "created",
    path: targetPath,
    ...(diff === undefined ? {} : { diff }),
  };
}

async function generateDiff(filePath: string, newContent: string): Promise<string> {
  const oldContent = await readFile(filePath, "utf-8");
  if (oldContent === newContent) {
    return "";
  }

  const operations = createDiffOperations(splitContent(oldContent), splitContent(newContent));
  const headers = [`--- ${filePath}`, `+++ ${filePath}`];
  const rendered = renderHunks(operations, MAX_DIFF_OUTPUT_LINES - headers.length);
  const totalLineCount = headers.length + rendered.totalLineCount;

  if (totalLineCount <= MAX_DIFF_OUTPUT_LINES) {
    return [...headers, ...rendered.lines].join("\n") + "\n";
  }

  const visibleLineCount = MAX_DIFF_OUTPUT_LINES - 1;
  return (
    [
      ...headers,
      ...rendered.lines.slice(0, visibleLineCount - headers.length),
      `... diff truncated (showing first ${visibleLineCount} of ${totalLineCount} lines) ...`,
    ].join("\n") + "\n"
  );
}

function splitContent(content: string): DiffLine[] {
  if (content.length === 0) {
    return [];
  }

  const hasFinalNewline = content.endsWith("\n");
  const lines = content.split("\n");
  if (hasFinalNewline) {
    lines.pop();
  }

  return lines.map((text, index) => ({
    text,
    hasNewline: index < lines.length - 1 || hasFinalNewline,
  }));
}

function* createDiffOperations(
  oldLines: DiffLine[],
  newLines: DiffLine[],
): Iterable<DiffOperation> {
  let prefixLength = 0;
  while (
    prefixLength < oldLines.length &&
    prefixLength < newLines.length &&
    linesEqual(itemAt(oldLines, prefixLength), itemAt(newLines, prefixLength))
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength + prefixLength < oldLines.length &&
    suffixLength + prefixLength < newLines.length &&
    linesEqual(
      itemAt(oldLines, oldLines.length - 1 - suffixLength),
      itemAt(newLines, newLines.length - 1 - suffixLength),
    )
  ) {
    suffixLength += 1;
  }

  const oldEnd = oldLines.length - suffixLength;
  const newEnd = newLines.length - suffixLength;

  for (let index = 0; index < prefixLength; index++) {
    yield toContextOperation(itemAt(oldLines, index));
  }
  yield* createLineDiff(oldLines, prefixLength, oldEnd, newLines, prefixLength, newEnd);
  for (let index = oldEnd; index < oldLines.length; index++) {
    yield toContextOperation(itemAt(oldLines, index));
  }
}

function* createLineDiff(
  oldLines: DiffLine[],
  oldStart: number,
  oldEnd: number,
  newLines: DiffLine[],
  newStart: number,
  newEnd: number,
): Iterable<DiffOperation> {
  const exactEdits = findExactEdits(oldLines, oldStart, oldEnd, newLines, newStart, newEnd);
  if (exactEdits !== undefined) {
    yield* operationsFromEdits(oldLines, oldStart, oldEnd, newLines, newStart, newEnd, exactEdits);
    return;
  }

  const anchors = findPatienceAnchors(oldLines, oldStart, oldEnd, newLines, newStart, newEnd);
  if (anchors.length === 0) {
    yield* createAlignedFallback(oldLines, oldStart, oldEnd, newLines, newStart, newEnd);
    return;
  }

  let oldCursor = oldStart;
  let newCursor = newStart;
  for (const anchor of anchors) {
    yield* createBoundedSegment(
      oldLines,
      oldCursor,
      anchor.oldIndex,
      newLines,
      newCursor,
      anchor.newIndex,
    );
    yield toContextOperation(itemAt(oldLines, anchor.oldIndex));
    oldCursor = anchor.oldIndex + 1;
    newCursor = anchor.newIndex + 1;
  }
  yield* createBoundedSegment(oldLines, oldCursor, oldEnd, newLines, newCursor, newEnd);
}

function* createBoundedSegment(
  oldLines: DiffLine[],
  oldStart: number,
  oldEnd: number,
  newLines: DiffLine[],
  newStart: number,
  newEnd: number,
): Iterable<DiffOperation> {
  const exactEdits = findExactEdits(oldLines, oldStart, oldEnd, newLines, newStart, newEnd);
  if (exactEdits === undefined) {
    yield* createAlignedFallback(oldLines, oldStart, oldEnd, newLines, newStart, newEnd);
    return;
  }

  yield* operationsFromEdits(oldLines, oldStart, oldEnd, newLines, newStart, newEnd, exactEdits);
}

function findExactEdits(
  oldLines: DiffLine[],
  oldStart: number,
  oldEnd: number,
  newLines: DiffLine[],
  newStart: number,
  newEnd: number,
): LineEdit[] | undefined {
  const oldLength = oldEnd - oldStart;
  const newLength = newEnd - newStart;
  const maxDistance = oldLength + newLength;
  const distanceLimit = Math.min(maxDistance, MAX_EXACT_EDIT_DISTANCE);
  const offset = distanceLimit + 1;
  const frontier = new Int32Array(distanceLimit * 2 + 3);
  frontier.fill(-1);
  frontier[offset + 1] = 0;
  const trace: Int32Array[] = [];

  for (let distance = 0; distance <= distanceLimit; distance++) {
    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      const diagonalIndex = offset + diagonal;
      let oldIndex: number;

      if (
        diagonal === -distance ||
        (diagonal !== distance &&
          itemAt(frontier, diagonalIndex - 1) < itemAt(frontier, diagonalIndex + 1))
      ) {
        oldIndex = itemAt(frontier, diagonalIndex + 1);
      } else {
        oldIndex = itemAt(frontier, diagonalIndex - 1) + 1;
      }

      let newIndex = oldIndex - diagonal;
      while (
        oldIndex < oldLength &&
        newIndex < newLength &&
        linesEqual(itemAt(oldLines, oldStart + oldIndex), itemAt(newLines, newStart + newIndex))
      ) {
        oldIndex += 1;
        newIndex += 1;
      }

      frontier[diagonalIndex] = oldIndex;
      if (oldIndex >= oldLength && newIndex >= newLength) {
        trace.push(frontier.slice());
        return backtrackEdits(oldLength, newLength, oldStart, newStart, trace, offset);
      }
    }

    trace.push(frontier.slice());
  }

  return undefined;
}

function backtrackEdits(
  oldLength: number,
  newLength: number,
  oldStart: number,
  newStart: number,
  trace: Int32Array[],
  offset: number,
): LineEdit[] {
  const edits: LineEdit[] = [];
  let oldIndex = oldLength;
  let newIndex = newLength;

  for (let distance = trace.length - 1; distance > 0; distance--) {
    const previousFrontier = itemAt(trace, distance - 1);
    const diagonal = oldIndex - newIndex;
    const diagonalIndex = offset + diagonal;
    const previousDiagonal =
      diagonal === -distance ||
      (diagonal !== distance &&
        itemAt(previousFrontier, diagonalIndex - 1) < itemAt(previousFrontier, diagonalIndex + 1))
        ? diagonal + 1
        : diagonal - 1;
    const previousOldIndex = itemAt(previousFrontier, offset + previousDiagonal);
    const previousNewIndex = previousOldIndex - previousDiagonal;

    while (oldIndex > previousOldIndex && newIndex > previousNewIndex) {
      oldIndex -= 1;
      newIndex -= 1;
    }

    if (oldIndex === previousOldIndex) {
      newIndex -= 1;
      edits.push({
        kind: "insert",
        oldIndex: oldStart + oldIndex,
        newIndex: newStart + newIndex,
      });
    } else {
      oldIndex -= 1;
      edits.push({
        kind: "delete",
        oldIndex: oldStart + oldIndex,
        newIndex: newStart + newIndex,
      });
    }
  }

  while (oldIndex > 0) {
    oldIndex -= 1;
    edits.push({ kind: "delete", oldIndex: oldStart + oldIndex, newIndex: newStart });
  }
  while (newIndex > 0) {
    newIndex -= 1;
    edits.push({ kind: "insert", oldIndex: oldStart, newIndex: newStart + newIndex });
  }

  return edits.reverse();
}

function* operationsFromEdits(
  oldLines: DiffLine[],
  oldStart: number,
  oldEnd: number,
  newLines: DiffLine[],
  newStart: number,
  newEnd: number,
  edits: LineEdit[],
): Iterable<DiffOperation> {
  let oldCursor = oldStart;
  let newCursor = newStart;

  for (const edit of edits) {
    while (oldCursor < edit.oldIndex && newCursor < edit.newIndex) {
      assert(linesEqual(itemAt(oldLines, oldCursor), itemAt(newLines, newCursor)));
      yield toContextOperation(itemAt(oldLines, oldCursor));
      oldCursor += 1;
      newCursor += 1;
    }

    assert(oldCursor === edit.oldIndex && newCursor === edit.newIndex);
    if (edit.kind === "delete") {
      yield { kind: "delete", line: itemAt(oldLines, oldCursor) };
      oldCursor += 1;
    } else {
      yield { kind: "insert", line: itemAt(newLines, newCursor) };
      newCursor += 1;
    }
  }

  while (oldCursor < oldEnd && newCursor < newEnd) {
    assert(linesEqual(itemAt(oldLines, oldCursor), itemAt(newLines, newCursor)));
    yield toContextOperation(itemAt(oldLines, oldCursor));
    oldCursor += 1;
    newCursor += 1;
  }
  while (oldCursor < oldEnd) {
    yield { kind: "delete", line: itemAt(oldLines, oldCursor) };
    oldCursor += 1;
  }
  while (newCursor < newEnd) {
    yield { kind: "insert", line: itemAt(newLines, newCursor) };
    newCursor += 1;
  }
}

function findPatienceAnchors(
  oldLines: DiffLine[],
  oldStart: number,
  oldEnd: number,
  newLines: DiffLine[],
  newStart: number,
  newEnd: number,
): PatienceAnchor[] {
  const oldPositions = collectUniqueLinePositions(oldLines, oldStart, oldEnd);
  const newPositions = collectUniqueLinePositions(newLines, newStart, newEnd);
  const candidates: PatienceAnchor[] = [];

  for (let oldIndex = oldStart; oldIndex < oldEnd; oldIndex++) {
    const key = lineKey(itemAt(oldLines, oldIndex));
    if (oldPositions.get(key) !== oldIndex) continue;
    const newIndex = newPositions.get(key);
    if (newIndex !== undefined && newIndex >= 0) {
      candidates.push({ oldIndex, newIndex });
    }
  }

  if (candidates.length < 2) {
    return candidates;
  }

  const tails: number[] = [];
  const predecessors = new Int32Array(candidates.length);
  predecessors.fill(-1);

  for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
    const candidate = itemAt(candidates, candidateIndex);
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const tail = itemAt(candidates, itemAt(tails, middle));
      if (tail.newIndex < candidate.newIndex) low = middle + 1;
      else high = middle;
    }

    if (low > 0) predecessors[candidateIndex] = itemAt(tails, low - 1);
    if (low === tails.length) tails.push(candidateIndex);
    else tails[low] = candidateIndex;
  }

  const anchors: PatienceAnchor[] = [];
  let candidateIndex = itemAt(tails, tails.length - 1);
  while (candidateIndex >= 0) {
    anchors.push(itemAt(candidates, candidateIndex));
    candidateIndex = itemAt(predecessors, candidateIndex);
  }
  return anchors.reverse();
}

function collectUniqueLinePositions(
  lines: DiffLine[],
  start: number,
  end: number,
): Map<string, number> {
  const positions = new Map<string, number>();
  for (let index = start; index < end; index++) {
    const key = lineKey(itemAt(lines, index));
    positions.set(key, positions.has(key) ? -1 : index);
  }
  return positions;
}

function lineKey(line: DiffLine): string {
  return JSON.stringify([line.text, line.hasNewline]);
}

function* createAlignedFallback(
  oldLines: DiffLine[],
  oldStart: number,
  oldEnd: number,
  newLines: DiffLine[],
  newStart: number,
  newEnd: number,
): Iterable<DiffOperation> {
  let oldCursor = oldStart;
  let newCursor = newStart;

  while (oldCursor < oldEnd && newCursor < newEnd) {
    if (linesEqual(itemAt(oldLines, oldCursor), itemAt(newLines, newCursor))) {
      yield toContextOperation(itemAt(oldLines, oldCursor));
      oldCursor += 1;
      newCursor += 1;
      continue;
    }

    const insertionDistance = findMatchingLine(
      itemAt(oldLines, oldCursor),
      newLines,
      newCursor + 1,
      newEnd,
    );
    const deletionDistance = findMatchingLine(
      itemAt(newLines, newCursor),
      oldLines,
      oldCursor + 1,
      oldEnd,
    );

    if (
      insertionDistance !== undefined &&
      (deletionDistance === undefined || insertionDistance <= deletionDistance)
    ) {
      for (let count = 0; count < insertionDistance; count++) {
        yield { kind: "insert", line: itemAt(newLines, newCursor) };
        newCursor += 1;
      }
      continue;
    }
    if (deletionDistance !== undefined) {
      for (let count = 0; count < deletionDistance; count++) {
        yield { kind: "delete", line: itemAt(oldLines, oldCursor) };
        oldCursor += 1;
      }
      continue;
    }

    yield { kind: "delete", line: itemAt(oldLines, oldCursor) };
    yield { kind: "insert", line: itemAt(newLines, newCursor) };
    oldCursor += 1;
    newCursor += 1;
  }

  while (oldCursor < oldEnd) {
    yield { kind: "delete", line: itemAt(oldLines, oldCursor) };
    oldCursor += 1;
  }
  while (newCursor < newEnd) {
    yield { kind: "insert", line: itemAt(newLines, newCursor) };
    newCursor += 1;
  }
}

function findMatchingLine(
  line: DiffLine,
  lines: DiffLine[],
  start: number,
  end: number,
): number | undefined {
  const limit = Math.min(end, start + FALLBACK_ALIGNMENT_WINDOW);
  for (let index = start; index < limit; index++) {
    if (linesEqual(line, itemAt(lines, index))) {
      return index - start + 1;
    }
  }
  return undefined;
}

function renderHunks(
  operations: Iterable<DiffOperation>,
  maxVisibleLines: number,
): { lines: string[]; totalLineCount: number } {
  const visibleLines: string[] = [];
  let totalLineCount = 0;
  let oldLinesBefore = 0;
  let newLinesBefore = 0;
  let activeHunk: HunkAccumulator | undefined;
  let pendingContext: OperationRecord[] = [];

  const appendVisible = (line: string): void => {
    totalLineCount += 1;
    if (visibleLines.length < maxVisibleLines) visibleLines.push(line);
  };
  const commitRecord = (hunk: HunkAccumulator, record: OperationRecord): void => {
    const { operation } = record;
    if (operation.kind !== "insert") hunk.oldCount += 1;
    if (operation.kind !== "delete") hunk.newCount += 1;
    const prefix = operation.kind === "context" ? " " : operation.kind === "delete" ? "-" : "+";
    hunk.bodyLineCount += 1;
    if (hunk.bodyLines.length < maxVisibleLines) {
      hunk.bodyLines.push(`${prefix}${operation.line.text}`);
    }
    if (!operation.line.hasNewline) {
      hunk.bodyLineCount += 1;
      if (hunk.bodyLines.length < maxVisibleLines) {
        hunk.bodyLines.push("\\ No newline at end of file");
      }
    }
  };
  const startHunk = (records: OperationRecord[]): HunkAccumulator => {
    const first = itemAt(records, 0);
    const hunk: HunkAccumulator = {
      oldLinesBefore: first.oldLinesBefore,
      newLinesBefore: first.newLinesBefore,
      oldCount: 0,
      newCount: 0,
      bodyLineCount: 0,
      bodyLines: [],
      trailingContext: [],
    };
    for (const record of records) commitRecord(hunk, record);
    return hunk;
  };
  const finishHunk = (hunk: HunkAccumulator): void => {
    const oldStart = hunk.oldLinesBefore + (hunk.oldCount === 0 ? 0 : 1);
    const newStart = hunk.newLinesBefore + (hunk.newCount === 0 ? 0 : 1);
    appendVisible(`@@ -${oldStart},${hunk.oldCount} +${newStart},${hunk.newCount} @@`);
    totalLineCount += hunk.bodyLineCount;
    for (const line of hunk.bodyLines) {
      if (visibleLines.length >= maxVisibleLines) break;
      visibleLines.push(line);
    }
  };

  for (const operation of operations) {
    const record = { operation, oldLinesBefore, newLinesBefore };
    if (operation.kind !== "insert") oldLinesBefore += 1;
    if (operation.kind !== "delete") newLinesBefore += 1;

    if (operation.kind === "context") {
      if (activeHunk === undefined) {
        pendingContext.push(record);
        if (pendingContext.length > DIFF_CONTEXT_LINES) pendingContext.shift();
      } else {
        activeHunk.trailingContext.push(record);
        if (activeHunk.trailingContext.length > DIFF_CONTEXT_LINES * 2) {
          for (const context of activeHunk.trailingContext.slice(0, DIFF_CONTEXT_LINES)) {
            commitRecord(activeHunk, context);
          }
          pendingContext = activeHunk.trailingContext.slice(-DIFF_CONTEXT_LINES);
          finishHunk(activeHunk);
          activeHunk = undefined;
        }
      }
      continue;
    }

    if (activeHunk === undefined) {
      activeHunk = startHunk([...pendingContext, record]);
      pendingContext = [];
    } else {
      for (const context of activeHunk.trailingContext) commitRecord(activeHunk, context);
      activeHunk.trailingContext = [];
      commitRecord(activeHunk, record);
    }
  }

  if (activeHunk !== undefined) {
    for (const context of activeHunk.trailingContext.slice(0, DIFF_CONTEXT_LINES)) {
      commitRecord(activeHunk, context);
    }
    finishHunk(activeHunk);
  }

  return { lines: visibleLines, totalLineCount };
}

function linesEqual(left: DiffLine, right: DiffLine): boolean {
  return left.text === right.text && left.hasNewline === right.hasNewline;
}

function toContextOperation(line: DiffLine): DiffOperation {
  return { kind: "context", line };
}

function itemAt<T>(items: ArrayLike<T>, index: number): T {
  const item = items[index];
  assert(item !== undefined, `Unified diff index ${index} is out of bounds.`);
  return item;
}
