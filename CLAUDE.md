# زبان من — English OS

اپ شخصی یادگیری انگلیسی برای فربد: voice-first، PWA، روی آیفون و آیپد.

- پروفایل و تصمیم‌ها: `docs/PROFILE.md` (همیشه اول این را بخوان؛ دوباره نپرس).
- ظاهر: طرح **B · Liquid Metal** در `docs/design/directions-v1.png` (گوی طلای مذاب روی گرافیت). از ظاهر «حساب من» تقلید نکن.
- فنی مثل اکوسیستم حساب من / زندگی من: جاوااسکریپت خالص، بدون CDN، IndexedDB، همگام‌سازی اختیاری Supabase (`eco_items`, app = `lang`)، GitHub Pages، `VERSION` در `sw.js`.
- هزینه: فقط سرویس‌های رایگان. کلید هیچ API‌ای داخل اپ یا مخزن نیست (فقط Supabase Edge Function secrets).
- روند: تحقیق متمرکز → سند تصمیم → تأیید فربد → ساخت. انتشار و هر تغییر ظاهری فقط بعد از تأیید، با عکس.
- گفتگو با فربد به فارسی؛ سؤال‌ها یکی‌یکی و با گزینه.
- اسکیل‌های پروژه در `.claude/skills`: frontend-design، ui-ux-pro-max، webapp-testing.

## Token budget (graphify)
- Before exploring code, build the code graph (AST only, no LLM, a few seconds):
  `pip install -q graphifyy 2>/dev/null || pip install -q --break-system-packages graphifyy; graphify update .`
- Navigate with the graph instead of grep or reading whole files: `graphify query "<question>"` (capped at ~2000
  tokens), `graphify explain "<symbol>"`, `graphify affected "<symbol>"` before changing it, `graphify path "A" "B"`.
  Read `graphify-out/GRAPH_REPORT.md` only when an architecture overview is needed.
- Then open only the files and line ranges the graph points to (Read with offset/limit). Never read `vendor/`,
  `fonts/`, `icons/`, images, data/JSON dumps or minified bundles unless the task is about them.
- After editing code run `graphify update .` again. `graphify-out/` is gitignored; never commit it.
