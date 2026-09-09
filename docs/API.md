# API بازی کمپین

Base path: `/api/v1`

تمام پاسخ‌های موفق به‌شکل `{ "data": ... }` هستند. Session از Cookie نوع HttpOnly استفاده می‌کند.

## Authentication

### `POST /auth/otp/request`

```json
{
  "mode": "register",
  "mobile": "09123456789",
  "displayName": "آراد ایزدی دوست",
  "referralCode": "A1B2C3D4E5"
}
```

`mode` باید `login` یا `register` باشد. برای ثبت‌نام، `displayName` یا همان نام و نام خانوادگی الزامی و `referralCode` اختیاری است؛ برای ورود فقط شماره لازم است. ورود شماره‌ی ثبت‌نشده و ثبت‌نام دوباره‌ی شماره‌ی موجود رد می‌شود. درخواست OTP و تأیید آن برای حساب مسدود با `403` رد می‌شوند. در حالت `OTP_DELIVERY_MODE=preview` پاسخ دارای `developmentCode` است.

اعتبارسنجی شماره خطاهای طول، پیش‌شماره و کاراکتر غیرعددی را جدا می‌کند: شماره‌ی محلی پس از نرمال‌سازی باید دقیقاً ۱۱ رقم و با `09` آغاز شود. رقم‌های فارسی/عربی و قالب‌های `+98`، `0098` و `98` پذیرفته و به قالب محلی تبدیل می‌شوند.

### `POST /auth/otp/verify`

```json
{
  "mobile": "09123456789",
  "code": "123456"
}
```

Challenge را مصرف می‌کند، در حالت ثبت‌نام User و کد معرف یکتا می‌سازد و Cookie را تنظیم می‌کند. اگر کد معرف معتبر ارسال شده باشد، ۱٬۰۰۰ امتیاز در همان Transaction به صاحب کد اضافه می‌شود.

### `GET /auth/me`

User فعلی شامل هویت، کد معرف، `bestScore`، `totalGameScore`، `referralPoints`، `totalScore`، `role` و `isBanned` است.

### `POST /auth/logout`

Session فعلی را حذف و Cookie را پاک می‌کند.

## Game

### `POST /games/start`

عمومی و بدون نیاز به ورود است. پاسخ شامل `id`، `startedAt`، `durationMs=60000`، Target schedule و `claimToken` تصادفی است. Token خام فقط به Browser داده می‌شود و Database Hash آن را تا ۲۴ ساعت نگه می‌دارد.

### `POST /games/:id/finish`

Header الزامی:

```text
X-Game-Token: <claimToken>
```

```json
{
  "endedEarly": false,
  "hits": [
    {
      "targetId": 12,
      "hitAtMs": 9400,
      "swipeDistance": 84,
      "swipeDurationMs": 210,
      "gestureId": 3
    }
  ]
}
```

`endedEarly` اختیاری و پیش‌فرض آن `false` است. پایان عادی فقط نزدیک انتهای Session پذیرفته می‌شود؛ با `endedEarly=true` کاربر می‌تواند از منوی Pause بازی را تمام کند و سرور Hitهای جلوتر از زمان واقعاً سپری‌شده را کنار می‌گذارد.

`gestureId` شناسه‌ی عددی هر تماس پیوسته‌ی Pointer است. این فیلد برای تشخیص Combo استفاده می‌شود: حداقل سه Hit معتبر از یک Gesture که حداکثر ۳۰۰ میلی‌ثانیه از اولین Hit خوشه فاصله دارند، ضریب می‌گیرند. ضریب سه‌تایی ۱.۵، چهارتایی ۲ و به‌طور عمومی `تعداد / ۲` است.

امتیاز از Client دریافت نمی‌شود. پاسخ این مرحله `score` معتبر و تعداد Hitهای پذیرفته/ردشده را برمی‌گرداند، اما هنوز رکورد به User متصل نشده است. Finish با Token یکسان Idempotent است.

### `POST /games/:id/claim`

نیازمند Session ورود و Header `X-Game-Token` است. یک بازی `COMPLETED` و ثبت‌نشده را فقط یک‌بار به User فعلی متصل می‌کند، `totalGameScore` و در صورت لزوم `bestScore` را به‌روزرسانی می‌کند و Rank را برمی‌گرداند.

## Profile

### `GET /profile?limit=20&offset=0`

نیازمند Session است. هویت، شماره، کد معرف، آمار امتیاز و تاریخچه‌ی صفحه‌بندی‌شده‌ی بازی‌های ثبت‌شده را برمی‌گرداند. زمان‌ها ISO/UTC هستند و UI آن‌ها را با تقویم شمسی نمایش می‌دهد.

### `PATCH /profile`

```json
{ "displayName": "نام تازه" }
```

نام نمایشی را تغییر می‌دهد. نام‌ها عمداً یکتا نیستند.

## Leaderboard

### `GET /leaderboard?limit=10&offset=0`

عمومی و صفحه‌بندی‌شده است. فقط Userهای مسدودنشده با امتیاز بیشتر از صفر را بر اساس `bestScore DESC` نمایش می‌دهد. پاسخ شامل `entries`، `total`، `nextOffset` و در صورت وجود Cookie معتبر، `currentPlayer` با رتبه‌ی دقیق اوست. UI ابتدا ده نفر را می‌گیرد و هنگام Scroll ادامه‌ی جدول را بارگذاری می‌کند.

## Admin

تمام مسیرهای این بخش به Session معتبر با نقش `ADMIN` نیاز دارند؛ User عادی پاسخ `403` می‌گیرد.

### `GET /admin/users?search=&limit=25&offset=0`

همه‌ی کاربران را با اولویت Userهای فعال و سپس `bestScore DESC` برمی‌گرداند. `search` روی نام، شماره موبایل و کد معرف جست‌وجو می‌کند. پاسخ صفحه‌بندی‌شده شامل نقش، وضعیت مسدودی، رکورد، مجموع امتیاز، تعداد بازی‌ها و تعداد دعوت‌هاست.

### `PATCH /admin/users/:id`

```json
{
  "displayName": "نام تازه",
  "mobile": "09123456789",
  "isBanned": true
}
```

هر فیلد اختیاری است، ولی حداقل یک تغییر باید ارسال شود. شماره جدید نرمال‌سازی و یکتا بررسی می‌شود. مسدودکردن، همه‌ی Sessionهای کاربر را همان لحظه حذف می‌کند؛ حساب و تاریخچه نگه داشته می‌شوند ولی ورود و حضور در لیدربورد متوقف می‌شود. حساب دارای نقش `ADMIN` از این مسیر قابل مسدودکردن نیست.

## Health

### `GET /health`

برای Health Check سرویس؛ پاسخ علاوه بر `status` شامل `serverTime` است تا اختلاف ساعت محیط‌ها قابل تشخیص باشد.
