# بازی کمپین بهار الماس

یک بازی لندینگ موبایل‌محور برای کمپین بهار الماس، با Gameplay الهام‌گرفته از Fruit Ninja. کاربر با شماره موبایل و OTP وارد می‌شود، سیب‌زمینی، شنیسل و سمبوسه‌های پرتاب‌شده را با Swipe برش می‌دهد و رکورد معتبرش در لیدربورد ثبت می‌شود.

> این پروژه در مرحله‌ی Core Gameplay MVP است. کد OTP فعلاً برای تست داخل رابط نمایش داده می‌شود و پیش از انتشار عمومی باید سرویس پیامک واقعی جایگزین آن شود.

## امکانات فعلی

- ثبت‌نام و ورود با شماره موبایل، OTP و Session Cookie امن؛
- بازی یک‌دقیقه‌ای Responsive برای موبایل، تبلت و دسکتاپ؛
- Swipe با Touch، قلم و Mouse، افکت برش، Crumb، صدا و موسیقی؛
- شمارش معکوس شروع، Pause محدود و پایان زودهنگام؛
- Burstهای تصادفی، افزایش تدریجی سختی و Combo امتیازی؛
- محاسبه و اعتبارسنجی Score در سرور برای کاهش تقلب ساده؛
- ذخیره‌ی بهترین امتیاز و نمایش لیدربورد؛
- استفاده از Assetهای واقعی کمپین و نسخه‌های بهینه‌شده برای Mobile.

## تکنولوژی‌ها

| بخش | تکنولوژی |
| --- | --- |
| Frontend و بازی | Next.js 16، React 19، TypeScript و Canvas API |
| Backend | NestJS 11 و REST API |
| Database | PostgreSQL 17، Prisma 7 |
| مدیریت پروژه | pnpm workspace |

پروژه به‌صورت Modular Monolith نگهداری می‌شود: رابط و Game loop در Next.js اجرا می‌شوند، اما هویت کاربر، Session بازی، امتیاز معتبر و لیدربورد در NestJS و PostgreSQL قرار دارند.

## پیش‌نیازها

- Node.js 24؛
- pnpm 11؛
- Docker Desktop برای راه‌اندازی ساده‌ی PostgreSQL، یا یک PostgreSQL سازگار؛
- مرورگر مدرن با پشتیبانی از Canvas و Pointer Events.

برای بررسی نسخه‌ها:

```bash
node --version
pnpm --version
docker --version
```

## راه‌اندازی سریع

دستورهای زیر را از ریشه‌ی پروژه اجرا کنید:

```bash
cp apps/api/.env.example apps/api/.env
docker compose up -d postgres
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
```

`pnpm dev` هر دو برنامه‌ی Web و API را همزمان اجرا می‌کند. پس از آماده‌شدن سرویس‌ها:

- سایت: [http://localhost:3002](http://localhost:3002)
- بازی: [http://localhost:3002/#game](http://localhost:3002/#game)
- API: [http://localhost:4002/api/v1](http://localhost:4002/api/v1)
- Health Check: [http://localhost:4002/api/v1/health](http://localhost:4002/api/v1/health)

در حالت `OTP_DELIVERY_MODE=preview`، کد ورود داخل پنجره‌ی ورود نمایش داده می‌شود.

## اجرای Web و API به‌صورت جداگانه

برای عیب‌یابی یا توسعه می‌توان هر برنامه را در ترمینال جدا اجرا کرد.

ترمینال API:

```bash
pnpm --filter @bahar-almas/api dev
```

ترمینال Web:

```bash
pnpm --filter @bahar-almas/web dev
```

Web درخواست‌های `/api/v1/*` را در محیط توسعه به API روی پورت `4002` منتقل می‌کند. بنابراین برای کارکرد ورود، بازی و لیدربورد باید PostgreSQL و API هر دو فعال باشند.

## بازکردن سایت روی گوشی در شبکه‌ی مشترک

کامپیوتر و گوشی باید به یک Wi-Fi وصل باشند. در macOS آدرس IP شبکه را پیدا کنید:

```bash
ipconfig getifaddr en0
```

سپس به‌جای `YOUR_IP` خروجی همان دستور را قرار دهید:

```text
http://YOUR_IP:3002/#game
```

برای نمونه، اگر IP کامپیوتر `192.168.1.25` باشد، آدرس گوشی می‌شود:

```text
http://192.168.1.25:3002/#game
```

اگر Next.js درخواست IP تازه را در حالت Development نپذیرفت، آن IP را به `allowedDevOrigins` در `apps/web/next.config.ts` اضافه و Web را دوباره اجرا کنید. Firewall سیستم نیز باید اجازه‌ی دسترسی ورودی به Node.js را بدهد.

## تنظیمات محیطی API

تنظیمات توسعه در `apps/api/.env` قرار می‌گیرند و نمونه‌ی کامل آن در `apps/api/.env.example` موجود است.

| متغیر | کاربرد | مقدار توسعه‌ی فعلی |
| --- | --- | --- |
| `PORT` | پورت API | `4002` |
| `CORS_ORIGIN` | Origin مجاز Web | `http://localhost:3002` |
| `DATABASE_URL` | اتصال PostgreSQL | Database محلی روی پورت `5433` |
| `AUTH_OTP_SECRET` | Secret امضای OTP | حداقل ۳۲ کاراکتر |
| `AUTH_OTP_TTL_MINUTES` | اعتبار OTP | `5` دقیقه |
| `AUTH_OTP_RESEND_SECONDS` | فاصله‌ی ارسال مجدد | `60` ثانیه |
| `AUTH_SESSION_DAYS` | اعتبار Session کاربر | `7` روز |
| `OTP_DELIVERY_MODE` | نمایش OTP آزمایشی | `preview` |

Secretهای Production نباید داخل Git قرار بگیرند. برای انتشار واقعی، `OTP_DELIVERY_MODE=preview` نیز نباید فعال بماند.

## دستورهای کاربردی

```bash
# Build کامل Web و API
pnpm build

# بررسی TypeScript
pnpm typecheck

# اجرای تست‌های API و منطق بازی
pnpm test

# بررسی کیفیت کد
pnpm lint

# تولید Prisma Client
pnpm db:generate

# ساخت یا اعمال Migration در محیط توسعه
pnpm db:migrate

# اعمال Migrationهای موجود در محیط استقرار
pnpm db:deploy
```

## ساختار پروژه

```text
Bahar-Almas/
├── apps/
│   ├── web/                 # Next.js UI، Canvas game و Assetهای Runtime
│   └── api/                 # NestJS API، Prisma schema و Migrationها
├── docs/                    # معماری، API، امنیت، Database و فهرست Assetها
├── docker-compose.yml       # PostgreSQL محلی روی پورت 5433
├── PROJECT_CONTEXT.md       # وضعیت جاری و مرجع Handoff پروژه
├── pnpm-workspace.yaml
└── package.json
```

## عیب‌یابی سریع

### پیام «ارتباط با سرور برقرار نشد»

ابتدا مطمئن شوید PostgreSQL و API فعال‌اند:

```bash
docker compose ps
curl http://localhost:4002/api/v1/health
```

اگر Health Check پاسخ نمی‌دهد، خروجی ترمینال API و مقدار `DATABASE_URL` در `apps/api/.env` را بررسی کنید. اجرای فقط `pnpm --filter @bahar-almas/web dev`، API یا Database را بالا نمی‌آورد.

### اشغال‌بودن پورت

پورت‌های پیش‌فرض پروژه عبارت‌اند از:

- `3002` برای Web؛
- `4002` برای API؛
- `5433` برای PostgreSQL محلی.

اگر سرویس دیگری یکی از این پورت‌ها را گرفته است، آن سرویس را متوقف کنید یا پورت را به‌صورت هماهنگ در Scriptها، Environment و تنظیمات Proxy تغییر دهید.

### تغییرات جدید روی گوشی دیده نمی‌شوند

صفحه را Hard Refresh کنید یا Tab مرورگر را کامل ببندید و دوباره باز کنید. بعضی مرورگرهای موبایل Assetهای CSS و تصویر را تهاجمی Cache می‌کنند.

## امنیت و محدودیت MVP

Client عدد Score نهایی را تعیین نمی‌کند. سرور برنامه‌ی Targetها را از Seed بازسازی کرده، Hitها و زمان Swipe را اعتبارسنجی می‌کند و سپس امتیاز و Combo را محاسبه می‌کند. این طراحی جلوی دست‌کاری ساده‌ی Score را می‌گیرد، اما هیچ بازی Browser-based کاملاً ضد Bot نیست.

پیش از کمپین جایزه‌دار باید حداقل SMS واقعی، Rate Limit لبه‌ی شبکه، محدودیت روزانه، مانیتورینگ و بررسی دستی رکوردهای برتر اضافه شوند. جزئیات در `docs/SECURITY.md` و `docs/TODO.md` ثبت شده است.

## مستندات بیشتر

- `PROJECT_CONTEXT.md`: وضعیت فعلی، تصمیم‌های کلیدی و Handoff؛
- `docs/ARCHITECTURE.md`: معماری Frontend و Backend؛
- `docs/API.md`: Endpointها و قرارداد API؛
- `docs/DATABASE.md`: مدل داده و Migrationها؛
- `docs/SECURITY.md`: اعتبارسنجی امتیاز و کنترل تقلب؛
- `docs/ASSETS.md`: Assetهای استفاده‌شده و خروجی‌های مورد نیاز؛
- `docs/DECISIONS.md`: دلیل تصمیم‌های فنی؛
- `docs/TODO.md`: کارهای باقی‌مانده تا QA و انتشار؛
- `docs/CHANGELOG.md`: تاریخچه‌ی تغییرات.
