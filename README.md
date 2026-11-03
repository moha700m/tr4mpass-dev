# هدوء

أداة عربية هادئة لكتابة ونشر ثريدات ومنشورات على **X** — منتج شخصي من محمد ([@justmgz](https://x.com/justmgz)).

## التشغيل محلياً

```bash
npm install
npm run build
npm start
```

للتطوير مع Vite: `npm run dev` (واجهة) + السيرفر على نفس المنفذ بعد البناء، أو اضبط البروكسي حسب حاجتك.

## ربط X (OAuth 1.0a)

الدخول يستخدم **OAuth 1.0a** (API Key + Secret) لتفادي أخطاء موافقة OAuth 2.0 مثل «You weren’t able to give access to the app».

1. افتح [X Developer Console](https://developer.x.com/en/portal/dashboard)
2. من تطبيقك → **Keys and tokens** انسخ:
   - **API Key** → `X_API_KEY`
   - **API Key Secret** → `X_API_SECRET`
3. في **User authentication settings**:
   - App permissions: **Read and write**
   - Type of App: **Web App**
   - Callback URI / Redirect URL (حرفياً):
     - `https://hudu-tz2i.onrender.com/api/auth/x/callback`
     - (محلياً) `http://localhost:3000/api/auth/x/callback`
4. على Render أضف المتغيرات:
   - `X_API_KEY`
   - `X_API_SECRET`
   - `SESSION_SECRET` (موجود مسبقاً)

المسار: «اربط X» → `/api/auth/x/start` → موافقة X → `/api/auth/x/callback` → جلسة مشفّرة.

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
