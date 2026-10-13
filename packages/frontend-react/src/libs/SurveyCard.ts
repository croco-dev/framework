import { createElement as h, useEffect, useId, useRef, useState } from "react";
import { validateSurveyAnswers } from "@croco/research-core";
import type { ReactElement, ChangeEvent } from "react";
import type { SurveyAnswers, SurveyDefinition } from "@croco/research-core";

export type SurveyCardProps = Readonly<{
  definition: SurveyDefinition;
  identity: string;
  onSubmit(answers: SurveyAnswers): Promise<void>;
  onDismiss(): Promise<void>;
  preview?: boolean;
}>;
/** Optional follow-up. The original product action must already be complete before mounting. */
export function SurveyCard(props: SurveyCardProps): ReactElement {
  // Keyed inner state prevents answers or late completions crossing invitations/versions.
  return h(SurveyForm, {
    ...props,
    key: JSON.stringify([props.identity, props.definition.id, props.definition.version]),
  });
}
function SurveyForm(props: SurveyCardProps): ReactElement {
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [done, setDone] = useState(false);
  const active = useRef(true);
  const busy = useRef(false);
  const id = useId();
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const update = (key: string, value: string | number | readonly string[]) =>
    setAnswers((a) => ({ ...a, [key]: value }));
  async function act(submit: boolean) {
    if (busy.current || done) return;
    try {
      if (submit) validateSurveyAnswers(props.definition, answers);
      busy.current = true;
      setPending(true);
      setStatus("");
      if (submit) await props.onSubmit(answers);
      else await props.onDismiss();
      if (active.current) {
        setDone(true);
        setStatus(
          props.preview
            ? "Preview complete — no response stored."
            : submit
              ? "Thank you for your response."
              : "Survey skipped. Your product action is complete.",
        );
      }
    } catch (error) {
      if (active.current)
        setStatus(
          error instanceof Error
            ? error.message
            : "Survey unavailable. Your product action is complete.",
        );
    } finally {
      busy.current = false;
      if (active.current) setPending(false);
    }
  }
  return h(
    "section",
    {
      "aria-label": props.definition.title,
      style: { maxWidth: "40rem", overflowWrap: "anywhere" },
    },
    h("h2", null, props.definition.title),
    h(
      "p",
      null,
      props.preview
        ? "Preview. Responses will not be collected."
        : "Optional survey. Your product action is already complete.",
    ),
    !done &&
      h(
        "form",
        {
          onSubmit: (e: { preventDefault(): void }) => {
            e.preventDefault();
            void act(true);
          },
        },
        props.definition.questions.map((q) =>
          h(
            "fieldset",
            { key: q.id, disabled: pending, style: { minWidth: 0, marginBottom: "1rem" } },
            h("legend", null, `${q.title}${q.required ? " (required to submit)" : " (optional)"}`),
            q.kind === "single" || q.kind === "multi"
              ? q.options.map((o) =>
                  h(
                    "label",
                    { key: o.id, style: { display: "block", padding: ".3rem" } },
                    h("input", {
                      type: q.kind === "single" ? "radio" : "checkbox",
                      name: `${id}-${q.id}`,
                      value: o.id,
                      checked:
                        q.kind === "single"
                          ? answers[q.id] === o.id
                          : Array.isArray(answers[q.id]) &&
                            (answers[q.id] as readonly string[]).includes(o.id),
                      onChange: (e: ChangeEvent<HTMLInputElement>) => {
                        if (q.kind === "single") update(q.id, o.id);
                        else {
                          const old = Array.isArray(answers[q.id])
                            ? (answers[q.id] as readonly string[])
                            : [];
                          update(
                            q.id,
                            e.target.checked ? [...old, o.id] : old.filter((v) => v !== o.id),
                          );
                        }
                      },
                    }),
                    o.label,
                  ),
                )
              : q.kind === "scale"
                ? h(
                    "select",
                    {
                      "aria-label": q.title,
                      value: answers[q.id] ?? "",
                      onChange: (e: ChangeEvent<HTMLSelectElement>) => {
                        const v = e.target.value;
                        if (v === "")
                          setAnswers((a) => {
                            const next = { ...a };
                            delete next[q.id];
                            return next;
                          });
                        else update(q.id, Number(v));
                      },
                    },
                    h("option", { value: "" }, "Choose a score"),
                    Array.from({ length: q.max - q.min + 1 }, (_, index) =>
                      h("option", { key: index, value: q.min + index }, String(q.min + index)),
                    ),
                  )
                : h("textarea", {
                    "aria-label": q.title,
                    maxLength: q.maxLength,
                    value: answers[q.id] ?? "",
                    style: { boxSizing: "border-box", width: "100%" },
                    onChange: (e: ChangeEvent<HTMLTextAreaElement>) => update(q.id, e.target.value),
                  }),
          ),
        ),
        h("button", { type: "submit", disabled: pending }, pending ? "Saving…" : "Submit response"),
        h(
          "button",
          {
            type: "button",
            disabled: pending,
            onClick: () => void act(false),
            style: { marginLeft: ".5rem" },
          },
          "Skip survey",
        ),
      ),
    h("p", { role: "status", "aria-live": "polite" }, status),
  );
}
export type SurveyModalProps = SurveyCardProps & { onClose(): void; returnFocusTo?: HTMLElement };
export function SurveyModal(props: SurveyModalProps): ReactElement {
  return h(SurveyDialog, {
    ...props,
    key: JSON.stringify([props.identity, props.definition.id, props.definition.version]),
  });
}
function SurveyDialog(props: SurveyModalProps): ReactElement {
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const dialog = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    mounted.current = true;
    returnFocus.current =
      props.returnFocusTo ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const element = dialog.current;
    element?.showModal();
    return () => {
      mounted.current = false;
      element?.close();
      returnFocus.current?.focus();
    };
  }, []);
  const close = () => {
    if (!mounted.current || !dialog.current?.isConnected) return;
    dialog.current?.close();
    props.onClose();
    returnFocus.current?.focus();
  };
  const dismiss = async () => {
    try {
      await props.onDismiss();
      close();
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Survey dismissal unavailable.");
    }
  };
  return h(
    "dialog",
    {
      ref: dialog,
      "aria-label": props.definition.title,
      style: { maxWidth: "min(90vw,40rem)", boxSizing: "border-box" },
      onCancel: (e: { preventDefault(): void }) => {
        e.preventDefault();
        void dismiss();
      },
    },
    h("button", { type: "button", onClick: close }, "Return to product"),
    h(SurveyCard, {
      ...props,
      onDismiss: async () => {
        await props.onDismiss();
        close();
      },
      onSubmit: async (answers) => {
        await props.onSubmit(answers);
        close();
      },
    }),
    h("p", { role: "alert" }, error),
  );
}
