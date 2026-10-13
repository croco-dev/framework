import { createElement as h, useRef, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";
import type { ResearchAction, ResearchConsoleState } from "@croco/admin-core";
import type { ResearchCommand, ResearchPage } from "@croco/research-core";
export type ResearchRecruitmentConsoleProps = Readonly<{
  state: ResearchConsoleState;
  canWrite: boolean;
  canConfirmParticipation: boolean;
  canWriteNotes: boolean;
  onAction(action: ResearchAction, command: Omit<ResearchCommand, "source">): Promise<ResearchPage>;
  onPage(offset: number): Promise<ResearchPage>;
  onReload(): void;
}>;
export function ResearchRecruitmentConsole(props: ResearchRecruitmentConsoleProps): ReactElement {
  if (props.state.kind !== "ready")
    return h(
      "section",
      { "aria-label": "Research recruitment", "aria-busy": props.state.kind === "loading" },
      h("h2", null, "Research recruitment"),
      h(
        "p",
        { role: props.state.kind === "loading" ? "status" : "alert" },
        props.state.kind === "loading" ? "Loading research recruitment…" : props.state.message,
      ),
      props.state.kind === "error"
        ? h("button", { type: "button", onClick: props.onReload }, "Reload")
        : null,
    );
  return h(ResearchReady, {
    key: JSON.stringify([
      props.state.page.scope,
      props.state.page.study.id,
      props.state.page.revision,
    ]),
    props,
    initial: props.state.page,
  });
}
function ResearchReady({
  props,
  initial,
}: {
  props: ResearchRecruitmentConsoleProps;
  initial: ResearchPage;
}): ReactElement {
  const [page, setPage] = useState(initial);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const busy = useRef(false);
  const attempt = useRef<{ fingerprint: string; key: string } | undefined>(undefined);
  const run = async (action: ResearchAction): Promise<void> => {
    if (busy.current || !reason.trim()) return;
    busy.current = true;
    setPending(true);
    setFeedback("");
    const fingerprint = JSON.stringify([action, reason, page.revision]);
    const request =
      attempt.current?.fingerprint === fingerprint
        ? attempt.current
        : { fingerprint, key: crypto.randomUUID() };
    attempt.current = request;
    try {
      setPage(
        await props.onAction(action, {
          reason,
          expectedRevision: page.revision,
          idempotencyKey: request.key,
        }),
      );
      attempt.current = undefined;
      if (action.kind === "note") setNotes((drafts) => ({ ...drafts, [action.subject]: "" }));
      setFeedback("Operation saved");
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Operation failed. Reload current state.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const changePage = async (offset: number): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setFeedback("");
    try {
      setPage(await props.onPage(offset));
    } catch {
      setFeedback("Page unavailable. Reload current state.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const button = (label: string, action: ResearchAction, allowed: boolean): ReactElement =>
    h(
      "button",
      {
        type: "button",
        disabled: pending || !props.canWrite || !allowed || !reason.trim(),
        onClick: () => void run(action),
      },
      label,
    );
  return h(
    "section",
    {
      "aria-label": "Research recruitment",
      "aria-busy": pending,
      style: { maxWidth: "64rem", overflowWrap: "anywhere", padding: "1rem" },
    },
    h("h2", null, "Research recruitment"),
    h(
      "p",
      null,
      `${page.scope.app} / ${page.scope.environment} / ${page.scope.tenantId} · ${page.study.id} · revision ${page.revision}`,
    ),
    h(
      "p",
      null,
      "Quota counts active invitation slots. Accepted and participated are separate. Recruitment totals do not establish representativeness or insights.",
    ),
    h(
      "p",
      null,
      `Snapshot ${page.study.sourceSnapshotId} · seed ${page.study.seed} · observation end ${page.study.observationEndsAt}`,
    ),
    h(
      "a",
      { href: page.study.bookingUrl, rel: "noreferrer", target: "_blank" },
      "Approved booking link",
    ),
    ...page.groups.map((group) =>
      h(
        "section",
        { key: group.group, "aria-label": `Group ${group.group}` },
        h("h3", null, group.group),
        h(
          "p",
          null,
          `Population ${group.population} · Eligible ${group.eligible} · Selected ${group.selected} · Invited ${group.invited} · Accepted ${group.accepted} · Participated ${group.participated} · Unknown ${group.unknown} · Held ${group.held} · Shortage ${group.shortage}`,
        ),
      ),
    ),
    h(
      "label",
      null,
      "Audit reason",
      h("input", {
        value: reason,
        disabled: pending,
        required: true,
        onChange: (event: ChangeEvent<HTMLInputElement>) => setReason(event.target.value),
      }),
    ),
    button("Select replacement candidates", { kind: "select" }, props.canWrite),
    page.candidates.length === 0 ? h("p", null, "No candidates imported") : null,
    ...page.candidates.map(({ candidate, invitation, exclusion, note: savedNote }) =>
      h(
        "section",
        { key: candidate.subject, "aria-label": `Candidate ${candidate.subject}` },
        h("h3", null, candidate.subject),
        h(
          "p",
          null,
          `${candidate.group} · ${invitation?.state ?? "unselected"} · ${exclusion ?? "eligible"}`,
        ),
        h(
          "p",
          null,
          `Contact consent ${candidate.contactConsent ? "yes" : "no"} · Participation consent ${invitation?.participationConsent ? "yes" : "no"} · Contacts ${invitation?.contactCount ?? 0} · Last contact ${invitation?.lastContactAt ?? candidate.priorContactAt ?? "none"}`,
        ),
        invitation?.failureCode
          ? h(
              "p",
              { role: "status" },
              `Dispatch ${invitation.failureCode}; unknown acceptance holds its slot`,
            )
          : null,
        savedNote ? h("p", null, `Private note: ${savedNote}`) : null,
        button(
          "Invite",
          { kind: "invite", subject: candidate.subject },
          props.canWrite && invitation?.state === "selected" && !exclusion,
        ),
        button(
          "Record participation consent",
          {
            kind: "consent",
            subject: candidate.subject,
            contact: candidate.contactConsent,
            participation: true,
          },
          props.canWrite && invitation !== undefined,
        ),
        button(
          "Withdraw consent",
          { kind: "consent", subject: candidate.subject, contact: false, participation: false },
          props.canWrite,
        ),
        button(
          "Accept",
          { kind: "response", subject: candidate.subject, response: "accepted" },
          props.canWrite && invitation?.state === "invited" && invitation.participationConsent,
        ),
        button(
          "Decline",
          { kind: "response", subject: candidate.subject, response: "declined" },
          props.canWrite && ["selected", "invited", "accepted"].includes(invitation?.state ?? ""),
        ),
        button(
          "Confirm actual participation",
          { kind: "participated", subject: candidate.subject },
          props.canConfirmParticipation && invitation?.state === "accepted",
        ),
        invitation && ["unknown", "admitted"].includes(invitation.state)
          ? h(
              "div",
              null,
              h(
                "p",
                null,
                "Reconcile only with verified provider evidence; include its reference in the audit reason.",
              ),
              button(
                "Confirm provider acceptance",
                { kind: "reconcile", subject: candidate.subject, outcome: "invited" },
                props.canConfirmParticipation,
              ),
              button(
                "Confirm provider rejection",
                { kind: "reconcile", subject: candidate.subject, outcome: "suppressed" },
                props.canConfirmParticipation,
              ),
            )
          : null,
        props.canWriteNotes
          ? h(
              "div",
              null,
              h(
                "label",
                null,
                `Note for ${candidate.subject}`,
                h("textarea", {
                  value: notes[candidate.subject] ?? "",
                  maxLength: 2000,
                  disabled: pending || !props.canWrite,
                  onChange: (event: ChangeEvent<HTMLTextAreaElement>) =>
                    setNotes({ ...notes, [candidate.subject]: event.target.value }),
                }),
              ),
              button(
                "Save private note",
                { kind: "note", subject: candidate.subject, text: notes[candidate.subject] ?? "" },
                true,
              ),
              button(
                "Delete private note",
                { kind: "note", subject: candidate.subject, text: null },
                true,
              ),
            )
          : null,
      ),
    ),
    h("h3", null, "Contact and status history"),
    h(
      "ul",
      null,
      ...page.history.map((event) =>
        h(
          "li",
          { key: `${event.revision}/${event.idempotencyKey}` },
          `${event.at} · ${event.operation} · ${event.subject ?? "study"} · ${event.actor} · ${event.reason} · ${event.source}${event.transitions?.length ? " · " + event.transitions.map((value) => value.subject + ":" + value.state).join(", ") : ""}${event.contactConsent === undefined ? "" : " · contact=" + event.contactConsent + " participation=" + event.participationConsent}`,
        ),
      ),
    ),
    page.nextOffset === undefined
      ? null
      : h(
          "button",
          {
            type: "button",
            disabled: pending,
            onClick: () => void changePage(page.nextOffset ?? 0),
          },
          "Next page",
        ),
    h("button", { type: "button", disabled: pending, onClick: props.onReload }, "Reload"),
    pending ? h("p", { role: "status" }, "Saving operation…") : null,
    feedback ? h("p", { role: "status" }, feedback) : null,
  );
}
