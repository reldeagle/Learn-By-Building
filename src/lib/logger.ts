import { AsyncLocalStorage } from "node:async_hooks";

type LogValue = boolean | number | string | null;

const restrictedFieldNames = new Set([
  "api_key",
  "apikey",
  "authorization",
  "code",
  "content",
  "file",
  "files",
  "password",
  "secret",
  "submission",
]);

type RequestLogContext = {
  requestId: string;
  requestOperation: string;
};

const requestLogContext = new AsyncLocalStorage<RequestLogContext>();

export function createRequestLogContext(operation: string): RequestLogContext {
  return { requestId: crypto.randomUUID(), requestOperation: operation };
}

export function withRequestLogContext<T>(
  context: RequestLogContext,
  callback: () => T,
): T {
  return requestLogContext.run(context, callback);
}

export function logEvent(event: string, fields: Record<string, LogValue>) {
  const safeFields = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      restrictedFieldNames.has(key.toLowerCase()) ? "[redacted]" : value,
    ]),
  );

  console.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      ...safeFields,
      ...requestLogContext.getStore(),
    }),
  );
}
