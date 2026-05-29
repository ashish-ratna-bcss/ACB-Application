import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ACB – AI-Assisted Investigation Documentation Platform',
  description: 'Anti-Corruption Bureau | AI-Powered Investigation Documentation System',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
