# API بازی کمپین

Base path: `/api/v1`

تمام پاسخ‌های موفق به‌شکل `{ "data": ... }` هستند. Session از Cookie نوع HttpOnly استفاده می‌کند.

## Authentication

### `POST /auth/otp/request`

```json
{
  "mobile": "09123456789",
  "displayName": "سارا"
}
```

برای حساب تازه، `displayName` الزامی است. در حالت `OTP_DELIVERY_MODE=preview` پاسخ دارای `developmentCode` است. این فیلد در اتصال SMS واقعی باید حذف شود.

### `POST /auth/otp/verify`

```json
{
  "mobile": "09123456789",
  "code": "123456"
}
```

Challenge را مصرف می‌کند، در صورت نیاز User می‌سازد و Cookie را تنظیم می‌کند.

### `GET /auth/me`

User فعلی شامل `id`، `mobile`، `displayName` و `bestScore`.

### `POST /auth/logout`

Session فعلی را حذف و Cookie را پاک می‌کند.

## Game

### `POST /games/start`

نیازمند Session. پاسخ شامل `id`، `startedAt`، `durationMs=60000` و Target schedule است. بیش از ۵ شروع در ۱۰ دقیقه پذیرفته نمی‌شود و شروع تازه Session فعال قبلی را باطل می‌کند.

### `POST /games/:id/finish`

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

امتیاز از Client دریافت نمی‌شود. سرور ابتدا Hitها را با Schedule اعتبارسنجی می‌کند و سپس ضریب Combo را اعمال می‌کند. پاسخ شامل `score` معتبر، تعداد Hit پذیرفته/ردشده، `bestScore`، `isPersonalBest` و `rank` است.

## Leaderboard

### `GET /leaderboard?limit=20`

عمومی است. فقط Userهایی با امتیاز بیشتر از صفر را بر اساس `bestScore DESC` نمایش می‌دهد. در امتیاز برابر، رکوردی که زودتر ثبت شده بالاتر است. `limit` بین ۳ و ۵۰ محدود می‌شود.

## Health

### `GET /health`

برای Health Check سرویس؛ پاسخ علاوه بر `status` شامل `serverTime` است تا اختلاف ساعت محیط‌ها قابل تشخیص باشد.
