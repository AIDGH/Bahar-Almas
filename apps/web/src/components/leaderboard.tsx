import type { UIEvent } from 'react';
import type { LeaderboardEntry } from '@/lib/types';

type LeaderboardProps = {
  entries: LeaderboardEntry[];
  currentPlayer: LeaderboardEntry | null;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
};

export function Leaderboard({
  entries,
  currentPlayer,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
}: LeaderboardProps) {
  const podium = [entries[1], entries[0], entries[2]];

  function handleListScroll(event: UIEvent<HTMLOListElement>) {
    const list = event.currentTarget;
    if (list.scrollHeight - list.scrollTop - list.clientHeight < 80 && hasMore) {
      onLoadMore();
    }
  }

  return (
    <aside className="leaderboard-card" id="leaderboard">
      <div className="section-heading">
        <div>
          <span>جدول رکوردها</span>
          <h2>تردترین‌های کمپین</h2>
        </div>
        <span className="live-pill"><i /> زنده</span>
      </div>

      {loading ? (
        <div className="leaderboard-loading" aria-label="در حال دریافت رکوردها">
          <span />
          <span />
          <span />
        </div>
      ) : entries.length === 0 ? (
        <div className="empty-leaderboard">
          <span className="empty-medal">★</span>
          <strong>جایگاه اول منتظر توست!</strong>
          <p>اولین بازی را تمام کن تا اسمت اینجا ثبت شود.</p>
        </div>
      ) : (
        <>
          <div className="podium" aria-label="سه بازیکن برتر">
            {podium.map((entry, index) =>
              entry ? (
                <div
                  key={entry.userId}
                  className={`podium-player podium-position-${index}`}
                >
                  {entry.rank === 1 && <span className="crown">♛</span>}
                  <div className="avatar-badge">{firstLetter(entry.displayName)}</div>
                  <strong>{entry.displayName}</strong>
                  <span>{formatScore(entry.score)}</span>
                  <i>{toPersianNumber(entry.rank)}</i>
                </div>
              ) : null,
            )}
          </div>
          <ol className="leaderboard-list" onScroll={handleListScroll}>
            {entries.slice(3).map((entry) => (
              <li
                key={entry.userId}
                className={
                  entry.userId === currentPlayer?.userId && entry.rank <= 10
                    ? 'is-current-player'
                    : undefined
                }
              >
                <span className="rank-number">{toPersianNumber(entry.rank)}</span>
                <span className="mini-avatar">{firstLetter(entry.displayName)}</span>
                <strong>{entry.displayName}</strong>
                <b>{formatScore(entry.score)}</b>
              </li>
            ))}
            {loadingMore && <li className="leaderboard-more">در حال دریافت رتبه‌های بیشتر…</li>}
            {!hasMore && entries.length > 10 && (
              <li className="leaderboard-more">به انتهای جدول رسیدی</li>
            )}
          </ol>
          {currentPlayer && currentPlayer.rank > 10 && (
            <div className="current-player-rank" aria-label="رتبه شما">
              <span className="rank-number">{toPersianNumber(currentPlayer.rank)}</span>
              <span className="mini-avatar">{firstLetter(currentPlayer.displayName)}</span>
              <strong>{currentPlayer.displayName}</strong>
              <b>{formatScore(currentPlayer.score)}</b>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

function firstLetter(name: string): string {
  return name.trim().charAt(0) || 'ب';
}

export function formatScore(score: number): string {
  return new Intl.NumberFormat('en-US').format(score);
}

function toPersianNumber(value: number): string {
  return new Intl.NumberFormat('fa-IR', { useGrouping: false }).format(value);
}
