const diagnosticsChannel = require("node:diagnostics_channel");

const AUDIT_ENDPOINT_SUFFIX = "/-/npm/v1/security/advisories/bulk";

diagnosticsChannel.channel("undici:request:headers").subscribe(({ request, response }) => {
  if (!request.path.endsWith(AUDIT_ENDPOINT_SUFFIX)) {
    return;
  }

  const hasContentEncoding = response.headers.some(
    (value, index) => index % 2 === 0 && value.toString().toLowerCase() === "content-encoding",
  );
  if (!hasContentEncoding) {
    response.headers.push(Buffer.from("Content-Encoding"), Buffer.from("gzip"));
  }
});
