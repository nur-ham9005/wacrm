import { AiError, type ProviderResult } from '../types'
import { MAX_OUTPUT_TOKENS } from '../defaults'
import {
  mergeConsecutive,
  normalizeUsage,
  providerHttpError,
  toNetworkError,
  type ProviderArgs,
} from './shared'

// DeepSeek exposes an OpenAI-compatible Chat Completions API. The
// endpoint is stable across both `https://api.deepseek.com` and the
// `/v1` alias; we hit the plain base so a BYO key never depends on a
// versioned path.
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

interface DeepSeekResponse {
  choices?: { message?: { content?: string } }[]
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

/**
 * Call DeepSeek's Chat Completions endpoint with the caller's own key.
 * Same OpenAI-compatible envelope as `generateOpenAi`, differing only in
 * the base URL and in using `max_tokens` (the parameter DeepSeek
 * accepts; `max_completion_tokens` is an OpenAI-only spelling).
 */
export async function generateDeepSeek(
  args: ProviderArgs,
): Promise<ProviderResult> {
  const { apiKey, model, systemPrompt, messages, timeoutMs } = args

  let res: Response
  try {
    res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...mergeConsecutive(messages),
        ],
        max_tokens: MAX_OUTPUT_TOKENS,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    throw toNetworkError(err)
  }

  if (!res.ok) {
    throw await providerHttpError('DeepSeek', res)
  }

  const data = (await res.json().catch(() => null)) as DeepSeekResponse | null
  const text = data?.choices?.[0]?.message?.content
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new AiError('DeepSeek returned an empty response.', {
      code: 'empty_response',
    })
  }
  const usage = normalizeUsage({
    prompt: data?.usage?.prompt_tokens,
    completion: data?.usage?.completion_tokens,
    total: data?.usage?.total_tokens,
  })
  return { text, usage }
}
