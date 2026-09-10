# معماری بازی کمپین بهار الماس

## نمای کلی

پروژه یک Modular Monolith است. UI و بازی داخل Next.js اجرا می‌شوند، اما هویت، زمان معتبر Session، محاسبه‌ی امتیاز و لیدربورد در NestJS/PostgreSQL قرار دارند.

```text
Client
 ├── Landing UI
 ├── Separate login/register dialog
 ├── Profile + Persian game history + referral code
 ├── Paginated leaderboard + personal rank
 ├── Admin user management
 └── Canvas game
       ↓ REST / JSON + HttpOnly cookie
NestJS
 ├── AuthModule
 ├── GameModule
 ├── ProfileModule
 ├── LeaderboardModule
 └── AdminModule
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
- افکت Crumb و Slash داخل Canvas و توالی «خرچ» سپس «خروچ» با WebP ثابت، CSS animation، فاصله‌ی زمانی ۴۲۰ میلی‌ثانیه و Cooldown سراسری؛ دو WebP هنگام ورود به صفحه Prefetch و Decode می‌شوند، شروع بازی حداکثر تا آماده‌شدن آن‌ها صبر می‌کند و رندر افکت مستقیم و بدون Image Optimizer است؛
- Override هدفمند `prefers-reduced-motion` فقط برای Motion اصلی Countdown و خرچ/خروچ؛ Combo در این حالت ثابت نمایش داده می‌شود و سایر Motionهای غیرضروری کاهش می‌یابند؛
- تشخیص و پیش‌نمایش Combo در Client فقط داخل یک Pointer Gesture و پنجره‌ی ۳۰۰ میلی‌ثانیه‌ای؛ امتیاز نهایی ضریب‌دار دوباره در Server محاسبه می‌شود؛
- پس‌زمینه‌ی چوبی ۱۶KB به‌صورت CSS background رندر می‌شود و HUD نارنجی `#EE9F35` با دورخط تیره کنتراست آن را حفظ می‌کند؛ عدد صفر شروع دقیقاً استایل اعداد ۳، ۲ و ۱ Countdown را دارد؛
- HUD واکنش‌گرا با امتیاز در چپ، Pause در مرکز و تایمر در راست؛
- Pause هم Gameplay و هم ساعت Monotonic Client را متوقف می‌کند و بودجه‌ی تجمعی آن ۳۰ ثانیه است؛
- Result overlay با React Portal مستقیماً زیر `body` رندر می‌شود تا بالاتر از بازی و لیدربورد باشد؛ Dialogهای باز Scroll بدنه و Overscroll موبایل را تا بسته‌شدن کامل قفل می‌کنند؛
- پروفایل به‌صورت Modal مرکزی باز می‌شود و تاریخچه را در صفحه‌های ۵۰تایی از API دریافت می‌کند؛ صفحه‌ی نخست بعد از تشخیص نشست در پس‌زمینه Prefetch و در حافظه Cache می‌شود، درخواست‌های همزمان یکی می‌شوند و Cache پس از ورود، خروج، Claim یا ویرایش نام باطل می‌شود؛
- پنل پروفایل روی موبایل فشرده و محدود به Dynamic Viewport است؛ Input و Text Autosizing نیز برای Safari و WebView کنترل شده‌اند؛
- پنل ادمین فقط برای User دارای نقش `ADMIN` نمایش داده می‌شود و سه Tab سرورمحور برای ادمین‌ها، کاربران عادی و مسدودشده‌ها، همراه جست‌وجو، ویرایش و Ban/Unban ارائه می‌کند؛
- دسترسی API در `src/lib/api.ts` و Same-origin proxy در Development.
- ابزار WebMCP خواندنی `read_bahar_almas_leaderboard` برای Browserهای پشتیبان؛ نبود پشتیبانی WebMCP روی اجرای عادی سایت اثر ندارد.

## Backend

مسیر: `apps/api`

- NestJS 11؛
- ValidationPipe سراسری با whitelist؛
- Cookie Session به‌جای ذخیره‌ی Token در Local Storage؛
- Rate limit اتمیک PostgreSQL برای دو درخواست OTP در دقیقه و قفل یک‌دقیقه‌ای درخواست سوم؛
- Prisma 7 با PostgreSQL adapter؛
- اجبار Timezone هر Connection به UTC برای اعتبارسنجی پایدار زمان بازی؛
- برنامه‌ی Targetها به‌صورت Deterministic از Seed سرور ساخته می‌شود؛
- نتیجه‌ی Client صرفاً Hit telemetry است، نه Score قابل اعتماد؛
- ضریب Combo پس از اعتبارسنجی Hitهای پایه و بر اساس `gestureId` و زمان Hit در سرور اعمال می‌شود؛
- Score نهایی داخل Transaction ثبت می‌شود.
- بازی پیش از ورود با Claim Token تصادفی شروع و Finish می‌شود؛ اتصال نتیجه به User فقط پس از احراز هویت انجام می‌شود؛
- تاریخچه، مجموع امتیاز، پاداش دعوت و رتبه‌ی شخصی از PostgreSQL خوانده می‌شوند؛ Reward دعوت فقط در اولین Claim امتیازدار ساخته می‌شود.
- Guard نقش ادمین مستقل از نمایش دکمه در UI است و همه‌ی مسیرهای مدیریت را سمت سرور محافظت می‌کند؛
- SessionAuthGuard نقش را در هر درخواست از PostgreSQL می‌خواند؛ Register نقش `USER` را صریح می‌نویسد و DTOها هیچ ورودی تغییر نقش ندارند؛
- ورود تازه‌ی حساب ادمین در Production تا وقتی OTP در حالت Preview است، هم در Request و هم Verify مسدود می‌شود؛
- Ban به‌صورت Soft انجام می‌شود: Sessionها باطل، ورود و لیدربورد مسدود و داده‌های حساب/بازی حفظ می‌شوند.

## چرخه‌ی Game Session

1. کاربر مهمان درخواست شروع می‌دهد.
2. API یک Seed، انقضای ۶۰ ثانیه‌ای و Claim Token با مهلت ۲۴ ساعت می‌سازد.
3. Schedule کامل و Token خام فقط به Client برگردانده می‌شوند؛ Database فقط Hash Token را دارد.
4. Client Targetهای فعال را رسم و Hit telemetry را جمع می‌کند.
5. Finish با Claim Token انجام و Score معتبر سرور روی GameSession بدون User ثبت می‌شود.
6. نتیجه و Token تا زمان ورود در Browser نگهداری می‌شوند.
7. کاربر وارد حساب قبلی می‌شود یا حساب تازه و کد معرف یکتا می‌سازد.
8. Claim احراز هویت‌شده GameSession را فقط یک‌بار به User وصل می‌کند.
9. تاریخچه، مجموع امتیاز، High Score و Rank به‌روزرسانی می‌شوند.

## Performance Budget

- مجموع تصاویر بهینه‌شده‌ی فعلی حدود ۳۵۰KB؛
- پس‌زمینه‌ی چوبی حدود ۱۶KB، صدای برش حدود ۲۸KB، صدای شروع حدود ۴۲KB و موزیک یک‌دقیقه‌ای حدود ۹۵۴KB؛
- حداکثر DPR برابر ۲؛
- بدون GIF یا Video دائماً در حال Decode؛ Motion خرچ/خروچ با دو تصویر ثابت و CSS انجام می‌شود؛
- Assetهای ثابت Browser Cache یک‌روزه و `stale-while-revalidate` هفت‌روزه دارند تا اتصال‌های موبایل با تأخیر بالا فایل Gameplay را در هر نمایش دوباره نگیرند؛
- بدون DOM node برای هر Target/Particle؛
- Schedule یک‌دقیقه‌ای حدود ۷۰ Target دارد و payload کوچک می‌ماند؛
- زمان پرواز و فاصله‌ی Spawn به‌تدریج کاهش پیدا می‌کنند تا سختی بازی پیوسته بیشتر شود.
- Spawnهای نسخه‌ی ۷ علاوه بر آیتم تکی، گاهی Burstهای ۲ تا ۴ آیتمی با فاصله‌ی ۵۵ تا ۱۲۰ میلی‌ثانیه تولید می‌کنند؛ پس از Burst سه/چهارتایی دو Anchor و پس از Burst دوتایی یک Anchor فقط تکی است.

## توسعه‌ی فازهای بعد

`GameTarget.kind` اکنون سه نوع `POTATO`، `CHICKEN` و `SAMBOOSE` دارد و تابع تولید Schedule محل توسعه برای Bomb، Bonus و آیتم‌های تازه است. Combo امتیازی پس از اعتبارسنجی Hitهای پایه در سرور محاسبه می‌شود. فیلد `validationVersion` سازگاری را نگه می‌دارد: نسخه‌ی ۱ Schedule دوآیتمی، نسخه‌ی ۲ افزودن سمبوسه، نسخه‌ی ۳ فیزیک آهسته‌ی میانی، نسخه‌ی ۴ بازی ۶۰ ثانیه‌ای با سختی افزایشی، نسخه‌ی ۵ شروع سریع‌تر و مسیرهای مورب‌تر، نسخه‌ی ۶ Burstهای تصادفی چندآیتمی و نسخه‌ی ۷ Cooldown گروه‌های چندتایی را بازسازی می‌کند.
