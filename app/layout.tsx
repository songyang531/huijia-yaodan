import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '回家药单 · 复诊准备助手',
  description:
    '家庭整理材料，药师核对信息，照护者确认交接。医疗黑客松演示原型。',
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.svg' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#294c88',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
