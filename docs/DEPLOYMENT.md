# استقرار Production

## زیرساخت فعلی

- Provider: ابرآروان؛
- Server: یک ابرک Ubuntu 24.04 با ۸ vCPU، رم ۱۶GB و دیسک ۷۵GB؛
- Public IP: `95.38.187.27`؛
- مسیر برنامه روی سرور: `/opt/bahar-almas`؛
- Branch انتشار: `main`.

## اتصال SSH

```bash
ssh -i ~/.ssh/bahar_almas_arvan_ed25519 root@95.38.187.27
```

فقط Public Key روی سرور قرار دارد. Private Key باید با Permission برابر `600` روی دستگاه توسعه باقی بماند.

## سرویس‌های Production

`deploy/compose.prod.yml` سرویس‌های زیر را روی یک Docker network خصوصی اجرا می‌کند:

- Caddy روی پورت‌های عمومی ۸۰ و ۴۴۳؛
- Next.js Web روی پورت داخلی ۳۰۰۲؛
- NestJS API روی پورت داخلی ۴۰۰۲؛
- PostgreSQL 17 روی پورت داخلی ۵۴۳۲؛
- سرویس موقت Migration پیش از هر انتشار.

پورت PostgreSQL روی Host منتشر نمی‌شود. داده‌ی آن در Volume دائمی `postgres_data` نگهداری می‌شود.

## انتشار خودکار

Timer سیستم هر ۶۰ ثانیه Branch `main` را بررسی می‌کند. اگر Commit تازه‌ای وجود داشته باشد:

1. Checkout با `fast-forward` به‌روز می‌شود؛
2. Imageهای Web و API Build می‌شوند؛
3. Migrationهای موجود با `prisma migrate deploy` اجرا می‌شوند؛
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

## Domain و HTTPS

پیکربندی اولیه‌ی Caddy روی HTTP و IP انجام می‌شود. پس از مشخص‌شدن دامنه:

1. رکورد DNS یا CDN به `95.38.187.27` متصل می‌شود؛
2. Site address در `deploy/Caddyfile` از `:80` به دامنه تغییر می‌کند؛
3. `CORS_ORIGIN` به Origin نهایی HTTPS تغییر می‌کند؛
4. Caddy گواهی TLS را دریافت می‌کند؛
5. ورود، Cookie امن و WebOTP روی دامنه واقعی تست می‌شوند.

## Backup

Snapshot هفتگی ابرک یک لایه‌ی بازیابی است، اما جای Backup دیتابیس را نمی‌گیرد. پیش از انتشار عمومی باید Backup زمان‌بندی‌شده‌ی PostgreSQL به فضای خارج از همین ابرک، سیاست نگهداری و تست Restore اضافه شود.
