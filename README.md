# هدوء

أداة عربية هادئة لكتابة ونشر ثريدات ومنشورات على **X** — منتج شخصي من محمد ([@justmgz](https://x.com/justmgz)).

## التشغيل محلياً

```bash
npm install
npm run dev
```

لربط OAuth مع X أثناء التطوير، ضع القيم في `.env` (انظر `.env.example`) وشغّل عبر Netlify Vite plugin / `netlify dev` حتى تعمل الدوال على `/api/*`.

## ربط X (OAuth 2.0 + PKCE)

1. أنشئ تطبيقاً في [X Developer Console](https://developer.x.com/en/portal/dashboard)
2. فعّل **OAuth 2.0**
3. أضف Callback URLs:
   - `http://localhost:8888/api/auth/x/callback` (أو منفذ التطوير لديك)
   - `https://YOUR-SITE.netlify.app/api/auth/x/callback`
4. أضف متغيرات البيئة على Netlify:
   - `X_CLIENT_ID` (مطلوب)
   - `X_CLIENT_SECRET` (موصى به للتطبيقات السرية)
   - `SESSION_SECRET` (نص عشوائي)

الصلاحيات المطلوبة: `tweet.read tweet.write users.read offline.access media.write`

المسار: المستخدم يضغط «اربط X» → `/api/auth/x/start` → موافقة X → `/api/auth/x/callback` → جلسة HttpOnly + تخزين آمن في Netlify Blobs → نشر عبر `POST /api/posts/publish`.

## الأقسام

- **اكتب** — ثريد، معاينة، وسائط، جدولة، نشر مباشر على X
- **التقويم** — أسبوع + سحب وإفلات
- **استيراد جماعي** — روابط X + إعادة صياغة + جدولة
- **التحليلات** — مشاهدات وتفاعل
- **المزيد** — حسابات X، الخطط، المظهر

## البناء

```bash
npm run build
```
