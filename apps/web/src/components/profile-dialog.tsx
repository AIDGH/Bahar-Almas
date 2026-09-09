'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  getProfile,
  updateProfile as saveProfile,
} from '@/lib/api';
import type { Profile, User } from '@/lib/types';
import { formatScore } from './leaderboard';

type ProfileDialogProps = {
  open: boolean;
  user: User;
  onClose: () => void;
  onUserUpdated: (user: User) => void;
};

export function ProfileDialog({
  open,
  user,
  onClose,
  onUserUpdated,
}: ProfileDialogProps) {
  const [profile, setProfile] = useState<Profile>();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    void getProfile()
      .then((nextProfile) => {
        setProfile(nextProfile);
        setDisplayName(nextProfile.displayName);
      })
      .catch((profileError) => setError(messageOf(profileError)))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose, open]);

  const referralUrl = useMemo(() => {
    if (!profile || typeof window === 'undefined') return '';
    const url = new URL('/', window.location.origin);
    url.searchParams.set('utm_source', 'referral');
    url.searchParams.set('utm_medium', 'player');
    url.searchParams.set('utm_campaign', profile.referralCode);
    return url.toString();
  }, [profile]);

  if (!open) return null;

  async function submitName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await saveProfile(displayName);
      setProfile((current) => current ? { ...current, ...updated } : current);
      onUserUpdated(updated);
    } catch (saveError) {
      setError(messageOf(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function copyReferralLink() {
    if (!referralUrl) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralUrl);
      } else {
        const field = document.createElement('textarea');
        field.value = referralUrl;
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        document.execCommand('copy');
        field.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      setError('کپی خودکار انجام نشد؛ کد معرف را دستی کپی کنید.');
    }
  }

  async function loadMoreGames() {
    if (!profile?.nextOffset || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = await getProfile(profile.nextOffset);
      setProfile((current) =>
        current
          ? {
              ...current,
              games: [...current.games, ...nextPage.games],
              nextOffset: nextPage.nextOffset,
            }
          : nextPage,
      );
    } catch (profileError) {
      setError(messageOf(profileError));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div
      className="dialog-backdrop profile-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="profile-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
      >
        <button className="dialog-close" type="button" onClick={onClose} aria-label="بستن">
          ×
        </button>
        <div className="profile-heading">
          <div className="profile-heading-avatar" aria-hidden="true">
            {user.displayName.trim().charAt(0) || 'ب'}
          </div>
          <div>
            <span>حساب بازیکن</span>
            <h2 id="profile-title">پروفایل من</h2>
            <p>اطلاعات حساب، لینک دعوت و تمام رکوردهای ثبت‌شده‌ات</p>
          </div>
        </div>

        {loading && !profile ? (
          <div className="profile-loading">در حال دریافت اطلاعات…</div>
        ) : profile ? (
          <div className="profile-content">
            <div className="profile-summary">
              <form className="profile-name-form" onSubmit={submitName}>
                <label htmlFor="profile-display-name">اسم نمایشی</label>
                <div>
                  <input
                    id="profile-display-name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    maxLength={40}
                    required
                  />
                  <button type="submit" disabled={saving || displayName.trim() === profile.displayName}>
                    {saving ? '…' : 'ذخیره'}
                  </button>
                </div>
              </form>
              <div className="profile-mobile">
                <span>شماره تماس</span>
                <b dir="ltr">{profile.mobile}</b>
              </div>
            </div>

            <div className="profile-stats">
              <article><span>بالاترین رکورد</span><strong>{formatScore(profile.bestScore)}</strong></article>
              <article><span>مجموع بازی‌ها</span><strong>{formatScore(profile.totalGameScore)}</strong></article>
              <article><span>امتیاز دعوت</span><strong>{formatScore(profile.referralPoints)}</strong></article>
              <article><span>امتیاز کل</span><strong>{formatScore(profile.totalScore)}</strong></article>
            </div>

            <div className="referral-card">
              <div>
                <span>کد معرف اختصاصی تو</span>
                <strong dir="ltr">{profile.referralCode}</strong>
                <small>هر ثبت‌نام موفق با این کد، ۱٬۰۰۰ امتیاز برای تو دارد.</small>
                <code dir="ltr">{referralUrl}</code>
              </div>
              <button type="button" onClick={copyReferralLink}>
                {copied ? 'کپی شد ✓' : 'کپی لینک دعوت'}
              </button>
            </div>

            <section className="game-history" aria-labelledby="game-history-title">
              <div className="history-heading">
                <div>
                  <h3 id="game-history-title">تاریخچه کامل بازی‌ها</h3>
                  <small>تاریخ و ساعت بر اساس تقویم شمسی نمایش داده می‌شود.</small>
                </div>
                <span>{toPersianNumber(profile.totalGames)} بازی</span>
              </div>
              {profile.games.length ? (
                <ol>
                  {profile.games.map((game) => (
                    <li key={game.id}>
                      <div>
                        <span>امتیاز</span>
                        <strong>{formatScore(game.score)}</strong>
                      </div>
                      <time dateTime={game.playedAt}>{formatPersianDate(game.playedAt)}</time>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="empty-history">هنوز رکوردی برای این حساب ثبت نشده است.</p>
              )}
              {profile.nextOffset !== null && (
                <button className="history-more" type="button" onClick={loadMoreGames} disabled={loadingMore}>
                  {loadingMore ? 'در حال دریافت…' : 'نمایش ادامه تاریخچه'}
                </button>
              )}
            </section>
          </div>
        ) : null}
        {error && <div className="form-error" role="alert">{error}</div>}
      </section>
    </div>
  );
}

function formatPersianDate(value?: string): string {
  if (!value) return 'زمان نامشخص';
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function toPersianNumber(value: number): string {
  return new Intl.NumberFormat('fa-IR', { useGrouping: false }).format(value);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'خطای پیش‌بینی‌نشده‌ای رخ داد';
}
