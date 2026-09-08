'use client';

import { FormEvent, useState } from 'react';
import { requestOtp, verifyOtp } from '@/lib/api';
import type { User } from '@/lib/types';

type AuthMode = 'login' | 'register';

type AuthDialogProps = {
  open: boolean;
  defaultMode?: AuthMode;
  initialReferralCode?: string;
  onClose: () => void;
  onAuthenticated: (user: User) => Promise<void> | void;
};

export function AuthDialog({
  open,
  defaultMode = 'login',
  initialReferralCode = '',
  onClose,
  onAuthenticated,
}: AuthDialogProps) {
  const [step, setStep] = useState<'identity' | 'code'>('identity');
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [displayName, setDisplayName] = useState('');
  const [mobile, setMobile] = useState('');
  const [referralCode, setReferralCode] = useState(initialReferralCode);
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

  function selectMode(nextMode: AuthMode) {
    setMode(nextMode);
    setStep('identity');
    setCode('');
    setPreviewCode(undefined);
    setError('');
  }

  async function submitIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await requestOtp({
        mode,
        mobile,
        ...(mode === 'register' ? { displayName } : {}),
        ...(mode === 'register' && referralCode.trim()
          ? { referralCode: referralCode.trim().toUpperCase() }
          : {}),
      });
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
      await onAuthenticated(user);
      setStep('identity');
      setCode('');
      setPreviewCode(undefined);
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
        <span className="dialog-kicker">ثبت رکورد مسابقه</span>
        <div className="auth-mode-tabs" role="tablist" aria-label="ورود یا ثبت‌نام">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={mode === 'login' ? 'is-active' : undefined}
            onClick={() => selectMode('login')}
          >
            ورود
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={mode === 'register' ? 'is-active' : undefined}
            onClick={() => selectMode('register')}
          >
            ثبت‌نام
          </button>
        </div>
        <h2 id="auth-title">
          {step === 'code'
            ? 'کد تأیید را وارد کن'
            : mode === 'login'
              ? 'به حسابت برگرد'
              : 'رکوردت را به اسم خودت ثبت کن'}
        </h2>
        <p>
          {step === 'code'
            ? `کد شش‌رقمی برای ${mobile} آماده است.`
            : mode === 'login'
              ? 'شماره‌ای را وارد کن که قبلاً با آن ثبت‌نام کرده‌ای.'
              : 'اسم نمایشی می‌تواند با اسم بازیکن‌های دیگر یکسان باشد.'}
        </p>

        {step === 'identity' ? (
          <form onSubmit={submitIdentity}>
            {mode === 'register' && (
              <>
                <label htmlFor="display-name">اسم نمایشی</label>
                <input
                  id="display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="مثلاً سارا"
                  autoComplete="name"
                  maxLength={40}
                  required
                />
              </>
            )}
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
            {mode === 'register' && (
              <>
                <label htmlFor="referral-code">کد معرف (اختیاری)</label>
                <input
                  id="referral-code"
                  className="ltr-input"
                  value={referralCode}
                  onChange={(event) => setReferralCode(event.target.value.toUpperCase())}
                  placeholder="مثلاً A1B2C3D4E5"
                  autoCapitalize="characters"
                  maxLength={12}
                />
                <small className="field-hint">
                  با ثبت‌نام موفق، ۱٬۰۰۰ امتیاز به صاحب این کد می‌رسد.
                </small>
              </>
            )}
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
              {busy ? 'در حال تأیید…' : mode === 'login' ? 'تأیید و ورود' : 'تأیید و ثبت‌نام'}
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
