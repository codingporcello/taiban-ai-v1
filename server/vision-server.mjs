import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

async function loadEnvFile() {
  try {
    const content = await readFile(resolve('.env'), 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (!match || match[1].startsWith('#') || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

await loadEnvFile();

const PORT = Number(process.env.OPENAI_VISION_PORT || 8787);
let latestOcrLog = null;

function updateLatestOcrLog(fields) {
  latestOcrLog = { ...latestOcrLog, ...fields, updatedAt: new Date().toISOString() };
  console.log('[OpenAI Vision OCR]', latestOcrLog);
  return latestOcrLog;
}

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function readRequestBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_IMAGE_BYTES + 1024 * 1024) throw new Error('IMAGE_TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function getUploadedImage(request) {
  const contentType = request.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) throw new Error('INVALID_CONTENT_TYPE');
  const body = await readRequestBody(request);
  const formRequest = new Request('http://localhost/upload', {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
  });
  const formData = await formRequest.formData();
  const image = formData.get('image');
  if (!image || typeof image === 'string') throw new Error('IMAGE_REQUIRED');
  if (!ALLOWED_IMAGE_TYPES.has(image.type)) throw new Error('UNSUPPORTED_IMAGE');
  if (image.size > MAX_IMAGE_BYTES) throw new Error('IMAGE_TOO_LARGE');
  return image;
}

function extractResponseText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  return (data.output || [])
    .flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text')
    .map(item => item.text)
    .join('\n')
    .trim();
}

async function recognizePoster(image) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY_MISSING');
  const model = process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini';
  const bytes = Buffer.from(await image.arrayBuffer());
  const imageUrl = `data:${image.type};base64,${bytes.toString('base64')}`;
  updateLatestOcrLog({ openaiApiCalled: true, status: 'requesting_openai', model });
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [{
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: 'Perform OCR on this Japanese event poster. Return only the visible text, preserving line breaks when practical. Do not explain, summarize, or add Markdown.',
          },
          {
            type: 'input_image',
            image_url: imageUrl,
            detail: 'high',
          },
        ],
      }],
    }),
  });
  const data = await response.json();
  updateLatestOcrLog({
    openaiResponseReceived: true,
    openaiResponseStatus: response.status,
    openaiRequestId: response.headers.get('x-request-id') || null,
  });
  if (!response.ok) {
    const error = new Error(data.error?.message || 'OpenAI Responses API request failed');
    error.status = response.status;
    throw error;
  }
  const text = extractResponseText(data);
  if (!text) throw new Error('OPENAI_EMPTY_RESPONSE');
  updateLatestOcrLog({ status: 'success', textLength: text.length });
  return text;
}

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/api/health') {
    return json(response, 200, { ok: true, openaiConfigured: Boolean(process.env.OPENAI_API_KEY) });
  }
  if (request.method === 'GET' && request.url === '/api/ocr/logs/latest') {
    return json(response, 200, { log: latestOcrLog });
  }
  if (request.method !== 'POST' || request.url !== '/api/ocr/openai-vision') {
    return json(response, 404, { error: 'Not found' });
  }
  try {
    latestOcrLog = {
      provider: 'OpenAI Vision',
      startedAt: new Date().toISOString(),
      status: 'receiving_image',
      openaiApiCalled: false,
      openaiResponseReceived: false,
    };
    const image = await getUploadedImage(request);
    updateLatestOcrLog({ status: 'received_image', imageType: image.type, imageBytes: image.size });
    return json(response, 200, { text: await recognizePoster(image), log: latestOcrLog });
  } catch (error) {
    const status = error.status || {
      OPENAI_API_KEY_MISSING: 503,
      IMAGE_REQUIRED: 400,
      INVALID_CONTENT_TYPE: 400,
      UNSUPPORTED_IMAGE: 415,
      IMAGE_TOO_LARGE: 413,
      OPENAI_EMPTY_RESPONSE: 502,
    }[error.message] || 500;
    if (latestOcrLog?.provider === 'OpenAI Vision') updateLatestOcrLog({ status: 'error', error: error.message });
    return json(response, status, { error: error.message, log: latestOcrLog });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`OpenAI Vision OCR API listening on http://127.0.0.1:${PORT}`);
});
