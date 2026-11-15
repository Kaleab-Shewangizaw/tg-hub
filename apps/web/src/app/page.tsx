import Link from 'next/link';
import { buildDashboard, generateDemoData } from '@emberly/core';
import { GridPreview } from '@/components/GridPreview';
import { IconArrow, IconBell, IconCheck, IconHeart, IconMedal, IconPause, IconSliders, IconTelegram, IconX, Logo } from '@/components/icons';

// A fixed date keeps the landing page fully static.
const SAMPLE_NOW = '2026-10-29T16:00:00Z';

function sample() {
  const demo = generateDemoData(SAMPLE_NOW, 'UTC');
  return buildDashboard({ posts: demo.posts, channels: [demo.channel], schedule: demo.schedule, now: SAMPLE_NOW });
}

const FEATURES = [
  { Icon: IconSliders, title: 'Your rhythm, your rules', text: 'Post daily, on set days, or a number of times a week. Streaks follow your goal, not ours.' },
  { Icon: IconPause, title: 'Breaks are built in', text: 'Plan time off ahead. Rest days and breaks never break a streak.' },
  { Icon: IconBell, title: 'Gentle reminders', text: 'At most one Telegram message a day, at your time, and never during quiet hours.' },
  { Icon: IconMedal, title: 'Medals that mean something', text: 'Earned from your real posts. Every medal tells you exactly why you got it.' },
];

const STEPS = [
  { title: 'Link Telegram', text: 'Press Start in the Emberly bot so we know it’s you.' },
  { title: 'Add the bot to your channel', text: 'As an admin with every permission off. It only reads.' },
  { title: 'Pick your rhythm', text: 'Set a goal and reminders. Your grid fills in as you post.' },
];

export default function Landing() {
  const m = sample();
  return (
    <div className="lp">
      <header className="lp-nav container">
        <Link href="/" className="brand" aria-label="Emberly home">
          <Logo /> Emberly
        </Link>
        <nav className="lp-links" aria-label="Sections">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <Link href="/demo">Demo</Link>
        </nav>
        <div className="lp-nav-cta">
          <Link href="/sign-in" className="btn btn-ghost btn-sm">
            Sign in
          </Link>
          <Link href="/sign-up" className="btn btn-sm">
            Get started
          </Link>
        </div>
      </header>

      <main id="main">
        <section className="hero container">
          <span className="chip hero-eyebrow">
            <IconTelegram size={13} /> For Telegram channel creators
          </span>
          <h1 className="hero-title">Your posting rhythm, kept simple.</h1>
          <p className="hero-sub">See every post on one calm grid, keep streaks on your own schedule, and get a gentle nudge only when you need one.</p>
          <div className="hero-ctas">
            <Link href="/sign-up" className="btn btn-accent btn-lg">
              Start for free <IconArrow size={16} />
            </Link>
            <Link href="/demo" className="btn btn-ghost btn-lg">
              View the demo
            </Link>
          </div>

          <div className="preview" aria-label="Example dashboard for a sample channel" role="img">
            <div className="preview-top">
              <div className="preview-channel">
                <span className="avatar">F</span>
                <div>
                  <p className="preview-name">Field Notes</p>
                  <p className="faint small">Goal: 4 posts a week</p>
                </div>
              </div>
              <span className="chip chip-mint chip-dot">Tracking</span>
            </div>
            <div className="preview-stats">
              <div>
                <p className="label">This week</p>
                <p className="stat-num">
                  {m.progress.posted}
                  <span className="stat-unit">/ {m.progress.target}</span>
                </p>
              </div>
              <div>
                <p className="label">Streak</p>
                <p className="stat-num">
                  {m.streaks.current}
                  <span className="stat-unit">weeks</span>
                </p>
              </div>
              <div>
                <p className="label">Posts</p>
                <p className="stat-num">{m.totals.posts}</p>
              </div>
              <div className="hide-sm">
                <p className="label">Reactions</p>
                <p className="stat-num">{(m.totals.reactions / 1000).toFixed(1)}k</p>
              </div>
            </div>
            <GridPreview grid={m.grid} />
          </div>
        </section>

        <section id="features" className="section container">
          <div className="section-head">
            <h2>Consistency, without the guilt</h2>
            <p>Emberly is built to help you show up, not to make you feel bad when life happens.</p>
          </div>
          <ul className="features">
            {FEATURES.map(({ Icon, title, text }) => (
              <li key={title}>
                <span className="feature-icon">
                  <Icon size={18} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="how" className="section container">
          <div className="section-head">
            <h2>Set up in two minutes</h2>
            <p>No passwords to share and nothing to install in your channel.</p>
          </div>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="step-n">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="section container">
          <div className="honest">
            <div>
              <h2>Real numbers only</h2>
              <p>We show exactly what Telegram shares with bots, and we tell you when something isn’t available.</p>
            </div>
            <ul className="honest-list">
              <li>
                <IconCheck size={16} /> Every new post
              </li>
              <li>
                <IconHeart size={16} /> Reactions on each post
              </li>
              <li>
                <IconCheck size={16} /> Import of older posts
              </li>
              <li className="off">
                <IconX size={16} /> Views (not shared by Telegram)
              </li>
            </ul>
          </div>
        </section>

        <section className="section container">
          <div className="cta">
            <h2>Show up, at your own pace.</h2>
            <p>Free to use. Set up in a couple of minutes.</p>
            <div className="hero-ctas">
              <Link href="/sign-up" className="btn btn-accent btn-lg">
                Create your account
              </Link>
              <Link href="/demo" className="btn btn-ghost btn-lg">
                View the demo
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-foot container">
        <span className="brand">
          <Logo size={20} /> Emberly
        </span>
        <span className="faint small">Not affiliated with Telegram.</span>
      </footer>
    </div>
  );
}
