import type { PlanLimits } from '../types'

export const PLANS: Record<'free' | 'pro', PlanLimits> = {
  free: {
    id: 'free',
    name: 'مجاني',
    maxAccounts: 1,
    maxScheduled: 10,
    scheduleDays: 7,
    aiAttempts: 15,
    videoGif: false,
    bulkImportUnlimited: false,
  },
  pro: {
    id: 'pro',
    name: 'هدوء بلس',
    maxAccounts: 3,
    maxScheduled: 'unlimited',
    scheduleDays: 365,
    aiAttempts: 'unlimited',
    videoGif: true,
    bulkImportUnlimited: true,
  },
}

/** حد الاستيراد الجماعي للخطة المجانية (عدد الروابط) */
export const FREE_BULK_LIMIT = 5

export const PRO_PRICE_SAR = 49
