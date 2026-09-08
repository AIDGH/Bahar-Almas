# بازی کمپین بهار الماس — Project Context

> این فایل مرجع اصلی وضعیت پروژه و handoff است. بعد از هر تغییر، بخش‌های مرتبط این فایل و مستندات تخصصی داخل `docs/` باید به‌روزرسانی شوند. کامنت‌های داخل کد فقط انگلیسی نوشته می‌شوند.

آخرین به‌روزرسانی محتوایی: ۲۰۲۶-۰۹-۰۸

---

## ۱. هدف محصول

یک Landing Page فارسی و Responsive برای کمپین بهار الماس که کاربر بتواند:

1. پیش از ورود، یک بازی یک‌دقیقه‌ای شبیه Fruit Ninja انجام دهد؛
2. پس از پایان برای ثبت رکورد، جداگانه وارد شود یا حساب تازه بسازد؛
3. نتیجه‌ی معتبر را حتی پس از خطای ورود روی همان دستگاه نگه دارد؛
4. پروفایل، تاریخچه‌ی شمسی بازی‌ها، بهترین و مجموع امتیاز خود را ببیند؛
5. لینک دعوت UTM یکتا داشته باشد و از ثبت‌نام با کد خود امتیاز بگیرد؛
6. ده نفر اول، رتبه‌ی شخصی و ادامه‌ی کل لیدربورد را ببیند.

## ۲. وضعیت فعلی

وضعیت: **Core Gameplay MVP پیاده‌سازی شده، Build/Test محلی را گذرانده و نسخه‌ی Production آن روی ابرک ابرآروان با HTTP موقت فعال است**.

موارد موجود:

- Monorepo با pnpm؛
- Frontend با Next.js 16، React 19 و TypeScript؛
- Backend با NestJS 11 و REST API؛
- PostgreSQL و Prisma 7؛
- ورود و ثبت‌نام مجزای شماره موبایل با OTP؛
- شروع عمومی بازی بدون اجبار ورود و ثبت رکورد معتبر پس از احراز هویت؛
- نگهداری رکورد ثبت‌نشده و Token اختصاصی Claim تا ۲۴ ساعت روی همان Browser؛
- نمایش کد OTP در حالت `preview` تا زمان اتصال سرویس پیامک؛
- Session مبتنی بر Cookie از نوع HttpOnly؛
- تنظیم صریح `AUTH_COOKIE_SECURE` برای حفظ Cookie امن روی HTTPS و امکان QA موقت روی IP و HTTP؛
- بازی Canvas با Swipe/Pointer، حرکت بالستیک پیوسته و مورب، تایمر ۱ دقیقه‌ای، Score، صدا، افکت برش، نیمه‌شدن سیب‌زمینی/شنیسل/سمبوسه و Crumb Particle؛
- HUD موبایل‌محور با لوگوی محصول کنار امتیاز، اعداد کارتونی نارنجی `#EE9F35` (کمی تیره‌تر و اشباع‌تر از مرجع `#F2B049`)، تایمر سمت راست و کنترل Pause/پایان زودهنگام؛
- Pause واقعی بازی و تایمر با بودجه‌ی تجمعی حداکثر ۳۰ ثانیه؛
- سرعت اولیه‌ی بالاتر و افزایش تدریجی سرعت Targetها و تراکم Spawn در طول بازی؛
- غالب‌بودن مسیرهای مورب با جابه‌جایی و زاویه‌ی افقی بیشتر، بدون خروج زودهنگام از مرزهای بازی؛
- باقی‌ماندن دو نیمه‌ی خوراکی پس از برش تا خروج کامل از پایین کادر؛
- نمایش ترتیبی و دورتراز Targetِ «خرچ» و «خروچ» با WebPهای ثابت قبلی، انیمیشن نرم CSS، Cooldown مشترک ۹۰۰ میلی‌ثانیه‌ای و تأخیر ۴۲۰ میلی‌ثانیه‌ای بین دو نوشته؛
- Combo برای برش حداقل ۳ Target در یک Pointer Gesture و پنجره‌ی ۳۰۰ میلی‌ثانیه‌ای، با ضریب معتبر ۱.۵ برای سه‌تایی، ۲ برای چهارتایی و ادامه‌ی خطی `n/2`؛
- نمایش اعداد Score و Timer با رقم‌های انگلیسی؛
- شمارش معکوس سه‌ثانیه‌ای مستقل پیش از شروع Gameplay همراه صدای جلزولز و Crunch اختصاصی؛ عدد صفر دقیقاً استایل اعداد ۳، ۲ و ۱ را به ارث می‌برد؛
- استثنای کنترل‌شده برای اجرای Motion اصلی Countdown و خرچ/خروچ حتی در دستگاه‌هایی که `prefers-reduced-motion` فعال دارند، چون این دو بازخورد بخشی از Gameplay هستند؛ Combo ثابت و سایر Motionهای غیرضروری همچنان کاهش می‌یابند؛
- پخش موزیک `Ready, Set, Slice!` همزمان با صفر، توقف همراه Pause و Fade تدریجی از ثانیه‌ی ۵۱ تا پایان نسخه‌ی ۶۱ ثانیه‌ای بهینه‌شده؛
- Spawn تصادفی Burstهای ۲، ۳ و ۴ آیتمی برای ایجاد موقعیت واقعی Combo، با فاصله‌ی بازیابی اجباری بعد از گروه‌های بزرگ؛
- استفاده از Assetهای واقعی بهار الماس، پس‌زمینه‌ی چوبی زمین بازی و نسخه‌های WebP بهینه‌شده؛
- کارت نتیجه‌ی موبایل‌محور که با لمس فضای بیرون بسته می‌شود؛
- ثبت نتیجه فقط پس از اعتبارسنجی سمت سرور؛
- پروفایل قابل ویرایش با شماره، نام تکرارپذیر، چهار آمار امتیاز و تاریخچه‌ی شمسی بازی‌ها؛
- کد و لینک UTM دعوت یکتا با پاداش ۱٬۰۰۰ امتیازی فوری برای معرف هنگام ثبت‌نام موفق؛
- ذخیره‌ی بهترین امتیاز، مجموع امتیاز بازی، امتیاز دعوت و امتیاز کل؛
- لیدربورد High Score با ده رکورد نخست، بارگذاری ادامه‌ی کل جدول و ردیف متمایز رتبه‌ی شخصی؛
- تست واحد برای برنامه‌ی تولید آیتم و اعتبارسنجی Hit؛
- طرح اولیه‌ی PostgreSQL Migration؛
- رابط RTL و Mobile-first.
- WebMCP خواندنی برای دریافت ده رکورد برتر در Browserهای پشتیبان.
- README کوتاه انگلیسی شامل معرفی محصول و فهرست زبان‌ها و فناوری‌های اصلی، بدون جزئیات راه‌اندازی یا عملیات.
- پیکربندی Production مبتنی بر Docker Compose برای Next.js، NestJS، PostgreSQL و Caddy؛
- Image تولید API شامل OpenSSL موردنیاز Prisma و یک URL غیرواقعی فقط برای مرحله‌ی Generate/Build است؛ `DATABASE_URL` واقعی در Runtime از Environment سرور جایگزین می‌شود؛
- Image پایه‌ی Node در Build تولید با `NODE_IMAGE` قابل جایگزینی است تا سرور ایران بدون وابستگی مستقیم به Docker Hub از Registry در دسترس استفاده کند؛ Prisma و Migrationها نیز در لایه‌ی صریح و مستقل Image کپی می‌شوند تا Cache مانع ورود Migration تازه نشود؛
- چرخه‌ی انتشار خودکار Server-side که Branch `main` را هر ۶۰ ثانیه بررسی و فقط پس از Build، Migration و Health Check موفق ثبت می‌کند؛ سرویس Migration دقیقاً از همان Image تازه‌ی API استفاده می‌کند؛

اعتبارسنجی انجام‌شده:

- TypeScript برای Web و API بدون خطا؛
- Lint بدون Error یا Warning؛
- Build Production موفق برای NestJS و Next.js؛
- ۱۳ تست واحد موفق برای Schedule نسخه‌بندی‌شده، Burst و فاصله‌ی بازیابی، سرعت/زاویه‌ی پرتاب، Combo scoring، افزایش سختی، Hit validation و تنظیم امن Cookie؛
- تست واقعی OTP → Session → Game start → Server-validated finish → Leaderboard روی PostgreSQL محلی؛
- تست یکپارچه‌ی محلی بازی مهمان → Finish معتبر → ثبت‌نام → Claim → تاریخچه پروفایل؛
- تست یکپارچه‌ی ورود مستقل، نام نمایشی تکراری، پاداش ۱٬۰۰۰ امتیازی معرف، دو صفحه لیدربورد و رتبه‌ی شخصی؛
- حذف کامل داده‌ی آزمایشی پس از پایان تست.

## ۳. معماری

```text
Browser / Mobile
      ↓ HTTP/HTTPS
Caddy reverse proxy
      ├── Next.js Web (Canvas game + campaign UI)
      └── /api/v1 → NestJS REST API
                         ↓
                     Prisma ORM
                         ↓
                    PostgreSQL
```

ساختار Repository:

```text
Bahar-Almas/
├── apps/
│   ├── web/
│   └── api/
├── docs/
├── deploy/
├── PROJECT_CONTEXT.md
├── docker-compose.yml
├── package.json
└── pnpm-workspace.yaml
```

جزئیات: `docs/ARCHITECTURE.md`

## ۴. تصمیم فنی

پشته‌ی Next.js + NestJS + PostgreSQL برای این پروژه مناسب است، چون:

- بازی، تعامل لمسی و Landing Page در React/Next.js سریع و قابل نگهداری‌اند؛
- پایان Session و امتیاز باید در Backend مستقل و قابل اعتماد کنترل شود؛
- PostgreSQL برای حساب‌ها، Sessionها، رخدادهای معتبر و رتبه‌بندی پایدار مناسب است؛
- ساختار با نمونه‌ی `Hotel-Yab` هم‌راستاست و دانش Deployment و الگوهای Auth آن قابل استفاده است؛
- Modular Monolith برای این مقیاس کافی است و Microservice، Redis یا WebSocket در فاز اول لازم نیست.

جزئیات تصمیم‌ها: `docs/DECISIONS.md`

## ۵. جریان‌های اصلی

### ورود

```text
انتخاب ورود یا ثبت‌نام → شماره (+ نام و کد معرف برای ثبت‌نام) → OTP → HttpOnly Session Cookie
```

ثبت‌نام برای شماره‌ی موجود و ورود برای شماره‌ی ثبت‌نشده رد می‌شود. نام نمایشی یکتا نیست و از پروفایل قابل تغییر است. کد معرف اختیاری فقط هنگام ثبت‌نام مصرف می‌شود.

### بازی

```text
Public start request
  → Server seed + 60s expiry
  → One-time claim token with 24h window
  → Deterministic target schedule
  → Canvas gameplay + collected hit telemetry
  → Finish request at timeout or explicit early end
  → Server regenerates schedule and validates hits
  → Server-calculated score
  → Local pending result
  → Login/Register
  → Authenticated claim
  → History + personal best + total score + leaderboard rank
```

## ۶. کنترل Fraud فعلی

- زمان شروع و پایان Session در سرور ثبت می‌شود؛
- پایان عادی فقط پس از بازه‌ی یک‌دقیقه‌ای پذیرفته می‌شود؛ Pause کل زمان فعال Gameplay را حداکثر ۳۰ ثانیه افزایش می‌دهد و Grace Window ثبت نتیجه را پوشش می‌دهد؛
- پایان دستی با فلگ صریح مجاز است و Hitهای بعد از زمان سپری‌شده‌ی سرور حذف می‌شوند؛
- Connectionهای Runtime دیتابیس به UTC محدود می‌شوند تا مقایسه‌ی زمان Session مستقل از Timezone سرور باشد؛
- هر Target شناسه‌ی یکتا دارد و فقط یک‌بار امتیاز می‌گیرد؛
- Targetهای جعلی یا Hit خارج از بازه‌ی حضور آیتم رد می‌شوند؛
- فاصله و زمان Swipe باید در بازه‌ی فیزیکی قابل قبول باشد؛
- Burst غیرممکن Hit محدود می‌شود؛
- امتیاز ارسال‌شده از Client پذیرفته نمی‌شود و سرور آن را محاسبه می‌کند؛
- شناسه‌ی Gesture و زمان Hit فقط برای تشخیص خوشه‌ی Combo استفاده می‌شوند و ضریب Combo پس از اعتبارسنجی Hitهای پایه در سرور اعمال می‌شود؛
- Claim هر بازی با Token تصادفی Hash‌شده محافظت می‌شود و فقط یک حساب می‌تواند آن را ثبت کند؛
- مهلت اتصال نتیجه‌ی مهمان به حساب ۲۴ ساعت است؛
- زمان ثبت نتیجه پس از پایان بازی Grace Window محدود دارد.

جزئیات و پیشنهادهای فاز بعد: `docs/SECURITY.md`

## ۷. Assetها

فایل‌های اصلی در پوشه‌ی بیرونی `Ninja Frut Asset` دست‌نخورده‌اند. نسخه‌های crop و فشرده‌ی WebP در `apps/web/public/assets/` قرار دارند و مجموع Assetهای تصویری اصلی بازی کمتر از ۴۰۰KB است.

در نسخه‌ی فعلی از لوگو، بطری، سیب‌زمینی کامل/نیمه، فیله کامل/نیمه، سمبوسه کامل/نیمه، پس‌زمینه‌ی `background.png`، WebPهای ثابت `kherech.webp` و `khoroch.webp` با Motion سبک CSS، صدای برش، صدای سه‌ثانیه‌ای شروع و موزیک Gameplay استفاده می‌شود. هر ۹ تصویر خوراکی مستقیماً از فایل صحیح `Kamel`، `Chap` و `Rast` بازتولید شده تا جهت و مقیاس نیمه‌ها با نسخه‌ی کامل هماهنگ باشد. فایل‌های Scale2 ارزیابی شده‌اند اما در Runtime فعلی استفاده نمی‌شوند. جزئیات سایزها و Assetهای نهایی مورد نیاز: `docs/ASSETS.md`.

## ۸. API و داده

Endpointهای اصلی:

- `POST /api/v1/auth/otp/request`
- `POST /api/v1/auth/otp/verify`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `POST /api/v1/games/start`
- `POST /api/v1/games/:id/finish`
- `POST /api/v1/games/:id/claim`
- `GET /api/v1/profile`
- `PATCH /api/v1/profile`
- `GET /api/v1/leaderboard`

جزئیات: `docs/API.md` و `docs/DATABASE.md`.

## ۹. اجرای محلی

```bash
cp apps/api/.env.example apps/api/.env
docker compose up -d postgres
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Web روی پورت ۳۰۰۲ و API روی پورت ۴۰۰۲ اجرا می‌شود. درخواست‌های `/api/v1` در محیط توسعه از طریق Next.js به API پراکسی می‌شوند و Preview از Hostهای محلی `localhost` و `127.0.0.1` و IP فعلی شبکه‌ی توسعه `10.215.216.104` مجاز است؛ این IP با تغییر شبکه ممکن است عوض شود.

## ۱۰. موارد باز قبل از انتشار عمومی

- اتصال Provider واقعی SMS و حذف `developmentCode` از پاسخ Production؛
- تست بازی روی چند دستگاه واقعی iOS و Android؛
- Load Test روی Endpoint پایان بازی و لیدربورد؛
- تعریف سیاست نهایی شرکت‌کننده، جایزه، تعداد دفعات مجاز و بازه‌ی کمپین؛
- افزودن IP/device risk signal و Rate Limit اشتراکی در صورت چند-instance شدن API؛
- تعریف Rate Limit عمومی برای شروع بازی مهمان؛
- تصمیم نهایی درباره‌ی تعلق فوری پاداش دعوت یا مشروط‌کردن آن به اولین بازی فرد دعوت‌شده؛
- پایش خطا و داشبورد رفتارهای مشکوک؛
- اتصال Domain و فعال‌سازی HTTPS در Caddy؛
- بازگرداندن `AUTH_COOKIE_SECURE=true` همزمان با فعال‌شدن HTTPS؛
- Backup خارج از ابرک برای PostgreSQL و تست Restore؛
- تصمیم درباره‌ی نگهداری/حذف داده‌های موبایل پس از پایان کمپین.
- بررسی Contract ابزار WebMCP در Browser دارای `document.modelContext`؛ محیط Preview فعلی امکان این اعتبارسنجی را اعلام نکرد.

فهرست پیگیری: `docs/TODO.md`

## ۱۱. استقرار

ابرک Production ابرآروان با Ubuntu 24.04 فعال است. نسخه‌ی `d106cc2` با Migration موفق و Health Check عمومی Web و API روی HTTP مستقر شد. برنامه در `/opt/bahar-almas` اجرا می‌شود، PostgreSQL فقط داخل Docker network قابل دسترسی است و Timer فعال Commitهای جدید `main` را هر ۶۰ ثانیه بررسی می‌کند. IP واقعی در مستندات عمومی Repository نگهداری نمی‌شود. جزئیات اتصال SSH، Containerها، انتشار خودکار، Environment، Domain و Backup در `docs/DEPLOYMENT.md` ثبت شده است.
