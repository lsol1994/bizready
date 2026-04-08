// ============================================================
// AI 호출 추상화 레이어
// 현재 구현: Gemini 2.5 Flash
//
// 다른 모델로 교체하려면 이 파일만 수정하면 됩니다:
//   - OpenAI GPT-4o-mini: GEMINI_* 상수와 callAI 함수 내부만 교체
//   - Claude: 동일하게 이 파일만 수정
//   - chat-api.tsx, chat.tsx 는 수정 불필요
// ============================================================

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ── 시스템 프롬프트 ────────────────────────────────────────
const SYSTEM_PROMPT = `당신은 대한민국 중소기업 경영지원 전문가 AI입니다.
세무회계, 인사노무, 총무행정 실무에 특화된 어시스턴트로서 다음 원칙을 지킵니다.

1. 한국 세법·노동법·관련 법령 기준으로 답변합니다.
2. 실무 담당자가 바로 활용할 수 있도록 구체적이고 단계적으로 설명합니다.
3. 법령 개정 가능성이 있는 내용은 반드시 "최신 법령 확인 권장"을 명시합니다.
4. 확실하지 않은 내용은 솔직히 모른다고 말하고 관련 기관(국세청, 근로복지공단, 고용노동부 등) 확인을 안내합니다.
5. 전문 용어는 괄호 안에 쉬운 설명을 덧붙입니다.
6. 답변은 항상 한국어로 작성합니다.
7. 필요시 표나 목록을 활용해 가독성을 높입니다.`

// ── Gemini 설정 ────────────────────────────────────────────
// 모델 교체 시 아래 상수만 변경하면 됩니다
const AI_MODEL = 'gemini-1.5-flash'
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

// Gemini는 assistant 대신 'model' 역할 사용
function toGeminiMessages(messages: ChatMessage[]) {
  return messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
}

// ── callAI: 스트리밍 ReadableStream 반환 ──────────────────
// 반환 스트림 포맷: SSE ("data: <JSON문자열>\n\n", 종료 시 "data: [DONE]\n\n")
export async function callAI(
  messages: ChatMessage[],
  env: { GEMINI_API_KEY: string }
): Promise<ReadableStream<Uint8Array>> {
  const url =
    `${GEMINI_BASE_URL}/models/${AI_MODEL}:streamGenerateContent` +
    `?key=${env.GEMINI_API_KEY}&alt=sse`

  const geminiRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: toGeminiMessages(messages),
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
      },
    }),
  })

  if (!geminiRes.ok || !geminiRes.body) {
    const errText = await geminiRes.text()
    throw new Error(`Gemini API ${geminiRes.status}: ${errText.slice(0, 200)}`)
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = geminiRes.body!.getReader()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const jsonStr = line.slice(6).trim()
            if (!jsonStr || jsonStr === '[DONE]') continue

            try {
              const parsed = JSON.parse(jsonStr)
              const text: string | undefined =
                parsed?.candidates?.[0]?.content?.parts?.[0]?.text
              if (text) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(text)}\n\n`)
                )
              }
            } catch {
              // JSON 파싱 실패 청크 무시
            }
          }
        }
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })
}
