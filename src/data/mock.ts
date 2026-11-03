import type { AnalyticsPost, ScheduledPost, XAccount } from '../types'

export const MOCK_ACCOUNTS: XAccount[] = [
  {
    id: 'acc-1',
    handle: 'justmgz',
    name: 'محمد',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=MG&backgroundColor=5ba88a&textColor=ffffff',
    connectedAt: '2026-01-10T10:00:00.000Z',
  },
]

export const MOCK_POSTS: ScheduledPost[] = [
  {
    id: 'post-1',
    accountId: 'acc-1',
    parts: [
      {
        id: 't1',
        text: 'أكثر شيء يضيّع وقتك مو الكتابة…\n\nهو التفكير الزايد قبل ما تبدأ.\n\nافتح الصندوق واكتب أول جملة بس.',
        media: [],
      },
      {
        id: 't2',
        text: 'بعدها الثريد يكمّل نفسه.\n\nجوّك الآن أهم من الكمال.',
        media: [],
      },
    ],
    scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 5).toISOString(),
    status: 'scheduled',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: 'post-2',
    accountId: 'acc-1',
    parts: [
      {
        id: 't3',
        text: 'ثلاث عادات بسيطة غيّرت طريقة نشري على X:\n\n١) فكرة واحدة لكل ثريد\n٢) عنوان قوي في أول سطر\n٣) دعوة واضحة في الآخر',
        media: [],
      },
    ],
    scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 28).toISOString(),
    status: 'scheduled',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
  },
  {
    id: 'post-3',
    accountId: 'acc-1',
    parts: [
      {
        id: 't4',
        text: 'الهدوء مو بطء.\n\nالهدوء تركيز.',
        media: [],
      },
    ],
    scheduledAt: new Date(Date.now() - 1000 * 60 * 60 * 80).toISOString(),
    status: 'published',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 80).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 100).toISOString(),
  },
  {
    id: 'post-4',
    accountId: 'acc-1',
    parts: [
      {
        id: 't5',
        text: 'هذا المنشور يحتاج مراجعة قبل النشر — الصورة ما اترفعت بشكل صحيح.',
        media: [],
      },
    ],
    scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 50).toISOString(),
    status: 'needs_attention',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
]

export const MOCK_ANALYTICS: AnalyticsPost[] = [
  {
    ...MOCK_POSTS[2],
    metrics: {
      views: 18420,
      likes: 642,
      replies: 87,
      reposts: 120,
      bookmarks: 310,
      collectedAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    },
  },
  {
    id: 'post-a2',
    accountId: 'acc-1',
    parts: [
      {
        id: 'ta2',
        text: 'لو تكتب كل يوم ٥ دقايق بس…\nبتلاقي نفسك بعد شهر عندك مكتبة ثريدات جاهزة.',
        media: [],
      },
    ],
    scheduledAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    status: 'published',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 13).toISOString(),
    metrics: {
      views: 9210,
      likes: 401,
      replies: 44,
      reposts: 66,
      bookmarks: 188,
      collectedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9).toISOString(),
    },
  },
  {
    id: 'post-a3',
    accountId: 'acc-1',
    parts: [
      {
        id: 'ta3',
        text: 'لا تنتظر الإلهام.\n\nرتّب وقتك، وخلّ الإلهام يجي وأنت تكتب.',
        media: [],
      },
    ],
    scheduledAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 40).toISOString(),
    status: 'published',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 40).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 41).toISOString(),
    metrics: {
      views: 45200,
      likes: 2104,
      replies: 312,
      reposts: 540,
      bookmarks: 980,
      collectedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 37).toISOString(),
    },
  },
]

/** أوقات نشر مقترحة هادئة (بتوقيت محلي) */
export const SUGGESTED_SLOTS = [9, 12, 17, 20]
