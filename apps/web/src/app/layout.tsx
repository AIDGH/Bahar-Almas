import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'خررررچ! | بازی بهار الماس',
  description:
    'بازی کمپین بهار الماس؛ سوخاری‌ها را برش بزنید و رکورد خود را در لیدربورد ثبت کنید.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
