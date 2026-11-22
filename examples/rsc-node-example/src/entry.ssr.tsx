import { renderToReadableStream } from "react-dom/server";
import { createFromReadableStream, getClientEntryUrl } from "@vitejs/plugin-rsc/ssr";
import { defineRscSsrEntry } from "@croco/meta-vite/rsc/ssr";

export default defineRscSsrEntry({
  createFromReadableStream,
  getClientEntryUrl,
  renderToReadableStream,
});
