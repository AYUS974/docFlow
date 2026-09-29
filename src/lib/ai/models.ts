import { google } from '@ai-sdk/google'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModelV4 } from '@ai-sdk/provider'

/**
 * DocFlow AI model chain with automatic failover.
 *
 * Order: Gemini (free tier, primary) → Z.AI GLM-4.7 (flagship) →
 * GLM-4.7-Flash (free). When a model's request fails (quota exceeded, bad
 * key, provider outage…) the next one in the chain is tried transparently —
 * the chat keeps working instead of surfacing a rate-limit error.
 *
 * Env:
 *  - GOOGLE_GENERATIVE_AI_API_KEY  enables Gemini  (model: DOCFLOW_AI_MODEL, default gemini-2.5-flash)
 *  - ZAI_API_KEY                   enables Z.AI    (models: DOCFLOW_ZAI_MODELS, default glm-4.7,glm-4.7-flash)
 */

const GEMINI_MODELS = (process.env.DOCFLOW_AI_MODEL || 'gemini-3.6-flash')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const ZAI_MODELS = (process.env.DOCFLOW_ZAI_MODELS || 'glm-4.7-flash')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

export function buildModelChain(): LanguageModelV4[] {
  const chain: LanguageModelV4[] = []
  
  if (process.env.GROQ_API_KEY) {
    const groq = createOpenAICompatible({
      name: 'groq',
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY,
    })
    const groqModel = process.env.DOCFLOW_GROQ_MODEL || 'llama-3.3-70b-versatile'
    chain.push(groq.chatModel(groqModel))
  }

  if (process.env.OPENAI_API_KEY) {
    const openai = createOpenAICompatible({
      name: 'openai',
      baseURL: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY,
    })
    const openaiModel = process.env.DOCFLOW_OPENAI_MODEL || 'gpt-4o-mini'
    chain.push(openai.chatModel(openaiModel))
  }

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    for (const id of GEMINI_MODELS) {
      chain.push(google(id))
    }
  }
  if (process.env.ZAI_API_KEY) {
    // Z.AI (Zhipu) exposes an OpenAI-compatible Chat Completions API.
    const zai = createOpenAICompatible({
      name: 'zai',
      baseURL: 'https://api.z.ai/api/paas/v4',
      apiKey: process.env.ZAI_API_KEY,
    })
    for (const id of ZAI_MODELS) chain.push(zai.chatModel(id))
  }
  return chain
}

/** Wrap a model chain into one model that fails over on request errors. */
export function withFallbacks(models: LanguageModelV4[]): LanguageModelV4 {
  if (models.length === 0) throw new Error('withFallbacks needs at least one model')
  if (models.length === 1) return models[0]

  async function tryEach<T>(run: (m: LanguageModelV4) => PromiseLike<T>): Promise<T> {
    let lastError: unknown
    for (const model of models) {
      try {
        return await run(model)
      } catch (err) {
        lastError = err
        console.warn(
          `[docflow-ai] ${model.provider}/${model.modelId} failed, trying next model:`,
          err instanceof Error ? err.message : err,
        )
      }
    }
    throw lastError
  }

  return {
    specificationVersion: 'v4',
    provider: 'docflow-fallback',
    modelId: models.map((m) => m.modelId).join(' -> '),
    get supportedUrls() {
      return models[0].supportedUrls
    },
    doGenerate: (options) => tryEach((m) => m.doGenerate(options)),
    doStream: (options) => tryEach((m) => m.doStream(options)),
  }
}
