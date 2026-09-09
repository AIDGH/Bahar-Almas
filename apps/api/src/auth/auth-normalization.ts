import { BadRequestException } from '@nestjs/common';

const digitMap: Record<string, string> = {
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

export function normalizeDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => digitMap[digit] ?? digit);
}

export function normalizeIranianMobile(value: string): string {
  const normalized = normalizeDigits(value).replace(/[\s()-]/g, '');
  const local = normalized
    .replace(/^0098/, '0')
    .replace(/^\+98/, '0')
    .replace(/^98(?=9)/, '0');

  if (!/^\d+$/.test(local)) {
    throw new BadRequestException('شماره موبایل فقط باید شامل عدد باشد');
  }
  if (local.length !== 11) {
    throw new BadRequestException('شماره موبایل باید ۱۱ رقم باشد');
  }
  if (!local.startsWith('09')) {
    throw new BadRequestException('شماره موبایل باید با ۰۹ شروع شود');
  }
  return local;
}
