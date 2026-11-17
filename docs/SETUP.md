# راه‌اندازی سرور صدا (یک بار، حدود ۱۰ دقیقه)

بدون این مرحله، اپ در **حالت Demo** کار می‌کند: کل مسیر جلسه کار می‌کند، ولی جواب‌ها آماده‌اند و صدایت جایی فرستاده نمی‌شود.

> هیچ کلیدی را در چت، در مخزن یا داخل اپ نگذار. فقط در Supabase → Secrets.

## ۱. کلید Groq (تبدیل صدا به متن + جایگزین مدل)
1. https://console.groq.com/keys ← وارد شو (Google یا ایمیل).
2. **Create API Key** ← اسم: `english-os` ← کلید را کپی کن (فقط یک بار نشان داده می‌شود).

## ۲. کلید Google AI Studio (جواب شخصیت‌ها، Coach، صدای طبیعی)
1. https://aistudio.google.com/apikey ← وارد شو.
2. **Create API key** ← کلید را کپی کن.
3. پرداخت (Billing) را **فعال نکن**؛ ما فقط از نسخهٔ رایگان استفاده می‌کنیم.

## ۳. رمز اپ (LANG_PASS)
یک عبارت طولانی و تصادفی بساز (دست‌کم ۲۰ نویسه، مثلاً از Passwords آیفون). این رمز جلوی استفادهٔ دیگران از سهمیهٔ رایگانت را می‌گیرد. همین را بعداً یک بار در اپ وارد می‌کنی.

## ۴. گذاشتن در Supabase
https://supabase.com/dashboard/project/paclucymaqgellnlctbv/functions/secrets
سه secret اضافه کن (اسم‌ها دقیقاً همین):

| Name | Value |
|---|---|
| `GROQ_API_KEY` | کلید مرحلهٔ ۱ |
| `GEMINI_API_KEY` | کلید مرحلهٔ ۲ |
| `LANG_PASS` | رمز مرحلهٔ ۳ |

## ۵. وصل کردن اپ
اپ ← My style ← Settings ← رمز LANG_PASS ← Save. باید بنویسد: `Connected. Speech: yes · Gemini: yes · Groq: yes`.

## اگر چیزی کار نکرد
| پیام | یعنی |
|---|---|
| The server pass is wrong | LANG_PASS در اپ و Supabase یکی نیست |
| No connection to the server | اینترنت یا VPN |
| Gemini: no | کلید گوگل ثبت نشده؛ Groq جایگزین می‌شود و صدا از خود آیفون است |
| gemini 403 / 400 در پیام خطا | گوگل این منطقه یا حساب را نپذیرفته؛ Groq جایگزین است |

---
### برای Claude (فنی)
- تابع: `supabase/functions/lang/index.ts`، deploy با `verify_jwt = false` (دروازه = `LANG_PASS`).
- مدل‌ها با secret قابل تغییرند: `GEMINI_MODEL` (پیش‌فرض `gemini-flash-latest`)، `GEMINI_TTS_MODEL`، `GROQ_MODEL`، `GROQ_STT_MODEL`. بعد از نخستین اتصال، نام مدل‌ها با ListModels واقعی چک شود.
