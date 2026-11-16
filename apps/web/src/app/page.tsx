import Link from 'next/link';
import { buildDashboard, generateDemoData } from '@emberly/core';
import { IconArrow, Logo } from '@/components/icons';
import { HeroChannel } from '@/components/landing/HeroChannel';
import { NudgeChat } from '@/components/landing/NudgeChat';
import { Reveal } from '@/components/landing/Reveal';
import { ScrollYear } from '@/components/landing/ScrollYear';
import { TiltCard } from '@/components/landing/TiltCard';
import { ThemeToggle } from '@/components/ThemeToggle';

// A fixed date keeps the landing page fully static.
const SAMPLE_NOW = '2026-10-29T16:00:00Z';

function sample() {
  const demo = generateDemoData(SAMPLE_NOW, 'UTC');
  const m = buildDashboard({ posts: demo.posts, channels: [demo.channel], schedule: demo.schedule, now: SAMPLE_NOW });
  const weeks = m.grid.weeks;

  // Hero: the last 13 weeks, plus an empty column that fills as posts arrive.
  const hero = [...weeks.slice(-14, -1).flatMap((w) => w.map((c) => (c.state === 'future' ? 0 : c.level))), ...Array<number>(7).fill(0)];

  // Scroll story: every day in order, with a running total and its month.
  let total = 0;
  const cells = weeks.flat();
  const levels = cells.map((c) => (c.state === 'future' ? -1 : c.level));
  const cumulative = cells.map((c) => (total += c.count));
  const months = cells.map((c) => new Date(`${c.date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }));
  return { hero, levels, cumulative, months, cols: weeks.length };
}

export default function Landing() {
  const s = sample();
  return (
    <div className="lp">
      <div className="lp-glow" aria-hidden />

      <header className="lp-nav container">
        <Link href="/" className="brand" aria-label="Tally home">
          <Logo /> Tally
        </Link>
        <div className="lp-nav-cta">
          <ThemeToggle />
          <Link href="/sign-in" className="btn btn-ghost btn-sm">
            Sign in
          </Link>
          <Link href="/sign-up" className="btn btn-accent btn-sm">
            Get started
          </Link>
        </div>
      </header>

      <main id="main">
        <section className="hero container">
          <div className="hero-copy">
            <h1 className="hero-title">
              <span style={{ ['--d' as string]: 0 }}>Every post</span> <span style={{ ['--d' as string]: 1 }}>becomes</span>{' '}
              <em style={{ ['--d' as string]: 2 }}>a square.</em>
            </h1>
            <p className="hero-sub">Tally turns your Telegram channel into a living year.</p>
            <div className="hero-ctas">
              <Link href="/sign-up" className="btn btn-accent btn-lg">
                Start free <IconArrow size={16} />
              </Link>
              <Link href="/demo" className="btn btn-ghost btn-lg">
                See a demo
              </Link>
            </div>
          </div>
          <div className="hero-visual">
            <HeroChannel levels={s.hero} />
          </div>
        </section>

        <ScrollYear levels={s.levels} cumulative={s.cumulative} months={s.months} cols={s.cols} />

        <section className="container lp-split">
          <Reveal className="lp-copy">
            <h2>
              A nudge, <em>only when you need it.</em>
            </h2>
            <p>One message a day at most. Never in quiet hours.</p>
          </Reveal>
          <NudgeChat />
        </section>

        <section className="container lp-split is-flipped">
          <Reveal className="lp-copy">
            <h2>
              Your year, <em>on your page.</em>
            </h2>
            <p>Share it. Follow other creators. Star the channels you love.</p>
          </Reveal>
          <Reveal className="lp-card-wrap">
            <TiltCard className="lp-profile">
              <div className="lpp-top">
                <span className="lpp-avatar">M</span>
                <span>
                  <strong>Maya Okafor</strong>
                  <span>Creator since March 2023</span>
                </span>
                <span className="lpp-follow">Follow</span>
              </div>
              <div className="lpp-grid" aria-hidden>
                {s.hero.slice(0, 91).map((lv, i) => (
                  <span key={i} className={`hc-cell lv${lv}`} />
                ))}
              </div>
              <div className="lpp-channels">
                <span>Field Notes</span>
                <span>Studio Diary</span>
                <span>Weekend Walks</span>
              </div>
            </TiltCard>
          </Reveal>
        </section>

        <Reveal as="section" className="container lp-end">
          <h2>Start your year.</h2>
          <Link href="/sign-up" className="btn btn-accent btn-lg">
            Create your account <IconArrow size={16} />
          </Link>
        </Reveal>
      </main>

      <footer className="lp-foot container">
        <span className="brand">
          <Logo /> Tally
        </span>
        <span className="faint small">Not affiliated with Telegram.</span>
      </footer>
    </div>
  );
}
