export interface LogFields {
  requestId: string;
  endpoint: string;
  status: number;
  durationMs: number;
  messages?: number;
  error?: string;
}

export const logRequest = (fields: LogFields): void => {
  const safeError = fields.error?.replace(/[\r\n\t]/g, ' ').slice(0, 240);
  const details = [
    new Date().toISOString(),
    `requestId=${fields.requestId}`,
    `endpoint=${fields.endpoint}`,
    ...(fields.messages === undefined ? [] : [`messages=${fields.messages}`]),
    `durationMs=${fields.durationMs}`,
    `status=${fields.status}`,
    ...(safeError ? [`error=${JSON.stringify(safeError)}`] : []),
  ];
  console.info(details.join(' '));
};
