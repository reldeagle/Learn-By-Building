import { AsyncLocalStorage } from "node:async_hooks";

type LogValue = boolean | number | string | null;

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
  console.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      ...fields,
      ...requestLogContext.getStore(),
    }),
  );
}
