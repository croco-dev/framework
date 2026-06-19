import type {
  PolicyExecutionPlan,
  PolicyFailurePropagation,
  PolicyKind,
  PolicySource,
} from "./RuntimePolicy";
import { PipelineGraphProblem } from "./problems/PipelineGraphProblems";

export const REQUEST_PIPELINE_NODE_KINDS = [
  "middleware",
  "guard",
  "policy",
  "interceptor",
  "handler",
  "filter",
] as const;
export const REQUEST_PIPELINE_PHASES = ["before", "handler", "after", "error"] as const;
export const REQUEST_PIPELINE_FAILURE_PROPAGATIONS = [
  "continue",
  "short-circuit",
  "observe-and-rethrow",
  "terminal",
  "retryable-operation-error",
  "handle-error",
] as const;

export type RequestPipelineNodeKind = (typeof REQUEST_PIPELINE_NODE_KINDS)[number];
export type RequestPipelinePhase = (typeof REQUEST_PIPELINE_PHASES)[number];
export type RequestPipelinePath = "success" | "error";
export type RequestPipelineFailurePropagation =
  | PolicyFailurePropagation
  | "continue"
  | "short-circuit"
  | "handle-error";

/**
 * Request pipeline graph node.
 *
 * Ordering is deterministic: path phase rank, numeric order, node kind, then id.
 * Same-phase/same-order nodes are not conflicts by themselves; add dependsOn when one
 * same-slot node must precede another for semantic correctness.
 */
export type RequestPipelineNode = {
  readonly id: string;
  readonly kind: RequestPipelineNodeKind;
  readonly phase: RequestPipelinePhase;
  readonly label?: string;
  readonly order?: number;
  readonly dependsOn?: readonly string[];
  readonly failurePropagation?: RequestPipelineFailurePropagation;
  readonly policyKind?: PolicyKind;
  readonly source?: PolicySource;
};

export type ResolvedRequestPipelineNode = {
  readonly id: string;
  readonly kind: RequestPipelineNodeKind;
  readonly phase: RequestPipelinePhase;
  readonly label: string;
  readonly order: number;
  readonly dependsOn: readonly string[];
  readonly failurePropagation: RequestPipelineFailurePropagation;
  readonly policyKind?: PolicyKind;
  readonly source?: PolicySource;
};

export type RequestPipelineGraphEdgeReason = "depends-on" | "success-order" | "error-order";

export type RequestPipelineGraphEdge = {
  readonly from: string;
  readonly to: string;
  readonly reason: RequestPipelineGraphEdgeReason;
};

export type RequestPipelinePhaseOrder = {
  readonly before: readonly string[];
  readonly handler: readonly string[];
  readonly after: readonly string[];
  readonly error: readonly string[];
};

export type RequestPipelineGraph = {
  readonly target?: string;
  readonly nodes: readonly ResolvedRequestPipelineNode[];
  readonly edges: readonly RequestPipelineGraphEdge[];
  readonly successOrder: readonly string[];
  readonly errorOrder: readonly string[];
  readonly executionOrder: readonly string[];
  readonly phaseOrder: RequestPipelinePhaseOrder;
  readonly debugDump: string;
};

export type CompileRequestPipelineGraphOptions = {
  readonly target?: string;
  readonly policyPlan?: PolicyExecutionPlan;
  readonly requireHandler?: boolean;
};

export type PolicyPipelineNodeOptions = {
  readonly idPrefix?: string;
  readonly orderOffset?: number;
};

const PHASE_ORDER: Readonly<Record<RequestPipelinePhase, number>> = {
  before: 10,
  handler: 20,
  after: 30,
  error: 40,
};

const KIND_ORDER: Readonly<Record<RequestPipelineNodeKind, number>> = {
  middleware: 10,
  guard: 20,
  policy: 30,
  interceptor: 40,
  handler: 50,
  filter: 60,
};
const DEFAULT_POLICY_NODE_ORDER_OFFSET = 200;

const DEFAULT_FAILURE_PROPAGATION: Readonly<
  Record<RequestPipelineNodeKind, RequestPipelineFailurePropagation>
> = {
  middleware: "short-circuit",
  guard: "terminal",
  policy: "observe-and-rethrow",
  interceptor: "observe-and-rethrow",
  handler: "terminal",
  filter: "handle-error",
};

export function requestPipelineNodesFromPolicyPlan(
  plan: PolicyExecutionPlan,
  options: PolicyPipelineNodeOptions = {},
): readonly RequestPipelineNode[] {
  const idPrefix = options.idPrefix ?? "policy";
  const orderOffset = options.orderOffset ?? DEFAULT_POLICY_NODE_ORDER_OFFSET;

  return plan.entries.map((entry) => ({
    id: `${idPrefix}:${entry.policy.kind}`,
    kind: "policy",
    phase: "before",
    label: `policy:${entry.policy.kind}`,
    order: orderOffset + entry.order,
    failurePropagation: entry.failurePropagation,
    policyKind: entry.policy.kind,
    source: entry.source,
  }));
}

export function compileRequestPipelineGraph(
  nodes: readonly RequestPipelineNode[],
  options: CompileRequestPipelineGraphOptions = {},
): RequestPipelineGraph {
  const policyNodes = options.policyPlan
    ? requestPipelineNodesFromPolicyPlan(options.policyPlan)
    : [];
  const resolvedNodes = [...nodes, ...policyNodes].map(resolveNode);

  assertUniqueNodeIds(resolvedNodes);
  assertHandlerCount(resolvedNodes, options.requireHandler ?? true);
  assertDependenciesExist(resolvedNodes);
  assertDependencyOrderCompatibility(resolvedNodes);

  const orderedNodes = topologicalSort(resolvedNodes);
  const successNodes = topologicalSortPath(orderedNodes, "success");
  const errorNodes = topologicalSortPath(orderedNodes, "error");
  const successOrder = successNodes.map((node) => node.id);
  const errorOrder = errorNodes.map((node) => node.id);
  const explicitEdges = toDependencyEdges(orderedNodes);
  const successEdges = toPathEdges(successOrder, "success-order");
  const errorEdges = toPathEdges(errorOrder, "error-order");
  const phaseOrder = toPhaseOrder(orderedNodes);
  const edges = [...explicitEdges, ...successEdges, ...errorEdges];
  const graph = {
    target: options.target,
    nodes: orderedNodes,
    edges,
    successOrder,
    errorOrder,
    executionOrder: successOrder,
    phaseOrder,
    debugDump: "",
  };

  return {
    ...graph,
    debugDump: dumpRequestPipelineGraph(graph),
  };
}

export function dumpRequestPipelineGraph(graph: Omit<RequestPipelineGraph, "debugDump">): string {
  const lines: string[] = [`request-pipeline${graph.target ? ` ${graph.target}` : ""}`];

  for (const phase of REQUEST_PIPELINE_PHASES) {
    lines.push(`${phase}:`);
    const phaseNodes = graph.nodes.filter((node) => node.phase === phase);

    if (phaseNodes.length === 0) {
      lines.push("  <empty>");
      continue;
    }

    for (const node of phaseNodes) {
      lines.push(
        `  ${node.order.toString().padStart(3, "0")} ${node.kind} ${node.id} ` +
          `(${node.failurePropagation})`,
      );
    }
  }

  lines.push("success-order:");
  appendOrderLines(lines, graph.successOrder);
  lines.push("error-order:");
  appendOrderLines(lines, graph.errorOrder);

  lines.push("edges:");
  if (graph.edges.length === 0) {
    lines.push("  <empty>");
  } else {
    for (const edge of graph.edges) {
      lines.push(`  ${edge.from} -> ${edge.to} (${edge.reason})`);
    }
  }

  return lines.join("\n");
}

function appendOrderLines(lines: string[], order: readonly string[]): void {
  if (order.length === 0) {
    lines.push("  <empty>");
    return;
  }

  for (const nodeId of order) {
    lines.push(`  ${nodeId}`);
  }
}

function resolveNode(node: RequestPipelineNode): ResolvedRequestPipelineNode {
  assertNodeShape(node);

  return {
    id: node.id,
    kind: node.kind,
    phase: node.phase,
    label: node.label ?? node.id,
    order: node.order ?? KIND_ORDER[node.kind],
    dependsOn: node.dependsOn ?? [],
    failurePropagation: node.failurePropagation ?? DEFAULT_FAILURE_PROPAGATION[node.kind],
    policyKind: node.policyKind,
    source: node.source,
  };
}

function assertNodeShape(node: RequestPipelineNode): void {
  if (node.id.trim().length === 0) {
    throw new PipelineGraphProblem("Pipeline nodes must use non-empty ids.");
  }

  if (!isRequestPipelineNodeKind(node.kind)) {
    throw new PipelineGraphProblem(`Unsupported pipeline node kind '${String(node.kind)}'.`);
  }

  if (!isRequestPipelinePhase(node.phase)) {
    throw new PipelineGraphProblem(`Unsupported pipeline phase '${String(node.phase)}'.`);
  }

  if (node.order !== undefined && (!Number.isInteger(node.order) || node.order < 0)) {
    throw new PipelineGraphProblem(
      `Pipeline node '${node.id}' must use a non-negative integer order.`,
    );
  }

  if (
    node.failurePropagation !== undefined &&
    !isRequestPipelineFailurePropagation(node.failurePropagation)
  ) {
    throw new PipelineGraphProblem(
      `Pipeline node '${node.id}' has unsupported failure propagation '${String(
        node.failurePropagation,
      )}'.`,
    );
  }
}

function assertUniqueNodeIds(nodes: readonly ResolvedRequestPipelineNode[]): void {
  const seen = new Set<string>();

  for (const node of nodes) {
    if (seen.has(node.id)) {
      throw new PipelineGraphProblem(`Pipeline node id '${node.id}' is declared more than once.`);
    }

    seen.add(node.id);
  }
}

function assertHandlerCount(
  nodes: readonly ResolvedRequestPipelineNode[],
  requireHandler: boolean,
): void {
  if (!requireHandler) {
    return;
  }

  const handlers = nodes.filter((node) => node.kind === "handler");

  if (handlers.length !== 1) {
    throw new PipelineGraphProblem(
      `Request pipeline graph must declare exactly one handler node, found ${handlers.length}.`,
    );
  }
}

function assertDependenciesExist(nodes: readonly ResolvedRequestPipelineNode[]): void {
  const nodeIds = new Set(nodes.map((node) => node.id));

  for (const node of nodes) {
    for (const dependencyId of node.dependsOn) {
      if (!nodeIds.has(dependencyId)) {
        throw new PipelineGraphProblem(
          `Pipeline node '${node.id}' depends on missing node '${dependencyId}'.`,
        );
      }
    }
  }
}

function assertDependencyOrderCompatibility(nodes: readonly ResolvedRequestPipelineNode[]): void {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  for (const node of nodes) {
    for (const dependencyId of node.dependsOn) {
      const dependency = nodeById.get(dependencyId);
      if (!dependency) {
        continue;
      }

      if (
        PHASE_ORDER[dependency.phase] > PHASE_ORDER[node.phase] ||
        (dependency.phase === node.phase && dependency.order > node.order)
      ) {
        throw new PipelineGraphProblem(
          `Pipeline node '${node.id}' depends on '${dependencyId}', but phase/order places ` +
            `'${dependencyId}' after '${node.id}'.`,
        );
      }
    }
  }
}

function topologicalSort(
  nodes: readonly ResolvedRequestPipelineNode[],
  compareNodes: (
    left: ResolvedRequestPipelineNode,
    right: ResolvedRequestPipelineNode,
  ) => number = compareResolvedNodes,
): readonly ResolvedRequestPipelineNode[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const nodeIds = new Set(nodeById.keys());
  const incomingCounts = new Map(
    nodes.map((node) => [
      node.id,
      node.dependsOn.filter((dependencyId) => nodeIds.has(dependencyId)).length,
    ]),
  );
  const outgoing = new Map<string, string[]>();

  for (const node of nodes) {
    for (const dependencyId of node.dependsOn) {
      if (!nodeIds.has(dependencyId)) {
        continue;
      }

      const next = outgoing.get(dependencyId) ?? [];
      next.push(node.id);
      outgoing.set(dependencyId, next);
    }
  }

  const ready = nodes.filter((node) => incomingCounts.get(node.id) === 0);
  const ordered: ResolvedRequestPipelineNode[] = [];

  while (ready.length > 0) {
    ready.sort(compareNodes);
    const node = ready.shift();

    if (!node) {
      break;
    }

    ordered.push(node);

    for (const dependentId of outgoing.get(node.id) ?? []) {
      const nextCount = (incomingCounts.get(dependentId) ?? 0) - 1;
      incomingCounts.set(dependentId, nextCount);

      if (nextCount === 0) {
        const dependent = nodeById.get(dependentId);
        if (dependent) {
          ready.push(dependent);
        }
      }
    }
  }

  if (ordered.length !== nodes.length) {
    const remaining = nodes
      .filter((node) => !ordered.some((orderedNode) => orderedNode.id === node.id))
      .map((node) => node.id)
      .sort();

    throw new PipelineGraphProblem(`Pipeline graph contains a cycle: ${remaining.join(" -> ")}.`);
  }

  return ordered;
}

function topologicalSortPath(
  nodes: readonly ResolvedRequestPipelineNode[],
  path: RequestPipelinePath,
): readonly ResolvedRequestPipelineNode[] {
  return topologicalSort(
    nodes.filter((node) => isNodeInPath(node, path)),
    (left, right) => comparePathNodes(left, right, path),
  );
}

function compareResolvedNodes(
  left: ResolvedRequestPipelineNode,
  right: ResolvedRequestPipelineNode,
): number {
  return (
    PHASE_ORDER[left.phase] - PHASE_ORDER[right.phase] ||
    left.order - right.order ||
    KIND_ORDER[left.kind] - KIND_ORDER[right.kind] ||
    left.id.localeCompare(right.id)
  );
}

function comparePathNodes(
  left: ResolvedRequestPipelineNode,
  right: ResolvedRequestPipelineNode,
  path: RequestPipelinePath,
): number {
  return (
    getPathPhaseOrder(left, path) - getPathPhaseOrder(right, path) ||
    left.order - right.order ||
    KIND_ORDER[left.kind] - KIND_ORDER[right.kind] ||
    left.id.localeCompare(right.id)
  );
}

function isNodeInPath(node: ResolvedRequestPipelineNode, path: RequestPipelinePath): boolean {
  return path === "error" || node.phase !== "error";
}

function getPathPhaseOrder(node: ResolvedRequestPipelineNode, path: RequestPipelinePath): number {
  if (path === "success") {
    return PHASE_ORDER[node.phase];
  }

  if (node.phase === "before") {
    return 10;
  }

  if (node.phase === "handler") {
    return 20;
  }

  if (node.phase === "after" && node.kind === "interceptor") {
    return 30;
  }

  if (node.phase === "error") {
    return 40;
  }

  return 50;
}

function toDependencyEdges(
  nodes: readonly ResolvedRequestPipelineNode[],
): readonly RequestPipelineGraphEdge[] {
  return nodes.flatMap((node) =>
    node.dependsOn.map((dependencyId) => ({
      from: dependencyId,
      to: node.id,
      reason: "depends-on" as const,
    })),
  );
}

function toPathEdges(
  order: readonly string[],
  reason: Extract<RequestPipelineGraphEdgeReason, "success-order" | "error-order">,
): readonly RequestPipelineGraphEdge[] {
  return order.slice(0, -1).map((nodeId, index) => ({
    from: nodeId,
    to: order[index + 1],
    reason,
  }));
}

function toPhaseOrder(nodes: readonly ResolvedRequestPipelineNode[]): RequestPipelinePhaseOrder {
  return {
    before: nodes.filter((node) => node.phase === "before").map((node) => node.id),
    handler: nodes.filter((node) => node.phase === "handler").map((node) => node.id),
    after: nodes.filter((node) => node.phase === "after").map((node) => node.id),
    error: nodes.filter((node) => node.phase === "error").map((node) => node.id),
  };
}

function isRequestPipelineNodeKind(value: string): value is RequestPipelineNodeKind {
  return (REQUEST_PIPELINE_NODE_KINDS as readonly string[]).includes(value);
}

function isRequestPipelinePhase(value: string): value is RequestPipelinePhase {
  return (REQUEST_PIPELINE_PHASES as readonly string[]).includes(value);
}

function isRequestPipelineFailurePropagation(
  value: string,
): value is RequestPipelineFailurePropagation {
  return (REQUEST_PIPELINE_FAILURE_PROPAGATIONS as readonly string[]).includes(value);
}
