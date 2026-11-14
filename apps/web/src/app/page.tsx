import Link from 'next/link';
import { buildDashboard, generateDemoData } from '@emberly/core';
import { GridPreview } from '@/components/GridPreview';
import { IconArrow, IconCheck, IconFlame, IconHeart, IconTelegram, IconX, Logo } from '@/components/icons';
import { MedalArt } from '@/components/MedalArt';

// A fixed date keeps the landing page fully static.
const SAMPLE_NOW = '2026-10-29T16:00:00Z';

function sample() {
  const demo = generateDemoData(SAMPLE_NOW, 'UTC');
  return buildDashboard({ posts: demo.posts, channels: [demo.channel], schedule: demo.schedule, now: SAMPLE_NOW });
}

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
        {/* Hero */}
        <section className="hero container">
          <div className="hero-glow" aria-hidden />
          <span className="chip chip-accent hero-eyebrow rise">
            <IconTelegram size={14} /> For Telegram creators
          </span>
          <h1 className="hero-title rise" style={{ animationDelay: '60ms' }}>
            Your posting rhythm,
            <br />
            <span className="serif">beautifully kept.</span>
          </h1>
          <p className="hero-sub rise" style={{ animationDelay: '120ms' }}>
            See every post on one calm grid. Keep streaks on your schedule. Get a gentle nudge when you need one.
          </p>
          <div className="hero-ctas rise" style={{ animationDelay: '180ms' }}>
            <Link href="/sign-up" className="btn btn-accent btn-lg">
              Start free <IconArrow size={18} />
            </Link>
            <Link href="/demo" className="btn btn-ghost btn-lg">
              View live demo
            </Link>
          </div>

          {/* Product preview */}
          <div className="preview rise" style={{ animationDelay: '260ms' }}>
            <div className="preview-window">
              <div className="preview-top">
                <div className="preview-channel">
                  <span className="avatar">F</span>
                  <div>
                    <p className="preview-name">Field Notes</p>
                    <p className="faint small">Goal · 4 posts a week</p>
                  </div>
                </div>
                <span className="chip chip-mint chip-dot">Tracking</span>
              </div>
              <div className="preview-stats">
                <div>
                  <p className="label">This week</p>
                  <p className="stat-num">
                    {m.progress.posted}
                    <span className="faint">/{m.progress.target}</span>
                  </p>
                </div>
                <div>
                  <p className="label">Streak</p>
                  <p className="stat-num">
                    {m.streaks.current}
                    <span className="stat-unit">wks</span>
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

            <div className="float float-a" aria-hidden>
              <span className="float-icon">
                <IconTelegram size={16} />
              </span>
              {/* <div>
                <p className="float-title">Emberly</p>
                <p className="small muted">You’re one post away from your weekly goal ✨</p>
              </div> */}
            </div>
            <div className="float float-b" aria-hidden>
              <MedalArt id="kept-rhythm" earned tier={2} size={40} />
              {/* <div>
                <p className="float-title">Kept Rhythm</p>
                <p className="small muted">7 weeks in a row</p>
              </div> */}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="section container">
          <div className="section-head">
            <h2>
              Consistency, <span className="serif">without the guilt.</span>
            </h2>
          </div>
          <div className="bento">
            <article className="tile tile-wide">
              <div className="tile-copy">
                <h3>Your rhythm, your rules</h3>
                <p className="muted">Daily, set days, or a weekly number.</p>
              </div>
              <div className="viz-cadence" aria-hidden>
                <span>Daily</span>
                <span>Mon · Wed · Fri</span>
                <span className="on">4 a week</span>
              </div>
            </article>

            <article className="tile">
              <div className="tile-copy">
                <h3>Breaks are built in</h3>
                <p className="muted">Planned time off never breaks a streak.</p>
              </div>
              <div className="viz-break" aria-hidden>
                <div className="viz-row">
                  {[3, 2, 4, 0, 0, 0, 0, 2, 3, 1].map((l, i) => (
                    <span key={i} className={i >= 3 && i <= 6 ? 'pause' : `lv${l}`} />
                  ))}
                </div>
                <span className="chip chip-mint">
                  <IconFlame size={13} /> Streak kept
                </span>
              </div>
            </article>

            <article className="tile">
              <div className="tile-copy">
                <h3>Gentle nudges</h3>
                <p className="muted">One message, at your time. Never during quiet hours.</p>
              </div>
              <div className="viz-msg" aria-hidden>
                <div className="bubble">
                  A gentle nudge: nothing posted yet today. One post keeps your rhythm going.
                  <span className="bubble-time">18:00</span>
                </div>
              </div>
            </article>

            <article className="tile tile-wide">
              <div className="tile-copy">
                <h3>Medals that mean something</h3>
                <p className="muted">Earned from real posts. Each one says why.</p>
              </div>
              <div className="viz-medals" aria-hidden>
                <MedalArt id="first-spark" earned tier={1} size={60} />
                <MedalArt id="kept-rhythm" earned tier={2} size={60} />
                <MedalArt id="crowd-favorite" earned tier={1} size={60} />
                <MedalArt id="welcome-back" earned={false} size={60} />
              </div>
            </article>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="section container">
          <div className="section-head">
            <h2>
              Set up in <span className="serif">two minutes.</span>
            </h2>
          </div>
          <ol className="steps">
            <li>
              <span className="step-n">1</span>
              <h3>Link Telegram</h3>
              <p className="muted">Tap Start in our bot.</p>
            </li>
            <li>
              <span className="step-n">2</span>
              <h3>Add the bot</h3>
              <p className="muted">As a channel admin. Read-only.</p>
            </li>
            <li>
              <span className="step-n">3</span>
              <h3>Pick your rhythm</h3>
              <p className="muted">Your goal, your reminders.</p>
            </li>
          </ol>
        </section>

        {/* Honest numbers */}
        <section className="section container">
          <div className="honest">
            <div>
              <h2>
                Real numbers. <span className="serif">Only.</span>
              </h2>
              <p className="muted" style={{ marginTop: 10 }}>
                We show what Telegram shares, and say so when it doesn’t.
              </p>
            </div>
            <ul className="honest-list">
              <li>
                <IconCheck size={16} /> Every new post
              </li>
              <li>
                <IconHeart size={16} /> Reactions
              </li>
              <li>
                <IconCheck size={16} /> History import
              </li>
              <li className="off">
                <IconX size={16} /> Views, not shared by Telegram
              </li>
            </ul>
          </div>
        </section>

        {/* CTA */}
        <section className="container">
          <div className="cta">
            <GridPreview grid={m.grid} weeks={30} />
            <div className="cta-inner">
              <h2>
                Show up. <span className="serif">At your pace.</span>
              </h2>
              <div className="hero-ctas">
                <Link href="/sign-up" className="btn btn-accent btn-lg">
                  Create your profile
                </Link>
              </div>
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
