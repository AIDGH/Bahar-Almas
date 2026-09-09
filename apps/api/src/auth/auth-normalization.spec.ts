import { BadRequestException } from '@nestjs/common';
import { normalizeIranianMobile } from './auth-normalization';

describe('normalizeIranianMobile', () => {
  it.each(['0912345678', '091234567890'])(
    'reports an invalid digit count for %s',
    (mobile) => {
      expect(() => normalizeIranianMobile(mobile)).toThrow(
        new BadRequestException('شماره موبایل باید ۱۱ رقم باشد'),
      );
    },
  );

  it('reports an invalid prefix only after the length is valid', () => {
    expect(() => normalizeIranianMobile('08123456789')).toThrow(
      new BadRequestException('شماره موبایل باید با ۰۹ شروع شود'),
    );
  });

  it('reports non-numeric input separately', () => {
    expect(() => normalizeIranianMobile('0912345678a')).toThrow(
      new BadRequestException('شماره موبایل فقط باید شامل عدد باشد'),
    );
  });

  it.each([
    ['۰۹۱۲۳۴۵۶۷۸۹', '09123456789'],
    ['+989123456789', '09123456789'],
    ['00989123456789', '09123456789'],
  ])('normalizes %s', (mobile, expected) => {
    expect(normalizeIranianMobile(mobile)).toBe(expected);
  });
});
