type LogValue = boolean | number | string | null;

export function logEvent(event: string, fields: Record<string, LogValue>) {
  console.info(JSON.stringify({ event, ...fields }));
}
