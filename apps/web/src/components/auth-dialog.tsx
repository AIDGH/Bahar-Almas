'use client';

import { FormEvent, useState } from 'react';
import { requestOtp, verifyOtp } from '@/lib/api';
import type { User } from '@/lib/types';

type AuthDialogProps = {
  open: boolean;
  onClose: () => void;
  onAuthenticated: (user: User) => void;
};

export function AuthDialog({ open, onClose, onAuthenticated }: AuthDialogProps) {
  const [step, setStep] = useState<'identity' | 'code'>('identity');
  const [displayName, setDisplayName] = useState('');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [previewCode, setPreviewCode] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  function closeDialog() {
    setStep('identity');
    setCode('');
    setPreviewCode(undefined);
    setError('');
    onClose();
  }

  async function submitIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await requestOtp(mobile, displayName);
      setMobile(result.mobile);
      setPreviewCode(result.developmentCode);
      setStep('code');
    } catch (requestError) {
      setError(messageOf(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await verifyOtp(mobile, toEnglishDigits(code));
      setStep('identity');
      setCode('');
      setPreviewCode(undefined);
      onAuthenticated(user);
    } catch (requestError) {
      setError(messageOf(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={closeDialog}>
      <section
        className="auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="dialog-close" type="button" onClick={closeDialog} aria-label="بستن">
          ×
        </button>
        <span className="dialog-kicker">ورود به مسابقه</span>
        <h2 id="auth-title">
          {step === 'identity' ? 'رکوردت را به اسم خودت ثبت کن' : 'کد تأیید را وارد کن'}
        </h2>
        <p>
          {step === 'identity'
            ? 'اگر قبلاً بازی کرده‌ای، همان شماره کافی است. برای حساب جدید یک اسم هم بنویس.'
            : `کد شش‌رقمی برای ${mobile} آماده است.`}
        </p>

        {step === 'identity' ? (
          <form onSubmit={submitIdentity}>
            <label htmlFor="display-name">اسم نمایشی</label>
            <input
              id="display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="مثلاً سارا"
              autoComplete="name"
              maxLength={40}
            />
            <label htmlFor="mobile">شماره موبایل</label>
            <input
              id="mobile"
              className="ltr-input"
              value={mobile}
              onChange={(event) => setMobile(event.target.value)}
              placeholder="09123456789"
              autoComplete="tel"
              inputMode="tel"
              required
            />
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button full-button" disabled={busy} type="submit">
              {busy ? 'یک لحظه…' : 'دریافت کد'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode}>
            {previewCode && (
              <button
                className="preview-code"
                type="button"
                onClick={() => setCode(previewCode)}
              >
                <span>کد نسخه‌ی آزمایشی</span>
                <strong>{toPersianDigits(previewCode)}</strong>
                <small>برای واردکردن لمس کن</small>
              </button>
            )}
            <label htmlFor="otp-code">کد تأیید</label>
            <input
              id="otp-code"
              className="otp-input"
              value={code}
              onChange={(event) => setCode(event.target.value.slice(0, 6))}
              placeholder="ــــــ"
              autoComplete="one-time-code"
              inputMode="numeric"
              autoFocus
              required
            />
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button full-button" disabled={busy} type="submit">
              {busy ? 'در حال ورود…' : 'تأیید و ورود'}
            </button>
            <button className="text-button" type="button" onClick={() => setStep('identity')}>
              اصلاح شماره موبایل
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'خطای پیش‌بینی‌نشده‌ای رخ داد';
}

function toEnglishDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

function toPersianDigits(value: string): string {
  return value.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
}
