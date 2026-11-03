/**
 * Saudi-style writing helpers.
 * Uses OPENAI_API_KEY when present; otherwise strong local transforms
 * (including English → Saudi Arabic promo threads).
 */

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

function preserveTokens(text) {
  const vault = []
  const masked = String(text || '').replace(
    /(https?:\/\/\S+)|(#\w+)|(@\w+)|(\d+(?:\.\d+)?(?:[.,]\d+)?%?)/g,
    (m) => {
      vault.push(m)
      return `__T${vault.length - 1}__`
    },
  )
  return {
    vault,
    masked,
    restore: (out) => out.replace(/__T(\d+)__/g, (_, i) => vault[Number(i)] ?? _),
  }
}

function isMostlyEnglish(text) {
  const letters = String(text || '').replace(/[^A-Za-z\u0600-\u06FF]/g, '')
  if (!letters) return false
  const latin = (letters.match(/[A-Za-z]/g) || []).length
  return latin / letters.length > 0.55
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
}

function extractLinks(text) {
  return [...String(text || '').matchAll(/https?:\/\/\S+/g)].map((m) => m[0])
}

function extractMentions(text) {
  return [...String(text || '').matchAll(/@\w+/g)].map((m) => m[0])
}

function firstLine(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean) || ''
}

function bulletLines(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.replace(/^[\s•\-\*]+/, '').trim())
    .filter((l) => l && !/^https?:\/\//i.test(l) && !/^by\s+@/i.test(l) && !/^🔗/.test(l) && l.length > 2)
}

function productName(text) {
  const m = String(text || '').match(
    /\b([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+)*)\s*(?:v?\d+(?:\.\d+)*)?/ ,
  )
  if (m) {
    const ver = String(text).match(/\bv?\d+(?:\.\d+){1,3}\b/i)
    return ver ? `${m[1]} ${ver[0]}` : m[1]
  }
  return firstLine(text).replace(/[^\w\s.\-]/g, '').trim() || 'التحديث'
}

/** Light English feature → Arabic gloss for local offline mode. */
function glossFeature(line) {
  const s = String(line || '')
  const rules = [
    [/build,\s*sign\s*&\s*install\s*ipas?/i, 'تبني وتوقّع وتثبّت ملفات IPA'],
    [/compile\s+swift.*iphone/i, 'تجمّع كود Swift وتطلّع IPA موقّع من جوالك'],
    [/signed\s+ipas?/i, 'تطلّع IPA موقّع جاهز'],
    [/new\s+app\s+icon.*/i, 'أيقونة جديدة بتصميم أوضح'],
    [/fixed\s+download.*buttons?/i, 'إصلاح أزرار التحميل والتوقيع والتثبيت'],
    [/blueprint\s+grid/i, 'تصميم شبكة مخطط أوضح'],
    [/directly\s+on\s+your\s+iphone/i, 'مباشرة من الآيفون'],
  ]
  for (const [re, ar] of rules) {
    if (re.test(s)) return ar
  }
  // Keep short latin product words, otherwise skip noisy english lines
  if (isMostlyEnglish(s) && s.length > 40) return null
  return s
}

function arabicHook(name) {
  return `تحديث يستاهل توقف عنده.\n\n${name}\n\nمو ضجيج إعلانات… شيء تقدر تجربه الحين.`
}

/** Build a fresh Saudi promo thread variation from any source text. */
export function localSaudiVariation(source) {
  const raw = String(source || '').trim()
  if (!raw) return ['اكتب فكرتك هنا، وخلّنا نطلعها ثريد هادئ وواضح.']

  const links = extractLinks(raw)
  const mentions = extractMentions(raw)
  const points = bulletLines(raw)
  const link = links[0] || ''
  const credit = mentions[0] || ''
  const name = productName(raw)

  if (isMostlyEnglish(raw)) {
    const featureCandidates = points.filter(
      (p) =>
        !/OUT!/i.test(p) &&
        !/^by\s+@/i.test(p) &&
        p.replace(/[^\w\s]/g, '').trim().toLowerCase() !== String(name).toLowerCase(),
    )
    const glossed = featureCandidates.map(glossFeature).filter(Boolean).slice(0, 4)
    const features =
      glossed.length > 0
        ? glossed.map((p, i) => `${i + 1}) ${p}`).join('\n')
        : '١) أوضح\n٢) أسهل\n٣) جاهز للاستخدام'

    const valueSource =
      featureCandidates.find((p) => /compile|swift|signed|ipa|iphone/i.test(p)) ||
      featureCandidates.find((p) => /build|create|launch|release/i.test(p)) ||
      ''
    const valueLine = glossFeature(valueSource) || 'يختصر عليك تعب البناء والتوقيع والتثبيت.'

    return [
      arabicHook(name),
      `باختصار:\n${valueLine}\n\nوش الجديد:\n${features}`,
      link
        ? `تبي تجربه؟\n${link}\n\n${credit ? `المصدر: ${credit}\n` : ''}لو فادك احفظ التغريدة وارجع لها.`
        : `${credit ? `المصدر: ${credit}\n\n` : ''}لو فادك احفظها وشاركها مع اللي يهمه.`,
    ]
  }

  const { masked, restore } = preserveTokens(raw)
  const saudi = restore(softSaudiLexicon(masked))
  const chunks = saudi
    .split(/\n{2,}/)
    .map((c) => c.trim())
    .filter(Boolean)

  if (chunks.length >= 2) {
    const out = chunks.slice(0, 4)
    if (link && !out.some((c) => c.includes(link))) {
      out[out.length - 1] = `${out[out.length - 1]}\n\n${link}`
    }
    if (!/لو فادك|احفظ|تابع/.test(out[out.length - 1])) {
      out[out.length - 1] = `${out[out.length - 1]}\n\nلو فادك، احفظ التغريدة.`
    }
    return out
  }

  const arPoints = points.map((p) => softSaudiLexicon(p)).slice(0, 4)
  return [
    `${saudi}\n\nخلّني أرتبها لك أوضح:`,
    arPoints.length
      ? `النقاط المهمة:\n${arPoints.map((p, i) => `${i + 1}) ${p}`).join('\n')}`
      : 'الفكرة بسيطة: وضوح أكثر، ضجيج أقل، ونتيجة تقدر تستخدمها.',
    link
      ? `التفاصيل هنا:\n${link}\n\nلو استفدت، احفظها.`
      : 'لو استفدت، احفظ التغريدة وارجع لها لاحقاً.',
  ]
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
      temperature: 0.75,
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

const SYSTEM = `أنت كاتب سعودي محترف لثريدات X (تويتر).
اكتب بأسلوب سعودي طبيعي، هادئ، واضح، بدون فصحى ثقيلة وبدون مبالغة.
مهمتك دائماً: إعادة صياغة / تحسين / توليد — مو ترجمة حرفية جامدة.
ابدأ بجملة توقف القارئ، وانهِ بدعوة خفيفة (احفظ / جرّب / شارك).
حافظ على الروابط والهاشتاقات والأرقام والإشارات @ كما هي حرفياً.
إذا المصدر إنجليزي: حوّله لثريد عربي سعودي أصيل (مو ترجمة كلمة بكلمة).
افصل كل تغريدة بـ --- فقط عندما يُطلب ثريد.`

function splitThread(llmOut) {
  return String(llmOut || '')
    .split(/\n---\n|\n---\n?/)
    .map((p) => p.trim())
    .filter(Boolean)
}

export async function writeThreadFromIdea(idea) {
  const clean = (idea || '').trim() || 'فكرة بسيطة'
  const llmOut = await llm(
    SYSTEM,
    `اكتب ثريد من 3 تغريدات عن الفكرة التالية. افصل كل تغريدة بـ --- فقط:\n${clean}`,
  )
  if (llmOut) return splitThread(llmOut)

  if (isMostlyEnglish(clean)) return localSaudiVariation(clean)

  return [
    `${clean}\n\nمو كلام عام… خلّنا نفككها بهدوء.`,
    'ابدأ من أبسط خطوة تقدر تسويها اليوم.\nلا تنتظر الوقت المثالي — الوقت المثالي يجي وأنت تتحرك.',
    'الهدوء تركيز، مو بطء.\n\nخذ أول خطوة الحين، وكمّل بكره.\n\nلو فادك احفظ التغريدة.',
  ]
}

export async function improveText(text) {
  const body = (text || '').trim()
  if (!body) return ''
  const llmOut = await llm(
    SYSTEM,
    `حسّن هذا النص واجعله أقوى وأكثر طبيعية${isMostlyEnglish(body) ? '، وباللهجة السعودية' : ''} بدون ما تضيّع المعنى. أعد نص واحد فقط:\n${body}`,
  )
  if (llmOut) return llmOut.replace(/\n---\n?/g, '\n\n').trim()

  if (isMostlyEnglish(body)) return localSaudiVariation(body).join('\n\n')
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
  const llmOut = await llm(
    SYSTEM,
    `حوّل/أعد صياغة النص للهجة سعودية سلسة وجذابة. إذا كان إنجليزي، اكتب نسخة عربية سعودية أصلية. احتفظ بالروابط والـ @ والأرقام. أعد نص واحد فقط:\n${body}`,
  )
  if (llmOut) return llmOut.replace(/\n---\n?/g, '\n\n').trim()

  if (isMostlyEnglish(body)) return localSaudiVariation(body).join('\n\n')
  const { masked, restore } = preserveTokens(body)
  return restore(softSaudiLexicon(masked))
}

export async function rewriteThreadParts(parts, { saudi = true } = {}) {
  const list = (parts || []).map((p) => String(p || '').trim()).filter(Boolean)
  if (!list.length) return []

  const joined = list.join('\n---\n')
  const llmOut = await llm(
    SYSTEM,
    `أعد صياغة هذا المحتوى كـ ثريد X ${saudi ? 'بلهجة سعودية' : 'بأسلوب أوضح'}.
اطلع بنسخة مختلفة (تغييره) مو نسخ حرفي.
حافظ على الروابط والهاشتاقات والأرقام و@.
افصل التغريدات بـ --- فقط:
${joined}`,
  )
  if (llmOut) {
    const split = splitThread(llmOut)
    if (split.length) return split
  }

  // Local smart variation across the whole source
  return localSaudiVariation(list.join('\n\n'))
}
