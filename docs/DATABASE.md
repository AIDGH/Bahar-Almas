# مدل داده

Database اصلی PostgreSQL و لایه‌ی دسترسی Prisma است.

تمام ستون‌های زمانی حساس با `TIMESTAMPTZ` ذخیره می‌شوند و Prisma adapter هر Connection را با Timezone برابر UTC باز می‌کند. این تنظیم برای مقایسه‌ی دقیق پایان یک‌دقیقه‌ای بازی روی سرورهایی با Timezone محلی ضروری است.

## User

- شماره موبایل یکتا؛
- نام نمایشی؛
- بهترین امتیاز و زمان ثبت آن؛
- ارتباط با Sessionها و Game Sessionها.

## OtpChallenge

- کد خام ذخیره نمی‌شود؛ `codeHash` با HMAC-SHA256 ذخیره می‌شود؛
- دارای انقضا، شمارنده‌ی تلاش و زمان مصرف است؛
- برای حساب تازه نام نمایشی موقتاً روی Challenge نگهداری می‌شود.

## UserSession

- Token خام فقط در Cookie کاربر است؛
- Database فقط SHA-256 Token را نگه می‌دارد؛
- زمان انقضا، User Agent و IP برای کنترل و بررسی ثبت می‌شوند.

## GameSession

- Seed و بازه‌ی معتبر بازی؛
- وضعیت `ACTIVE`، `COMPLETED`، `EXPIRED` یا `INVALIDATED`؛
- امتیاز محاسبه‌شده‌ی سرور؛
- نسخه‌ی قوانین اعتبارسنجی.

## GameHit

- شناسه‌ی Target در هر Session یکتا است؛
- زمان نسبی Hit و Distance/Duration حرکت؛
- فقط Hitهای پذیرفته‌شده ذخیره می‌شوند؛
- ستون `points` امتیاز نهایی همان Hit پس از اعمال ضریب Combo معتبر سرور را نگه می‌دارد؛ `gestureId` فقط هنگام Finish پردازش می‌شود و در نسخه‌ی فعلی ذخیره نمی‌شود.

Migration اولیه در `apps/api/prisma/migrations/20260904000000_init/migration.sql` قرار دارد.
