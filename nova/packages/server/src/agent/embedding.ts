/**
 * Embedding 封装
 *
 * 使用与 LLM 相同的 API 服务（OPENAI_BASE_URL），调用 embeddings API。
 * 环境变量：
 *   OPENAI_API_KEY       — API Key
 *   OPENAI_BASE_URL      — 基础 URL（如 http://litellm-sg.mayfair-inc.com）
 *   EMBEDDING_MODEL      — 可选，默认 text-embedding-3-small
 */

const DEFAULT_MODEL = 'text-embedding-3-small';

function getBaseURL(): string {
  const proxy = process.env.OPENAI_BASE_URL || 'https://api.openai.com';
  return proxy.endsWith('/v1') ? proxy : `${proxy}/v1`;
}

/**
 * 将文本转为向量（number[]）
 */
export async function embed(text: string): Promise<number[]> {
  const baseURL = getBaseURL();
  const apiKey = process.env.OPENAI_API_KEY || '';
  const model = process.env.EMBEDDING_MODEL || DEFAULT_MODEL;

  const res = await fetch(`${baseURL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Embedding API error ${res.status}: ${errText}`);
  }

  const json = (await res.json()) as {
    data: Array<{ embedding: number[] }>;
  };
  return json.data[0].embedding;
}

/**
 * 批量嵌入多段文本
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const baseURL = getBaseURL();
  const apiKey = process.env.OPENAI_API_KEY || '';
  const model = process.env.EMBEDDING_MODEL || DEFAULT_MODEL;

  const res = await fetch(`${baseURL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: texts,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Embedding API error ${res.status}: ${errText}`);
  }

  const json = (await res.json()) as {
    data: Array<{ index: number; embedding: number[] }>;
  };

  // 按 index 排序确保返回顺序与输入一致
  const sorted = json.data.sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}

/**
 * 检查 embedding 服务是否可用
 */
export function isEmbeddingAvailable(): boolean {
  return !!(process.env.OPENAI_API_KEY && process.env.OPENAI_BASE_URL);
}
