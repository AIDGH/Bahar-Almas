'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getAdminUsers, updateAdminUser } from '@/lib/api';
import type { AdminUser, User } from '@/lib/types';
import { formatScore } from './leaderboard';

type AdminDialogProps = {
  open: boolean;
  currentUser: User;
  onClose: () => void;
  onCurrentUserUpdated: (user: User) => void;
};

const PAGE_SIZE = 25;

export function AdminDialog({
  open,
  currentUser,
  onClose,
  onCurrentUserUpdated,
}: AdminDialogProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [displayName, setDisplayName] = useState('');
  const [mobile, setMobile] = useState('');
  const [savingId, setSavingId] = useState<string>();
  const [error, setError] = useState('');

  const loadUsers = useCallback(async (nextSearch: string) => {
    setLoading(true);
    setError('');
    try {
      const page = await getAdminUsers(nextSearch, 0, PAGE_SIZE);
      setUsers(page.users);
      setTotal(page.total);
      setNextOffset(page.nextOffset);
    } catch (loadError) {
      setError(messageOf(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const loadTimer = window.setTimeout(() => void loadUsers(search), 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadUsers, open, search]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditingId(undefined);
    setSearch(searchInput.trim());
    if (search === searchInput.trim()) void loadUsers(search);
  }

  function startEditing(user: AdminUser) {
    setEditingId(user.id);
    setDisplayName(user.displayName);
    setMobile(user.mobile);
    setError('');
  }

  async function saveUser(event: FormEvent<HTMLFormElement>, user: AdminUser) {
    event.preventDefault();
    setSavingId(user.id);
    setError('');
    try {
      const updated = await updateAdminUser(user.id, { displayName, mobile });
      replaceUser(updated);
      setEditingId(undefined);
    } catch (saveError) {
      setError(messageOf(saveError));
    } finally {
      setSavingId(undefined);
    }
  }

  async function toggleBan(user: AdminUser) {
    const nextBanned = !user.isBanned;
    if (
      nextBanned &&
      !window.confirm(`حساب «${user.displayName}» مسدود شود؟`)
    ) {
      return;
    }
    setSavingId(user.id);
    setError('');
    try {
      const updated = await updateAdminUser(user.id, {
        isBanned: nextBanned,
      });
      replaceUser(updated);
    } catch (saveError) {
      setError(messageOf(saveError));
    } finally {
      setSavingId(undefined);
    }
  }

  async function loadMore() {
    if (nextOffset === null || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const page = await getAdminUsers(search, nextOffset, PAGE_SIZE);
      setUsers((current) => [...current, ...page.users]);
      setNextOffset(page.nextOffset);
    } catch (loadError) {
      setError(messageOf(loadError));
    } finally {
      setLoadingMore(false);
    }
  }

  function replaceUser(updated: AdminUser) {
    setUsers((current) =>
      current
        .map((user) => (user.id === updated.id ? updated : user))
        .sort(compareAdminUsers),
    );
    if (updated.id === currentUser.id) onCurrentUserUpdated(updated);
  }

  return (
    <div
      className="dialog-backdrop admin-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-title"
      >
        <button
          className="dialog-close"
          type="button"
          onClick={onClose}
          aria-label="بستن"
        >
          ×
        </button>
        <header className="admin-heading">
          <div>
            <span>مدیریت مسابقه</span>
            <h2 id="admin-title">کاربران</h2>
          </div>
          <b>{toPersianNumber(total)} کاربر</b>
        </header>

        <form className="admin-search" onSubmit={submitSearch}>
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="جست‌وجوی نام، شماره یا کد معرف"
            aria-label="جست‌وجوی کاربران"
          />
          <button type="submit">جست‌وجو</button>
          {search && (
            <button
              className="admin-clear-search"
              type="button"
              onClick={() => {
                setSearchInput('');
                setSearch('');
              }}
            >
              پاک‌کردن
            </button>
          )}
        </form>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="admin-loading">در حال دریافت کاربران…</div>
        ) : users.length ? (
          <div className="admin-users">
            {users.map((user, index) => (
              <article
                className={`admin-user-card${user.isBanned ? ' is-banned' : ''}`}
                key={user.id}
              >
                <div className="admin-user-rank">
                  {user.isBanned ? '—' : toPersianNumber(index + 1)}
                </div>
                <div className="admin-user-main">
                  <div className="admin-user-name">
                    <strong>{user.displayName}</strong>
                    {user.role === 'ADMIN' && <span>ادمین</span>}
                    {user.isBanned && (
                      <span className="banned-pill">مسدود</span>
                    )}
                  </div>
                  <small dir="ltr">{user.mobile}</small>
                  <code dir="ltr">{user.referralCode}</code>
                </div>
                <div className="admin-user-stats">
                  <span>
                    رکورد <b>{formatScore(user.bestScore)}</b>
                  </span>
                  <span>
                    کل <b>{formatScore(user.totalScore)}</b>
                  </span>
                  <span>
                    بازی <b>{toPersianNumber(user.totalGames)}</b>
                  </span>
                  <span>
                    دعوت <b>{toPersianNumber(user.referralCount)}</b>
                  </span>
                </div>
                <div className="admin-user-actions">
                  <button type="button" onClick={() => startEditing(user)}>
                    ویرایش
                  </button>
                  {user.role !== 'ADMIN' && (
                    <button
                      className={user.isBanned ? 'unban-button' : 'ban-button'}
                      type="button"
                      disabled={savingId === user.id}
                      onClick={() => void toggleBan(user)}
                    >
                      {user.isBanned ? 'رفع مسدودی' : 'مسدودکردن'}
                    </button>
                  )}
                </div>

                {editingId === user.id && (
                  <form
                    className="admin-edit-form"
                    onSubmit={(event) => void saveUser(event, user)}
                  >
                    <label>
                      نام و نام خانوادگی
                      <input
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        maxLength={40}
                        required
                      />
                    </label>
                    <label>
                      شماره موبایل
                      <input
                        dir="ltr"
                        inputMode="tel"
                        value={mobile}
                        onChange={(event) => setMobile(event.target.value)}
                        required
                      />
                    </label>
                    <div>
                      <button type="submit" disabled={savingId === user.id}>
                        {savingId === user.id
                          ? 'در حال ذخیره…'
                          : 'ذخیره تغییرات'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(undefined)}
                      >
                        انصراف
                      </button>
                    </div>
                  </form>
                )}
              </article>
            ))}
            {nextOffset !== null && (
              <button
                className="admin-load-more"
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
              >
                {loadingMore ? 'در حال دریافت…' : 'نمایش کاربران بیشتر'}
              </button>
            )}
          </div>
        ) : (
          <div className="admin-empty">کاربری با این مشخصات پیدا نشد.</div>
        )}
      </section>
    </div>
  );
}

function compareAdminUsers(left: AdminUser, right: AdminUser): number {
  if (left.isBanned !== right.isBanned) return left.isBanned ? 1 : -1;
  return right.bestScore - left.bestScore;
}

function toPersianNumber(value: number): string {
  return new Intl.NumberFormat('fa-IR').format(value);
}

function messageOf(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'خطای پیش‌بینی‌نشده‌ای رخ داد';
}
