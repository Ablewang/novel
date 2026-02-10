/**
 * LLM 实例工厂
 */
import { ChatOpenAI } from '@langchain/openai';

export function createLLM(temperature = 0.7) {
  return new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL || 'gpt-4o',
    temperature,
    openAIApiKey: process.env.OPENAI_API_KEY,
    configuration: {
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    },
  });
}

export function createJsonLLM() {
  return createLLM(0.3);
}
