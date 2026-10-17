import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { AdminForm } from "../libs/components";
import { useAdminForm } from "../libs/hooks";
import type { AdminFormContract, AdminFormController } from "../libs/types";

type Values = { choice: string; note: string };

/** Synthetic browser fixture: no API, persistence, or production credentials. */
export function mountAdminFormOptions(container: HTMLElement) {
  const root = createRoot(container);
  let current: AdminFormController<Values> | undefined;
  const contract: AdminFormContract<Values> = {
    id: "widget.edit",
    title: "Edit widget",
    intent: "update",
    audit: { eventName: "widget.updated", subjectType: "tenant", subjectId: "synthetic" },
    initialValues: { choice: "", note: "Initial note" },
    fields: [
      { name: "choice", label: "Choice", inputType: "select", options: [] },
      { name: "note", label: "Note", inputType: "text" },
    ],
    submit: async () => ({ kind: "success" }),
  };
  function Editor({ formContract }: { formContract: typeof contract }) {
    const form = useAdminForm(formContract);
    current = form;
    return createElement(AdminForm<Values>, {
      state: form.state,
      onFieldChange: form.setFieldValue,
      onSubmit: form.submit,
    });
  }
  function render(formContract: typeof contract) {
    flushSync(() => root.render(createElement(Editor, { formContract })));
  }
  const loaded: typeof contract = {
    ...contract,
    fields: [
      {
        ...contract.fields[0],
        label: "Loaded choice",
        description: "Choose a loaded option",
        options: [
          { label: "Aster", value: "aster" },
          { label: "Birch", value: "birch" },
        ],
      },
      contract.fields[1],
    ],
  };
  render(contract);
  return {
    load: () => render(loaded),
    replace: () => render({ ...loaded, id: "widget.other" }),
    snapshot: () => current?.state,
    unmount: () => root.unmount(),
  };
}
