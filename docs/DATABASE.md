# مدل داده

Database اصلی PostgreSQL و لایه‌ی دسترسی Prisma است.

تمام ستون‌های زمانی حساس با `TIMESTAMPTZ` ذخیره می‌شوند و Prisma adapter هر Connection را با Timezone برابر UTC باز می‌کند. این تنظیم برای مقایسه‌ی دقیق پایان یک‌دقیقه‌ای بازی روی سرورهایی با Timezone محلی ضروری است.

## User

- شماره موبایل یکتا؛
- نام نمایشی؛
- کد معرف یکتا و معرف اختیاری؛
- بهترین امتیاز و زمان ثبت آن؛
- مجموع امتیاز بازی‌ها و امتیازهای دعوت؛
- ارتباط با Sessionها و Game Sessionها.

## OtpChallenge

- کد خام ذخیره نمی‌شود؛ `codeHash` با HMAC-SHA256 ذخیره می‌شود؛
- دارای انقضا، شمارنده‌ی تلاش و زمان مصرف است؛
- برای حساب تازه نام نمایشی موقتاً روی Challenge نگهداری می‌شود.
- نوع Challenge ورود/ثبت‌نام و شناسه‌ی معرف تا Verify نگهداری می‌شود.

## UserSession

- Token خام فقط در Cookie کاربر است؛
- Database فقط SHA-256 Token را نگه می‌دارد؛
- زمان انقضا، User Agent و IP برای کنترل و بررسی ثبت می‌شوند.

## GameSession

- Seed و بازه‌ی معتبر بازی؛
- وضعیت `ACTIVE`، `COMPLETED`، `EXPIRED` یا `INVALIDATED`؛
- امتیاز محاسبه‌شده‌ی سرور؛
- نسخه‌ی قوانین اعتبارسنجی.
- `userId` تا زمان Claim می‌تواند خالی باشد؛
- Hash توکن Claim و مهلت ۲۴ ساعته‌ی اتصال رکورد به حساب.

## ReferralReward

- هر User دعوت‌شده فقط یک Reward می‌تواند ایجاد کند؛
- معرف، کاربر دعوت‌شده، مقدار ۱٬۰۰۰ امتیاز و زمان ثبت برای Audit نگهداری می‌شوند؛
- افزایش `referralPoints` معرف و ساخت Reward داخل یک Transaction انجام می‌شود.

## GameHit

- شناسه‌ی Target در هر Session یکتا است؛
- زمان نسبی Hit و Distance/Duration حرکت؛
- فقط Hitهای پذیرفته‌شده ذخیره می‌شوند؛
- ستون `points` امتیاز نهایی همان Hit پس از اعمال ضریب Combo معتبر سرور را نگه می‌دارد؛ `gestureId` فقط هنگام Finish پردازش می‌شود و در نسخه‌ی فعلی ذخیره نمی‌شود.

Migration اولیه در `20260904000000_init` و Migration بازی مهمان، پروفایل و دعوت در `20260908000000_guest_games_profiles_referrals` قرار دارند.

## نگهداری در Production

PostgreSQL 17 در Container خصوصی و بدون Port binding روی Host اجرا می‌شود. داده روی Docker Volume دائمی `postgres_data` قرار دارد و Deploy برنامه Volume را حذف نمی‌کند. Migrationها پیش از به‌روزرسانی Containerهای Runtime با `prisma migrate deploy` اجرا می‌شوند.

Snapshot هفتگی ابرک فقط لایه‌ی مکمل است. پیش از انتشار عمومی، Backup زمان‌بندی‌شده‌ی مستقل، انتقال نسخه‌ها به فضای خارج از همان ابرک و آزمایش Restore الزامی است.
