# استقرار Production

## زیرساخت فعلی

- Provider: ابرآروان؛
- Server: یک ابرک Ubuntu 24.04 با ۸ vCPU، رم ۱۶GB و دیسک ۷۵GB؛
- Public IP: مقدار عملیاتی خارج از Repository؛ در دستورها با `<SERVER_IP>` نمایش داده می‌شود؛
- مسیر برنامه روی سرور: `/opt/bahar-almas`؛
- Branch انتشار: `main`؛
- وضعیت: Web و API روی HTTP عمومی Health Check موفق دارند؛ هر چهار Migration، شامل محدودیت OTP، روی PostgreSQL اعمال شده‌اند و Timer انتشار فعال است.

پس از انتشار Migration سوم، داده‌های آزمایشی/قدیمی کمپین با تأیید مالک به‌صورت تراکنشی پاک و حساب اولیه‌ی ادمین ساخته شد. مشخصات شخصی ادمین در Repository ثبت نمی‌شود.

پس از انتشار Migration چهارم، جدول محدودیت OTP، Healthy بودن Web/API و باقی‌ماندن حساب ادمین با بررسی فقط‌خواندنی تأیید شد.

## اتصال SSH

```bash
ssh -i ~/.ssh/bahar_almas_arvan_ed25519 root@<SERVER_IP>
```

فقط Public Key روی سرور قرار دارد. Private Key باید با Permission برابر `600` روی دستگاه توسعه باقی بماند.

## سرویس‌های Production

`deploy/compose.prod.yml` سرویس‌های زیر را روی یک Docker network خصوصی اجرا می‌کند:

- Caddy روی پورت‌های عمومی ۸۰ و ۴۴۳؛
- Next.js Web روی پورت داخلی ۳۰۰۲؛
- NestJS API روی پورت داخلی ۴۰۰۲؛
- PostgreSQL 17 روی پورت داخلی ۵۴۳۲؛
- سرویس موقت Migration پیش از هر انتشار.

سرویس‌های `api` و `migrate` هر دو از Image مشترک `bahar-almas-api:latest` استفاده می‌کنند. بنابراین Migration همیشه از همان Schema و فایل‌هایی اجرا می‌شود که API تازه با آن‌ها Build شده است؛ سرویس Profileدار `migrate` Image مستقل و Cacheشده ندارد.

Image سرویس API بسته‌ی OpenSSL موردنیاز Prisma را نصب می‌کند. `DATABASE_URL` موجود در Dockerfile فقط برای Generate و Build است و در Runtime با مقدار Secret فایل `.env` سرور جایگزین می‌شود.

Image پایه‌ی Web و API با Build argument به نام `NODE_IMAGE` قابل جایگزینی است. مقدار پیش‌فرض `node:24-bookworm-slim` است؛ روی ابرک ایران باید مقدار آن در `.env` سرور به Mirror در دسترس، مانند `docker.arvancloud.ir/library/node:24-bookworm-slim`، تغییر کند تا `build --pull` به Docker Hub وابسته نباشد. پوشه‌های `prisma` و `src` در Image API به‌صورت صریح و جداگانه کپی می‌شوند تا تغییر Migration مستقل از Cache عمومی Source تشخیص داده شود.

پورت PostgreSQL روی Host منتشر نمی‌شود. داده‌ی آن در Volume دائمی `postgres_data` نگهداری می‌شود.

## انتشار خودکار

Timer سیستم هر ۶۰ ثانیه Branch `main` را بررسی می‌کند. اگر Commit تازه‌ای وجود داشته باشد:

1. Checkout با `fast-forward` به‌روز می‌شود؛
2. Imageهای Web و API Build می‌شوند؛
3. Migrationهای موجود با `prisma migrate deploy` و همان Image تازه‌ی API اجرا می‌شوند؛
4. Containerها به‌روزرسانی می‌شوند؛
5. Health Check آدرس `/api/v1/health` باید موفق شود؛
6. SHA موفق ذخیره می‌شود.

اگر Build یا Migration شکست بخورد، Containerهای فعال پیش از مرحله‌ی جایگزینی متوقف نمی‌شوند. اجرای همزمان Deploy با File Lock محدود شده است.

دستورهای بررسی:

```bash
systemctl status bahar-almas-update.timer
journalctl -u bahar-almas-update.service -n 200 --no-pager
cd /opt/bahar-almas
docker compose --env-file .env -f deploy/compose.prod.yml ps
```

برای اجرای دستی همان چرخه:

```bash
systemctl start bahar-almas-update.service
```

## Environment و Secretها

فایل `/opt/bahar-almas/.env` فقط روی سرور قرار دارد و وارد Git نمی‌شود. نمونه‌ی بدون Secret در `deploy/.env.example` نگهداری می‌شود.

تا زمان اتصال نجوا، `OTP_DELIVERY_MODE=preview` فقط برای QA محدود قابل استفاده است و نباید در انتشار عمومی باقی بماند.

روی IP و HTTP موقت، `AUTH_COOKIE_SECURE=false` برای تست ورود لازم است. این استثنا فقط برای QA است و باید همزمان با فعال‌شدن دامنه و HTTPS به `true` تغییر کند.

## Domain و HTTPS

پیکربندی اولیه‌ی Caddy روی HTTP و IP انجام می‌شود. پس از مشخص‌شدن دامنه:

1. رکورد DNS یا CDN به IP عمومی ابرک متصل می‌شود؛
2. Site address در `deploy/Caddyfile` از `:80` به دامنه تغییر می‌کند؛
3. `CORS_ORIGIN` به Origin نهایی HTTPS تغییر می‌کند؛
4. Caddy گواهی TLS را دریافت می‌کند؛
5. `AUTH_COOKIE_SECURE=true` می‌شود؛
6. ورود، Cookie امن و WebOTP روی دامنه واقعی تست می‌شوند.

تا قبل از HTTPS، آدرس IP فقط برای QA محدود مناسب است و Session Cookie آن عمداً بدون فلگ `Secure` تنظیم می‌شود. انتشار عمومی و ورود واقعی باید روی HTTPS و Cookie امن انجام شوند.

## Backup

Snapshot هفتگی ابرک یک لایه‌ی بازیابی است، اما جای Backup دیتابیس را نمی‌گیرد. پیش از انتشار عمومی باید Backup زمان‌بندی‌شده‌ی PostgreSQL به فضای خارج از همین ابرک، سیاست نگهداری و تست Restore اضافه شود.
