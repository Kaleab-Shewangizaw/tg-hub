import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import '../styles/app.css';
import '../styles/landing.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const metadata: Metadata = {
  title: { default: 'Emberly · Your posting rhythm, beautifully kept', template: '%s · Emberly' },
  description: 'Track your Telegram channel, keep streaks on your own schedule, and get a gentle nudge when you need one.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#151518' },
  ],
};

// Applies a saved theme before first paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem('emberly-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable} suppressHydrationWarning>
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
