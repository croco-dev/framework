import { ProblemFactory } from "@croco/problems-core";
import { triggerRegistry } from "@croco/triggers-core";
import type { GeneratedDiGraph } from "@croco/framework-context";

export type CloudflareCronBinding = {
  readonly id: string;
  readonly providerTokenId: string;
  readonly methodName: string;
  readonly cron: string;
};

export type CloudflareCronManifest = {
  readonly schemaVersion: "croco.cloudflare-crons.v1";
  readonly graphInputHash: string;
  readonly crons: readonly string[];
  readonly bindings: readonly CloudflareCronBinding[];
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const FIELDS = [
  { min: 0, max: 59, names: [] },
  { min: 0, max: 23, names: [] },
  { min: 1, max: 31, names: [] },
  { min: 1, max: 12, names: MONTHS },
  { min: 1, max: 7, names: WEEKDAYS },
] as const;

function unsupported(detail: string): never {
  throw ProblemFactory.badRequest("CLOUDFLARE_CRON_UNSUPPORTED", detail);
}

/**
 * Normalizes the supported Cloudflare five-field UTC cron subset: wildcards,
 * values, lists, ascending ranges, and positive steps up to the field's size.
 * Month/day names are three-letter abbreviations. Native weekdays are 1=SUN
 * through 7=SAT; numeric weekdays are never translated from another cron dialect.
 * Quartz extensions L, W, # and ? are outside this supported subset.
 */
export function normalizeCloudflareCron(expression: string, timezone?: string): string {
  if (timezone !== undefined && timezone !== "UTC") {
    unsupported(`Cloudflare Cron Triggers require UTC; received timezone '${timezone}'.`);
  }

  const fields = expression.trim().toUpperCase().split(/\s+/);
  if (fields.length !== FIELDS.length) {
    unsupported("Cloudflare cron expressions require exactly five fields.");
  }

  for (const [index, field] of FIELDS.entries()) {
    const text = fields[index];
    if (!text) unsupported("Cloudflare cron fields cannot be empty.");

    const valueOf = (value: string): number => {
      const named = (field.names as readonly string[]).indexOf(value);
      const numeric = named >= 0 ? named + 1 : /^\d+$/.test(value) ? Number(value) : Number.NaN;
      if (!Number.isSafeInteger(numeric) || numeric < field.min || numeric > field.max) {
        unsupported(`Invalid Cloudflare cron value '${value}' in field ${index + 1}.`);
      }
      return numeric;
    };

    for (const item of text.split(",")) {
      const segments = item.split("/");
      const [range, step] = segments;
      if (!range || segments.length > 2) unsupported(`Invalid Cloudflare cron item '${item}'.`);
      if (step !== undefined) {
        const numericStep = Number(step);
        if (
          !/^\d+$/.test(step) ||
          !Number.isSafeInteger(numericStep) ||
          numericStep < 1 ||
          numericStep > field.max - field.min + 1
        ) {
          unsupported(`Invalid Cloudflare cron step '${step}' in field ${index + 1}.`);
        }
      }

      if (range === "*") continue;
      const endpoints = range.split("-");
      const [start, end] = endpoints;
      if (!start || endpoints.length > 2) unsupported(`Invalid Cloudflare cron range '${range}'.`);
      const first = valueOf(start);
      if (end !== undefined && first > valueOf(end)) {
        unsupported(`Cloudflare cron ranges must ascend: '${range}'.`);
      }
    }
  }

  return fields.join(" ");
}

/** Compiles only the class providers selected by this application's generated graph. */
export function compileCloudflareCrons(graph: GeneratedDiGraph): CloudflareCronManifest {
  const bindings: CloudflareCronBinding[] = [];
  const ids = new Set<string>();

  for (const provider of graph.providers) {
    if (typeof provider.token !== "function") continue;
    const target: unknown = provider.token.prototype;
    if (target === null || typeof target !== "object") {
      unsupported(`Cloudflare cron provider '${provider.tokenId}' requires a class prototype.`);
    }

    for (const metadata of triggerRegistry.getTriggers(provider.token).values()) {
      if (metadata.type === "cron" && metadata.options?.enabled !== false) {
        unsupported(
          `Cloudflare cron provider '${provider.tokenId}' requires instance methods; static Cron targets are unsupported.`,
        );
      }
    }

    for (const metadata of triggerRegistry.getTriggers(target).values()) {
      if (metadata.type !== "cron" || metadata.options?.enabled === false) continue;
      const methodName = metadata.methodName;
      if (
        typeof methodName !== "string" ||
        typeof Object.getOwnPropertyDescriptor(target, methodName)?.value !== "function"
      ) {
        unsupported(
          `Cloudflare cron provider '${provider.tokenId}' requires a named instance method.`,
        );
      }

      const id = metadata.options?.name ?? `${provider.tokenId}#${methodName}`;
      if (!id.trim()) unsupported("Cloudflare cron binding ids cannot be blank.");
      if (ids.has(id)) unsupported(`Duplicate Cloudflare cron binding id '${id}'.`);
      ids.add(id);
      bindings.push(
        Object.freeze({
          id,
          providerTokenId: provider.tokenId,
          methodName,
          cron: normalizeCloudflareCron(metadata.expression, metadata.options?.timezone),
        }),
      );
    }
  }

  bindings.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  return Object.freeze({
    schemaVersion: "croco.cloudflare-crons.v1",
    graphInputHash: graph.inputHash,
    crons: Object.freeze([...new Set(bindings.map(({ cron }) => cron))].sort()),
    bindings: Object.freeze(bindings),
  });
}
