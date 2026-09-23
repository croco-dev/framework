export function setVaryHeader(headers: Headers, value: string): void {
  if (!value) {
    return;
  }

  const currentValue = headers.get("Vary");

  if (value === "*") {
    headers.set("Vary", "*");
    return;
  }

  if (!currentValue) {
    headers.set("Vary", value);
    return;
  }

  const existingValues = currentValue.split(",").map((entry) => entry.trim().toLowerCase());
  if (existingValues.includes("*") || existingValues.includes(value.toLowerCase())) {
    return;
  }

  headers.set("Vary", `${currentValue}, ${value}`);
}

export function mergeVaryHeader(headers: Headers, values: string): void {
  for (const value of values.split(",")) {
    setVaryHeader(headers, value.trim());
  }
}
