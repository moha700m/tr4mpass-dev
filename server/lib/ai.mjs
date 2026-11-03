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
    .replace(/\bأريد أن\b/g, 'أبي')
    .replace(/\bأريد\b/g, 'أبي')
    .replace(/\bهل\b/g, 'هل')
    .replace(/\bالآن\b/g, 'الحين')
}

function extractLinks(text) {
  return [...String(text || '').matchAll(/https?:\/\/\S+/g)].map((m) => m[0])
}

function extractMentions(text) {
  return [...String(text || '').matchAll(/@\w+/g)].map((m) => m[0])
}

function firstLine(text) {
  return (
    String(text || '')
      .split('\n')
      .map((l) => l.trim())
      .find(Boolean) || ''
  )
}

function bulletLines(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.replace(/^[\s•\-\*]+/, '').trim())
    .filter(
      (l) =>
        l &&
        !/^https?:\/\//i.test(l) &&
        !/^by\s+@/i.test(l) &&
        !/^🔗/.test(l) &&
        l.length > 2,
    )
}

const STOP_TITLE = new Set(
  'Why How What When Where Who This That These Those Just New Free Get Try Use Ship Build Make Your Out Now Today'.split(
    ' ',
  ),
)

function productName(text) {
  const raw = String(text || '')
  // Prefer Product + version (BuildBox v2.1.4)
  const withVer = raw.match(/\b([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+)*)\s+(v?\d+(?:\.\d+){1,3})\b/)
  if (withVer && !STOP_TITLE.has(withVer[1].split(/\s+/)[0])) {
    return `${withVer[1]} ${withVer[2]}`
  }
  const candidates = [...raw.matchAll(/\b([A-Z][A-Za-z0-9]{2,}(?:\s+[A-Z][A-Za-z0-9]+)*)\b/g)].map(
    (m) => m[1],
  )
  const scored = []
  for (const c of candidates) {
    const first = c.split(/\s+/)[0]
    if (STOP_TITLE.has(first)) continue
    if (/^(https?|http|www)$/i.test(first)) continue
    // Prefer brand-like CamelCase over ALLCAPS acronyms (IPA, API…)
    const camel = /[a-z]/.test(first) && /[A-Z]/.test(first) ? 2 : 0
    const notAllCaps = first !== first.toUpperCase() ? 1 : 0
    scored.push({ c, score: camel + notAllCaps + Math.min(first.length, 8) / 10 })
  }
  scored.sort((a, b) => b.score - a.score)
  if (scored[0]) return scored[0].c
  const ar = firstLine(raw).match(/[\u0600-\u06FF][\u0600-\u06FF\s]{2,40}/)
  if (ar) return ar[0].trim()
  return 'التحديث'
}

function hashPick(seed, list) {
  let h = 0
  const s = String(seed || '')
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return list[h % list.length]
}

/** English feature / sentence → Arabic gloss for local offline mode. */
function glossFeature(line) {
  const s = String(line || '').trim()
  if (!s) return null

  const rules = [
    [/build,\s*sign\s*&\s*install\s*ipas?/i, 'تبني وتوقّع وتثبّت ملفات IPA'],
    [/compile\s+swift.*iphone/i, 'تجمّع كود Swift وتطلّع IPA موقّع من جوالك'],
    [/signed\s+ipas?/i, 'تطلّع IPA موقّع جاهز'],
    [/new\s+app\s+icon.*/i, 'أيقونة جديدة بتصميم أوضح'],
    [/fixed\s+download.*buttons?/i, 'إصلاح أزرار التحميل والتوقيع والتثبيت'],
    [/blueprint\s+grid/i, 'تصميم شبكة مخطط أوضح'],
    [/directly\s+on\s+your\s+iphone/i, 'مباشرة من الآيفون'],
    [/launch(ing)?\s+(today|now)|is\s+out!?/i, 'طلع الحين'],
    [/free\s+(to\s+use|download|forever)/i, 'مجاني'],
    [/open[\s-]?source/i, 'مفتوح المصدر'],
    [/no\s+(account|signup|sign[\s-]?up)\s+needed/i, 'بدون حساب'],
    [/dark\s+mode/i, 'وضع داكن'],
    [/faster|speed|performance/i, 'أسرع وأسلس'],
    [/bug\s*fix(es)?|fixed/i, 'إصلاحات مهمة'],
    [/new\s+feature/i, 'ميزة جديدة'],
    [/update(d)?|release(d)?/i, 'تحديث جديد'],
    [/ai[\s-]?powered|with\s+ai/i, 'بمساعدة الذكاء'],
    [/schedule|scheduling/i, 'جدولة'],
    [/analytics|insights/i, 'أرقام وتحليلات'],
    [/thread(s)?/i, 'ثريدات'],
  ]
  for (const [re, ar] of rules) {
    if (re.test(s)) return ar
  }

  // Short English promo lines → soft Arabic meaning, keep product tokens
  if (isMostlyEnglish(s)) {
    if (s.length > 110) return null
    if (/ship\s+your\s+ipa|ipa\s+today/i.test(s)) return 'انشر IPA حقك اليوم'
    if (/why\s+wait/i.test(s)) return 'لا تؤجلها'
    const brands = [...s.matchAll(/\b([A-Z][A-Za-z0-9]+(?:[A-Z][A-Za-z0-9]+)+)\b/g)].map((m) => m[1])
    const brand = brands[0]
    if (/ship|launch|release|try|get\s+started/i.test(s) && brand) {
      return `جرّب ${brand} الحين`
    }
    if (brand) return `شيء مفيد من ${brand}`
    return null
  }
  return s
}

function arabicHooks(name) {
  return [
    `تحديث يستاهل توقف عنده.\n\n${name}\n\nمو ضجيج إعلانات… شيء تقدر تجربه الحين.`,
    `${name}\n\nباختصار؟ شيء يوفّر عليك وقت، ويخلّي التجربة أوضح.`,
    `لو تتابع التحديثات بهدوء… هذا واحد يستاهل.\n\n${name}`,
    `ما يحتاج ضجيج.\n\n${name}\n\nفكرة واضحة، ونتيجة تقدر تستخدمها.`,
  ]
}

function arabicCtas(link, credit) {
  const creditLine = credit ? `المصدر: ${credit}` : ''
  if (link) {
    return [
      `تبي تجربه؟\n${link}\n\n${creditLine ? `${creditLine}\n` : ''}لو فادك احفظ التغريدة وارجع لها.`,
      `الرابط هنا:\n${link}\n\n${creditLine ? `${creditLine}\n` : ''}جرّبه بهدوء وقل لي وش رأيك.`,
      `${link}\n\n${creditLine ? `${creditLine}\n\n` : ''}لو استفدت، احفظها وشاركها مع اللي يهمه.`,
    ]
  }
  return [
    `${creditLine ? `${creditLine}\n\n` : ''}لو فادك احفظها وشاركها مع اللي يهمه.`,
    `${creditLine ? `${creditLine}\n\n` : ''}خذ اللي تحتاجه، وكمّل يومك بهدوء.`,
  ]
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
    const featureCandidates = points.filter((p) => {
      const plain = p.replace(/[^\w\s]/g, '').trim().toLowerCase()
      const namePlain = String(name).replace(/[^\w\s]/g, '').trim().toLowerCase()
      if (/OUT!/i.test(p)) return false
      if (/^by\s+@/i.test(p)) return false
      if (plain === namePlain) return false
      if (
        namePlain &&
        plain.startsWith(namePlain.split(/\s+/)[0]) &&
        plain.length < namePlain.length + 8
      )
        return false
      return true
    })

    // Also mine sentences from non-bullet English paragraphs
    const sentenceBits = raw
      .split(/[\n.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 12 && isMostlyEnglish(s) && !/^https?:/i.test(s) && !/^by\s+@/i.test(s))

    const pool = [...featureCandidates, ...sentenceBits]

    const glossed = []
    const seen = new Set()
    for (const p of pool) {
      const g = glossFeature(p)
      if (!g || seen.has(g) || g.startsWith('→ ') && g.length < 8) continue
      seen.add(g)
      glossed.push(g)
      if (glossed.length >= 4) break
    }

    const features =
      glossed.length > 0
        ? glossed.map((p, i) => `${i + 1}) ${p}`).join('\n')
        : '١) أوضح\n٢) أسهل\n٣) جاهز للاستخدام'

    // Summary line — never copy a numbered feature verbatim
    const summaries = [
      'يختصر عليك التعب ويعطيك نتيجة أوضح.',
      'الفكرة: أقل خطوات، ونتيجة جاهزة تستخدمها.',
      'مو شرح طويل — تحديث تقدر تجربه بنفسك.',
    ]
    let valueLine = hashPick(raw + 'value', summaries)
    if (/ipa|swift|iphone|buildbox/i.test(raw)) {
      valueLine = 'تبني وتوقّع وتثبّت… من جوالك مباشرة.'
    }

    const hook = hashPick(raw, arabicHooks(name))
    const cta = hashPick(raw + 'cta', arabicCtas(link, credit))

    return [hook, `باختصار:\n${valueLine}\n\nوش الجديد:\n${features}`, cta]
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
    if (!/لو فادك|احفظ|تابع|جرّب/.test(out[out.length - 1])) {
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

  return localSaudiVariation(list.join('\n\n'))
}
