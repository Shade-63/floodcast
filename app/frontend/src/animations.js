/**
 * animations.js — GSAP animation helpers for FLOODCAST UI
 * Import gsap from here so each component doesn't re-import separately.
 */
import { gsap } from 'gsap';

/** Fade + slide up a single element or array of elements on mount */
export function fadeUp(targets, { delay = 0, stagger = 0.06, duration = 0.45 } = {}) {
  return gsap.fromTo(
    targets,
    { opacity: 0, y: 22 },
    { opacity: 1, y: 0, duration, ease: 'power3.out', delay, stagger }
  );
}

/** Fade + scale in (cards, pills, badges) */
export function popIn(targets, { delay = 0, stagger = 0.05, duration = 0.4 } = {}) {
  return gsap.fromTo(
    targets,
    { opacity: 0, scale: 0.88 },
    { opacity: 1, scale: 1, duration, ease: 'back.out(1.4)', delay, stagger }
  );
}

/** Animate a number from 0 to its value (counter roll-up) */
export function countUp(el, endValue, { duration = 1.0, decimals = 3, delay = 0, prefix = '', suffix = '' } = {}) {
  const obj = { val: 0 };
  return gsap.to(obj, {
    val: endValue,
    duration,
    delay,
    ease: 'power2.out',
    onUpdate: () => {
      if (el) el.textContent = prefix + obj.val.toFixed(decimals) + suffix;
    },
  });
}

/** Slide in from left (sidebar nav items) */
export function slideInLeft(targets, { delay = 0, stagger = 0.04, duration = 0.38 } = {}) {
  return gsap.fromTo(
    targets,
    { opacity: 0, x: -18 },
    { opacity: 1, x: 0, duration, ease: 'power2.out', delay, stagger }
  );
}

/** Flash-highlight on a card when new data arrives */
export function flashHighlight(target, color = '#DBEAFE') {
  return gsap.timeline()
    .to(target, { background: color, duration: 0.18, ease: 'none' })
    .to(target, { background: 'var(--bg-surface)', duration: 0.55, ease: 'power2.out' });
}

/** Animate a progress bar width */
export function animateBar(target, widthPct, { delay = 0, duration = 0.8 } = {}) {
  return gsap.fromTo(
    target,
    { width: '0%' },
    { width: `${widthPct}%`, duration, ease: 'power2.out', delay }
  );
}

/** Page/tab transition — wipe out then wipe in */
export function tabTransition(container, onMidpoint) {
  const tl = gsap.timeline();
  tl.to(container, { opacity: 0, y: 10, duration: 0.15, ease: 'power1.in' })
    .call(onMidpoint)
    .fromTo(container, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' });
  return tl;
}

export { gsap };

