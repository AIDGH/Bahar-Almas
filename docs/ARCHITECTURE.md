# معماری بازی کمپین بهار الماس

## نمای کلی

پروژه یک Modular Monolith است. UI و بازی داخل Next.js اجرا می‌شوند، اما هویت، زمان معتبر Session، محاسبه‌ی امتیاز و لیدربورد در NestJS/PostgreSQL قرار دارند.

```text
Client
 ├── Landing UI
 ├── Auth dialog
 └── Canvas game
       ↓ REST / JSON + HttpOnly cookie
NestJS
 ├── AuthModule
 ├── GameModule
 └── LeaderboardModule
       ↓ Prisma
PostgreSQL
```

## معماری استقرار

Production روی یک ابرک Ubuntu 24.04 ابرآروان اجرا می‌شود. Caddy تنها ورودی عمومی است؛ Web، API و PostgreSQL پورت عمومی ندارند و روی Docker network داخلی با هم ارتباط دارند.

```text
Internet
   ↓ :80 / :443
Caddy
   ├── /api/v1/* → NestJS :4002
   └── /*         → Next.js :3002
                         ↓
                 PostgreSQL :5432
```

Branch `main` هر ۶۰ ثانیه از داخل سرور بررسی می‌شود. Commit تازه ابتدا Build می‌شود، Migrationهای Prisma را اجرا می‌کند و سپس Containerها را به‌روزرسانی می‌کند. Health Check API شرط ثبت SHA موفق است و File Lock از Deploy همزمان جلوگیری می‌کند.

## Frontend

مسیر: `apps/web`

- Next.js App Router؛
- صفحه‌ی اصلی Client-driven چون Game loop و Pointer events نیاز به Browser دارند؛
- Canvas دوبعدی با `requestAnimationFrame`؛
- ساعت Monotonic مرورگر برای زمان Gameplay تا تغییر ساعت دستگاه روی بازی اثر نگذارد؛
- سقف Device Pixel Ratio برابر ۲ برای جلوگیری از مصرف زیاد GPU/Memory؛
- `ResizeObserver` برای تطبیق Canvas با موبایل، تبلت و دسکتاپ؛
- Pointer Events واحد برای Touch، Pen و Mouse؛
- چهار Audio element قابل استفاده‌ی مجدد برای جلوگیری از ساخت Audio در هر Hit؛
- Unlock شدن Audio در Gesture دکمه‌ی شروع، پخش صدای جلزولز/Crunch در شمارش معکوس مستقل سه‌ثانیه‌ای و شروع همزمان موزیک/Gameplay در صفر؛
- توقف و ادامه‌ی موزیک همراه Pause و استفاده از فایل ۶۱ ثانیه‌ای با Fade ازپیش‌اعمال‌شده برای اجرای پایدار روی موبایل؛
- افکت Crumb و Slash داخل Canvas و توالی «خرچ» سپس «خروچ» با WebP ثابت، CSS animation، فاصله‌ی زمانی ۴۲۰ میلی‌ثانیه و Cooldown سراسری؛
- Override هدفمند `prefers-reduced-motion` فقط برای Motion اصلی Countdown و خرچ/خروچ؛ Combo در این حالت ثابت نمایش داده می‌شود و سایر Motionهای غیرضروری کاهش می‌یابند؛
- تشخیص و پیش‌نمایش Combo در Client فقط داخل یک Pointer Gesture و پنجره‌ی ۳۰۰ میلی‌ثانیه‌ای؛ امتیاز نهایی ضریب‌دار دوباره در Server محاسبه می‌شود؛
- پس‌زمینه‌ی چوبی ۱۶KB به‌صورت CSS background رندر می‌شود و HUD نارنجی `#EE9F35` با دورخط تیره کنتراست آن را حفظ می‌کند؛ عدد صفر شروع دقیقاً استایل اعداد ۳، ۲ و ۱ Countdown را دارد؛
- HUD واکنش‌گرا با امتیاز در چپ، Pause در مرکز و تایمر در راست؛
- Pause هم Gameplay و هم ساعت Monotonic Client را متوقف می‌کند و بودجه‌ی تجمعی آن ۳۰ ثانیه است؛
- دسترسی API در `src/lib/api.ts` و Same-origin proxy در Development.
- ابزار WebMCP خواندنی `read_bahar_almas_leaderboard` برای Browserهای پشتیبان؛ نبود پشتیبانی WebMCP روی اجرای عادی سایت اثر ندارد.

## Backend

مسیر: `apps/api`

- NestJS 11؛
- ValidationPipe سراسری با whitelist؛
- Cookie Session به‌جای ذخیره‌ی Token در Local Storage؛
- Prisma 7 با PostgreSQL adapter؛
- اجبار Timezone هر Connection به UTC برای اعتبارسنجی پایدار زمان بازی؛
- برنامه‌ی Targetها به‌صورت Deterministic از Seed سرور ساخته می‌شود؛
- نتیجه‌ی Client صرفاً Hit telemetry است، نه Score قابل اعتماد؛
- ضریب Combo پس از اعتبارسنجی Hitهای پایه و بر اساس `gestureId` و زمان Hit در سرور اعمال می‌شود؛
- Score نهایی داخل Transaction ثبت می‌شود.

## چرخه‌ی Game Session

1. کاربر احراز هویت‌شده درخواست شروع می‌دهد.
2. API یک Seed تصادفی و زمان انقضای دقیق ۶۰ ثانیه می‌سازد.
3. Schedule کامل برای Render به Client برگردانده می‌شود.
4. Client فقط Targetهای فعال همان لحظه را رسم می‌کند.
5. Client برای هر برش شناسه‌ی Target، شناسه‌ی Gesture، زمان نسبی و مشخصات Swipe را نگه می‌دارد.
6. پایان عادی زودهنگام رد می‌شود؛ پایان صریح کاربر از منوی Pause مجاز است.
7. در پایان دستی، زمان Hitها با زمان سپری‌شده‌ی ساعت سرور محدود می‌شود.
8. API Schedule را از Seed بازسازی و Hitها را مستقل اعتبارسنجی می‌کند.
9. API خوشه‌های Combo را روی Hitهای پذیرفته‌شده محاسبه و ضریب `n/2` را از سه Hit به بالا اعمال می‌کند.
10. `GameHit`های پذیرفته‌شده با امتیاز ضریب‌خورده، نتیجه، بهترین امتیاز و رتبه ثبت/محاسبه می‌شوند.

## Performance Budget

- مجموع تصاویر بهینه‌شده‌ی فعلی حدود ۳۵۰KB؛
- پس‌زمینه‌ی چوبی حدود ۱۶KB، صدای برش حدود ۲۸KB، صدای شروع حدود ۴۲KB و موزیک یک‌دقیقه‌ای حدود ۹۵۴KB؛
- حداکثر DPR برابر ۲؛
- بدون GIF یا Video دائماً در حال Decode؛ Motion خرچ/خروچ با دو تصویر ثابت و CSS انجام می‌شود؛
- بدون DOM node برای هر Target/Particle؛
- Schedule یک‌دقیقه‌ای حدود ۷۰ Target دارد و payload کوچک می‌ماند؛
- زمان پرواز و فاصله‌ی Spawn به‌تدریج کاهش پیدا می‌کنند تا سختی بازی پیوسته بیشتر شود.
- Spawnهای نسخه‌ی ۷ علاوه بر آیتم تکی، گاهی Burstهای ۲ تا ۴ آیتمی با فاصله‌ی ۵۵ تا ۱۲۰ میلی‌ثانیه تولید می‌کنند؛ پس از Burst سه/چهارتایی دو Anchor و پس از Burst دوتایی یک Anchor فقط تکی است.

## توسعه‌ی فازهای بعد

`GameTarget.kind` اکنون سه نوع `POTATO`، `CHICKEN` و `SAMBOOSE` دارد و تابع تولید Schedule محل توسعه برای Bomb، Bonus و آیتم‌های تازه است. Combo امتیازی پس از اعتبارسنجی Hitهای پایه در سرور محاسبه می‌شود. فیلد `validationVersion` سازگاری را نگه می‌دارد: نسخه‌ی ۱ Schedule دوآیتمی، نسخه‌ی ۲ افزودن سمبوسه، نسخه‌ی ۳ فیزیک آهسته‌ی میانی، نسخه‌ی ۴ بازی ۶۰ ثانیه‌ای با سختی افزایشی، نسخه‌ی ۵ شروع سریع‌تر و مسیرهای مورب‌تر، نسخه‌ی ۶ Burstهای تصادفی چندآیتمی و نسخه‌ی ۷ Cooldown گروه‌های چندتایی را بازسازی می‌کند.
