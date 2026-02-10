/**
 * LLM 实例工厂
 */
import { ChatOpenAI } from '@langchain/openai';

export function createLLM(temperature = 0.7) {
  const proxy = process.env.OPENAI_BASE_URL || 'https://api.openai.com';
  const baseURL = proxy.endsWith('/v1') ? proxy : `${proxy}/v1`;

  return new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL || 'gpt-4o',
    temperature,
    streaming: true,
    openAIApiKey: process.env.OPENAI_API_KEY,
    configuration: { baseURL },
  });
}

export function createJsonLLM() {
  return createLLM(0.3);
}
