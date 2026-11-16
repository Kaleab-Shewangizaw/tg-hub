import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import '../styles/app.css';
import '../styles/landing.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: { default: 'Tally · Your posting rhythm, tracked', template: '%s · Tally' },
  description: 'Track your Telegram channel, keep streaks on your own schedule, and get a gentle nudge when you need one.',
};

export const viewport: Viewport = {
  themeColor: '#0b0b0c',
};

// Dark by default; applies a saved light/dark choice before first paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem('emberly-theme');document.documentElement.dataset.theme=t==='light'?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
