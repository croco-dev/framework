type HeaderBag = Record<string, unknown>;

export function getHeaderValue(request: Request, headerName: string): string | null {
  const requestRecord = request as unknown as { headers?: unknown };
  const headers = requestRecord.headers;

  if (headers instanceof Headers) {
    return headers.get(headerName);
  }

  if (typeof headers !== 'object' || headers === null) {
    return null;
  }

  const headerBag = headers as HeaderBag;
  const direct = headerBag[headerName];

  if (typeof direct === 'string') {
    return direct;
  }

  const normalizedHeaderName = headerName.toLowerCase();

  for (const [key, value] of Object.entries(headerBag)) {
    if (key.toLowerCase() === normalizedHeaderName && typeof value === 'string') {
      return value;
    }
  }

  return null;
}
