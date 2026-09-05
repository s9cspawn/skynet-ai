import 'dotenv/config';

const integer = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const llamaBaseUrl = new URL(process.env['LLAMA_BASE_URL'] ?? 'http://127.0.0.1:8080');

export const config = Object.freeze({
  host: process.env['API_HOST'] ?? '127.0.0.1',
  port: integer(process.env['API_PORT'], 3000),
  llamaBaseUrl: llamaBaseUrl.toString().replace(/\/$/, ''),
  llamaModel: process.env['LLAMA_MODEL'] ?? 'gemma-4',
  modelDisplayName: process.env['MODEL_DISPLAY_NAME'] ?? 'Skynet-12B',
  llamaTimeoutMs: integer(process.env['LLAMA_TIMEOUT_MS'], 600_000),
  maxRequestBytes: integer(process.env['MAX_REQUEST_BYTES'], 262_144),
  isLocalInference: ['127.0.0.1', 'localhost', '::1'].includes(llamaBaseUrl.hostname),
});
