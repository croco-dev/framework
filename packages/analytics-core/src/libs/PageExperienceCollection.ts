import { Problem, ProblemCategory } from "@croco/problems-core";
import type {
  PageExperienceDefinition,
  PageExperienceRow,
  PageExperienceScope,
} from "@croco/metrics-core";
import {
  hashPageExperience,
  validatePageExperienceDefinition,
  validatePageExperienceRow,
} from "@croco/metrics-core";

export type PageExperienceBrowserObservation = {
  id: string;
  pageInstance: string;
  page: string;
  kind: "view" | "content" | "visible" | "action" | "attempt";
  occurredAt: string;
  value: string;
};
export type PageExperienceCollectionContext = {
  scope: PageExperienceScope;
  subject: string;
  session: string;
  origin: string;
  consent: boolean;
  collectionAllowed: boolean;
};
export class PageExperienceCollectionProblem extends Problem {
  readonly code = "analytics/page-experience/rejected";
  readonly category = ProblemCategory.ValidationError;
  constructor() {
    super(undefined, undefined, "Page experience collection rejected");
  }
}
/** Server transport binds identity. No browser field can claim scope, subject or committed success. */
export class PageExperienceCollection {
  private readonly definition: PageExperienceDefinition;
  constructor(
    private readonly options: {
      definition: PageExperienceDefinition;
      allowedOrigins: readonly string[];
      clock: () => Date;
      authorize(
        context: PageExperienceCollectionContext,
        action: "observe" | "receipt",
      ): Promise<boolean>;
      /** Source deduplicates scope + source + id, preserves first receivedAt and rejects other field changes.
       * It owns retention and suppression. Browser IDs are namespaced by authenticated session/subject.
       */
      append(row: PageExperienceRow, scope: PageExperienceScope): Promise<void>;
      /** Reads a domain-owned committed receipt under the current trusted scope and subject. */
      verifyReceipt(
        ref: string,
        context: PageExperienceCollectionContext,
      ): Promise<{
        id: string;
        source: string;
        occurredAt: string;
        action: string;
        pageInstance: string;
        page: string;
      } | null>;
    },
  ) {
    validatePageExperienceDefinition(options.definition);
    this.definition = structuredClone(options.definition);
  }
  private async check(context: PageExperienceCollectionContext, action: "observe" | "receipt") {
    if (
      !context ||
      !context.scope ||
      !Object.hasOwn(context.scope, "tenant") ||
      !context.scope.tenant ||
      !context.subject ||
      !context.session ||
      !(await this.options.authorize(structuredClone(context), action))
    )
      throw new PageExperienceCollectionProblem();
  }
  async observe(
    payload: unknown,
    context: PageExperienceCollectionContext,
  ): Promise<"accepted" | "disabled"> {
    const authority = structuredClone(context);
    await this.check(authority, "observe");
    if (!authority.consent || !authority.collectionAllowed) return "disabled";
    if (
      !this.options.allowedOrigins.includes(authority.origin) ||
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    )
      throw new PageExperienceCollectionProblem();
    const value = payload as Record<string, unknown>;
    const fields = ["id", "pageInstance", "page", "kind", "occurredAt", "value"];
    if (
      Object.keys(value).length !== fields.length ||
      fields.some((k) => typeof value[k] !== "string") ||
      new TextEncoder().encode(JSON.stringify(payload)).length > 2048
    )
      throw new PageExperienceCollectionProblem();
    const observation = value as PageExperienceBrowserObservation;
    if (
      !["view", "content", "visible", "action", "attempt"].includes(observation.kind) ||
      observation.page !== this.definition.page ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(observation.id) ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(observation.pageInstance)
    )
      throw new PageExperienceCollectionProblem();
    const time = Date.parse(observation.occurredAt),
      now = this.options.clock();
    if (
      !Number.isFinite(time) ||
      new Date(time).toISOString() !== observation.occurredAt ||
      time > now.getTime() ||
      time < now.getTime() - this.definition.sessionWindowMs
    )
      throw new PageExperienceCollectionProblem();
    const permitted =
      observation.kind === "view"
        ? observation.value === this.definition.page
        : observation.kind === "content"
          ? observation.value === this.definition.contentCondition
          : observation.kind === "visible"
            ? /^(0|[1-9]\d{0,7})$/.test(observation.value) &&
              Number(observation.value) <= this.definition.sessionWindowMs
            : observation.kind === "action"
              ? this.definition.engagementActions.includes(observation.value)
              : observation.value === this.definition.valueAction;
    if (!permitted) throw new PageExperienceCollectionProblem();
    await this.options.append(
      validatePageExperienceRow({
        ...observation,
        id: await hashPageExperience({
          session: authority.session,
          subject: authority.subject,
          id: observation.id,
        }),
        source: "browser",
        session: authority.session,
        subject: authority.subject,
        receivedAt: now.toISOString(),
      }),
      authority.scope,
    );
    return "accepted";
  }
  /** Invoke after domain commit (or from the existing outbox). Failure never changes that domain result. */
  async committed(
    ref: string,
    context: PageExperienceCollectionContext,
  ): Promise<"recorded" | "unavailable"> {
    const authority = structuredClone(context);
    try {
      await this.check(authority, "receipt");
      if (!authority.collectionAllowed) return "unavailable";
      const receipt = await this.options.verifyReceipt(ref, authority);
      if (
        !receipt ||
        receipt.action !== this.definition.valueAction ||
        receipt.page !== this.definition.page
      )
        throw new PageExperienceCollectionProblem();
      const row: PageExperienceRow = {
        id: receipt.id,
        source: receipt.source,
        kind: "committed",
        session: authority.session,
        subject: authority.subject,
        pageInstance: receipt.pageInstance,
        page: receipt.page,
        occurredAt: receipt.occurredAt,
        receivedAt: this.options.clock().toISOString(),
        value: receipt.action,
      };
      await this.options.append(validatePageExperienceRow(row), authority.scope);
      return "recorded";
    } catch {
      // Explicit unavailable lets the outbox/application retry without rolling back a successful purchase.
      return "unavailable";
    }
  }
}
