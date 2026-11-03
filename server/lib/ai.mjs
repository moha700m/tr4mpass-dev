/**
 * Saudi-style writing helpers.
 * Uses OPENAI_API_KEY when present; otherwise high-quality local transforms.
 */

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

function preserveTokens(text) {
  const vault = []
  const masked = text.replace(/(https?:\/\/\S+)|(#\w+)|(@\w+)|(\d+(?:[.,]\d+)?%?)/g, (m) => {
    vault.push(m)
    return `__T${vault.length - 1}__`
  })
  return {
    masked,
    restore: (out) => out.replace(/__T(\d+)__/g, (_, i) => vault[Number(i)] ?? _),
  }
}

function softSaudiLexicon(text) {
  return text
    .replace(/\bماذا\b/g, 'وش')
    .replace(/\bلماذا\b/g, 'ليش')
    .replace(/\bكيف يمكنني\b/g, 'كيف أقدر')
    .replace(/\bيمكنك\b/g, 'تقدر')
    .replace(/\bيجب\b/g, 'لازم')
    .replace(/\bالآن\b/g, 'الحين')
    .replace(/\bأيضاً?\b/g, 'بعد')
    .replace(/\bلكن\b/g, 'بس')
    .replace(/\bجداً?\b/g, 'مرّة')
    .replace(/\bأريد\b/g, 'أبي')
    .replace(/\bأريد أن\b/g, 'أبي')
    .replace(/\bهل\b/g, 'هل')
}

async function llm(system, user) {
  const key = (process.env.OPENAI_API_KEY || '').trim()
  if (!key) return null
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('openai failed', res.status, data?.error?.message || data)
    return null
  }
  return data.choices?.[0]?.message?.content?.trim() || null
}

const SYSTEM = `أنت كاتب سعودي لثريدات X.
اكتب بأسلوب سعودي طبيعي وواضح وهادئ.
ابدأ بجملة قوية، وانتهِ بدعوة بسيطة خفيفة.
حافظ على الروابط والهاشتاقات والأرقام كما هي.
لا تستخدم فصحى ثقيلة ولا مبالغة.`

export async function writeThreadFromIdea(idea) {
  const clean = (idea || '').trim() || 'فكرة بسيطة'
  const llmOut = await llm(
    SYSTEM,
    `اكتب ثريد من 3 تغريدات عن الفكرة التالية. افصل كل تغريدة بـ --- فقط:\n${clean}`,
  )
  if (llmOut) {
    return llmOut
      .split(/\n---\n|\n---\n?/)
      .map((p) => p.trim())
      .filter(Boolean)
  }

  const { masked, restore } = preserveTokens(clean)
  return [
    restore(`${softSaudiLexicon(masked)}\n\nأكثر الناس يضيعون هنا قبل ما يبدأون.`),
    'خلّها بسيطة:\n١) اكتب أول جملة\n٢) كمّل بدون ما توقف\n٣) انشر وكمّل بكره',
    'الهدوء تركيز… مو بطء.\n\nابدأ الحين، وخلّ الباقي يجي لوحده.\n\nلو استفدت، تابع للمزيد.',
  ]
}

export async function improveText(text) {
  const body = (text || '').trim()
  if (!body) return ''
  const llmOut = await llm(SYSTEM, `حسّن هذا النص واجعله أقوى وأكثر طبيعية بدون ما تغيّر المعنى:\n${body}`)
  if (llmOut) return llmOut

  const { masked, restore } = preserveTokens(body)
  const lines = softSaudiLexicon(masked).split('\n').filter((l) => l.trim())
  const opener = lines[0] || 'خلّني أقولك شيء مهم.'
  const rest = lines.slice(1).join('\n').trim()
  return restore(
    `${opener}\n\n${rest ? `${rest}\n\n` : ''}لو استفدت، احفظ التغريدة وارجع لها لاحقاً.`,
  )
}

export async function toSaudi(text) {
  const body = (text || '').trim()
  if (!body) return ''
  const llmOut = await llm(SYSTEM, `حوّل النص للهجة سعودية سلسة واحتفظ بالروابط والهاشتاقات والأرقام:\n${body}`)
  if (llmOut) return llmOut
  const { masked, restore } = preserveTokens(body)
  return restore(softSaudiLexicon(masked))
}

export async function rewriteThreadParts(parts, { saudi = true } = {}) {
  const joined = parts.join('\n---\n')
  const llmOut = await llm(
    SYSTEM,
    `أعد صياغة هذا الثريد${saudi ? ' بلهجة سعودية' : ''} مع الحفاظ على الروابط والهاشتاقات والأرقام. افصل التغريدات بـ ---:\n${joined}`,
  )
  if (llmOut) {
    return llmOut
      .split(/\n---\n|\n---\n?/)
      .map((p) => p.trim())
      .filter(Boolean)
  }
  const out = []
  for (const p of parts) {
    out.push(saudi ? await toSaudi(p) : await improveText(p))
  }
  return out
}
