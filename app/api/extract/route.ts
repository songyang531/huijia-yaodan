import { z } from 'zod';
import { MOCK_MEDICATIONS } from '@/lib/mock-data';
import { MEDICATION_SYSTEM_PROMPT, EXTRACTION_PROTOCOL } from '@/lib/ai/prompt';
import { EXTRACTION_JSON_SCHEMA } from '@/lib/ai/schema';
import { normalizeExtraction } from '@/lib/ai/normalize';

export const runtime = 'nodejs';
const MAX_BODY = 16 * 1024 * 1024;
const imageSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (value) =>
        !Number.isNaN(Date.parse(value)) &&
        new Date(value).toISOString().slice(0, 10) === value,
      '无效日期',
    ),
  source: z.enum(['FAMILY_UPLOAD', 'DOCTOR_NOTE']),
  kind: z.enum(['DISCHARGE', 'MEDICINE']),
  isDemo: z.literal(false),
  url: z
    .string()
    .max(4.1 * 1024 * 1024)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/),
});
const requestSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('demo') }).strict(),
  z
    .object({
      mode: z.literal('live'),
      consent: z.literal(true),
      familyNote: z.string().max(1200),
      materials: z.array(imageSchema).min(1).max(6),
    })
    .strict(),
]);
const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
const reply = (data: unknown, status = 200) =>
  Response.json(data, { status, headers });

async function readBoundedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('EMPTY_BODY');
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY) {
        await reader.cancel();
        throw new Error('TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(result));
}

function validImage(url: string): boolean {
  const [header, encoded] = url.split(',');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length > 3 * 1024 * 1024 || bytes.length < 12) return false;
  if (header.includes('image/png'))
    return bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (header.includes('image/jpeg'))
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  return (
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  );
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return reply({ error: '请求来源不匹配。' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json'))
    return reply({ error: '请发送 JSON 请求。' }, 415);
  let raw: unknown;
  try {
    raw = await readBoundedBody(request);
  } catch (error) {
    return reply(
      {
        error:
          error instanceof Error && error.message === 'TOO_LARGE'
            ? '图片总量过大，请减少图片数量。'
            : '请求不是有效 JSON。',
      },
      error instanceof Error && error.message === 'TOO_LARGE' ? 413 : 400,
    );
  }
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success)
    return reply(
      { error: '材料格式无效，请检查日期、来源、图片和 AI 处理同意选项。' },
      400,
    );
  const input = parsed.data;
  // Deterministic demo is explicit; uploaded images are NEVER silently replaced by mock OCR.
  if (input.mode === 'demo')
    return reply({
      mode: 'demo',
      medications: structuredClone(MOCK_MEDICATIONS),
      notice: '固定虚构案例，不进行真实图片识别。',
    });
  if (
    new Set(input.materials.map((m) => m.id)).size !== input.materials.length ||
    input.materials.some((m) => !validImage(m.url))
  )
    return reply(
      { error: '图片内容或材料编号无效，请重新添加 JPG、PNG 或 WebP 图片。' },
      400,
    );
  if (
    process.env.ENABLE_LIVE_AI !== 'true' ||
    !process.env.OPENAI_API_KEY ||
    !process.env.OPENAI_MODEL
  )
    return reply(
      {
        error:
          '真实 AI 识别尚未启用。请配置服务端 ENABLE_LIVE_AI、OPENAI_API_KEY 和 OPENAI_MODEL；也可以重新开始演示使用虚构材料。',
      },
      503,
    );
  try {
    const content: unknown[] = [
      {
        type: 'input_text',
        text: JSON.stringify({
          familyNote: input.familyNote,
          materials: input.materials.map(({ url: _url, ...meta }) => meta),
        }),
      },
    ];
    for (const material of input.materials) {
      content.push(
        {
          type: 'input_text',
          text: `材料 ID：${material.id}；来源：${material.source}；日期：${material.date}`,
        },
        { type: 'input_image', image_url: material.url, detail: 'high' },
      );
    }
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL,
        store: false,
        instructions: MEDICATION_SYSTEM_PROMPT + '\n' + EXTRACTION_PROTOCOL,
        input: [{ role: 'user', content }],
        text: {
          format: {
            type: 'json_schema',
            name: 'medication_extraction',
            strict: true,
            schema: EXTRACTION_JSON_SCHEMA,
          },
        },
        max_output_tokens: 7000,
      }),
    });
    if (!response.ok)
      return reply(
        {
          error:
            response.status === 429
              ? 'AI 服务繁忙，请稍后重试。'
              : 'AI 服务暂不可用，请检查服务端配置或稍后重试。',
        },
        response.status === 429 ? 429 : 502,
      );
    const data = (await response.json()) as {
      status?: string;
      output?: { type: string; content?: { type: string; text?: string }[] }[];
    };
    if (data.status !== 'completed')
      return reply(
        { error: 'AI 未完成整理，草稿未更新，请重试或交由人工整理。' },
        502,
      );
    const messages =
      data.output
        ?.filter((item) => item.type === 'message')
        .flatMap((item) => item.content ?? []) ?? [];
    if (messages.some((item) => item.type === 'refusal'))
      return reply({ error: 'AI 无法整理这组材料，请交由药师人工核对。' }, 422);
    const text = messages
      .filter((item) => item.type === 'output_text')
      .map((item) => item.text ?? '')
      .join('');
    const medications = normalizeExtraction(JSON.parse(text), input.materials);
    return reply({
      mode: 'live',
      medications,
      notice: '仅为整理草稿，必须经过药师核对。',
    });
  } catch (error) {
    // Do not log raw model output, personal materials, or API credentials.
    return reply(
      {
        error:
          error instanceof Error &&
          (error.name === 'TimeoutError' || error.name === 'AbortError')
            ? 'AI 整理超时，请重试。'
            : 'AI 返回的结构未通过校验，未替换现有草稿。请重试或交由人工整理。',
      },
      502,
    );
  }
}
