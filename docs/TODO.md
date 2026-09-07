# کارهای باقی‌مانده

## قبل از QA ذی‌نفعان

- [ ] اجرای Migration روی PostgreSQL محیط QA؛
- [ ] تست دستی کامل OTP → Game → Result → Leaderboard؛
- [ ] تست واقعی روی iPhone Safari و چند Android Chrome؛
- [ ] تست Android Chrome با هر دو حالت فعال و غیرفعال `Remove animations`؛ در هر دو حالت Countdown و خرچ/خروچ باید Motion کامل داشته باشند و Combo در حالت کاهش Motion ثابت دیده شود؛
- [ ] QA دستی HUD، Pause/End، محدوده‌ی اوج آیتم و خوانایی/زمان‌بندی WebPهای ثابت خرچ/خروچ روی موبایل، تبلت و دسکتاپ؛
- [ ] تأیید Creative پس‌زمینه‌ی چوبی جدید و خوانایی HUD نارنجی `#EE9F35` روی موبایل؛
- [ ] تأیید Creative صدای جلزولز/Crunch شمارش معکوس؛
- [ ] تأیید Creative روی Cut شصت‌ویک‌ثانیه‌ای و Fade ده‌ثانیه‌ی پایانی موزیک؛
- [ ] تأیید Copy و قوانین رسمی مسابقه.
- [ ] تست Contract ابزار WebMCP در Browser دارای `document.modelContext`.

## قبل از انتشار عمومی

- [x] ساخت ابرک Ubuntu 24.04 ابرآروان برای Production؛
- [x] افزودن Docker Compose، Reverse Proxy، Migration و چرخه‌ی Auto-deploy از Branch `main`؛
- [x] اجرای اولین Migration و تأیید Health Check عمومی Web و API روی IP سرور؛
- [ ] اتصال SMS Provider و خاموش‌کردن OTP Preview؛
- [ ] فعال‌کردن HTTPS و بازگرداندن `AUTH_COOKIE_SECURE=true`؛
- [ ] تعریف Limit روزانه‌ی شرکت در کمپین؛
- [ ] افزودن Edge Rate Limit/WAF؛
- [ ] انتقال ثبت و سقف Pause از Client به Server برای نسخه‌ی جایزه‌دار؛
- [ ] Load Test پایان بازی و Leaderboard؛
- [ ] مانیتورینگ خطا و Audit رکوردهای مشکوک؛
- [ ] اتصال Domain و فعال‌سازی HTTPS؛
- [ ] افزودن Backup خارج از ابرک برای PostgreSQL و تست Restore؛
- [ ] Privacy policy و دوره‌ی نگهداری شماره موبایل؛
- [ ] بررسی دستی رکوردهای برتر پیش از اعلام برنده.

## فازهای بعدی Gameplay

- [x] نمایش Combo برای حداقل ۳ Hit در یک Gesture و بازه‌ی ۳۰۰ میلی‌ثانیه‌ای؛
- [x] ضریب امتیاز Combo با اعتبارسنجی سمت سرور؛
- [ ] Bomb؛
- [ ] Bonus Item؛
- [ ] Combo/Bonus visual و sound؛
- [ ] پنل ادمین برای مشاهده و Invalid کردن رکورد مشکوک.
