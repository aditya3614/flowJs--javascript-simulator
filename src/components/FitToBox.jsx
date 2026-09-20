import React, { useLayoutEffect, useRef } from 'react';

/*
 * When content has to shrink below these scales, it is switched to the next
 * density level (see "density levels" in visual.css): bigger, bolder text,
 * thicker borders and tighter spacing, so a busy diagram stays legible instead
 * of just getting smaller. Entering level N+1 happens below LEVEL_UP[N].
 */
const LEVEL_UP = [0.62, 0.45, 0.33];
const MAX_LEVEL = LEVEL_UP.length;

/*
 * Going back down needs the content to fit with room to spare, and the lower
 * level must not immediately want to go up again. That gap is what stops the
 * diagram flipping between two levels on every step.
 */
const ROOMY = 0.98;

/**
 * Shrinks its children to fit the space it is given, and lets them grow back
 * to full size when there is room again. Nothing here ever scrolls.
 *
 * The children are laid out at their natural size, then a transform scales and
 * centres them inside the box. A transform does not change layout, so the
 * measurements below (`offsetWidth`, `offsetHeight`) are always the natural
 * size, and scaling can never feed back into them. The CSS transition on
 * `.fit__inner` is what makes each change of scale glide rather than jump.
 */
export default function FitToBox({ children, className = '' }) {
  const boxRef = useRef(null);
  const innerRef = useRef(null);
  const fitRef = useRef(() => {});

  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;

    const setLevel = (level) => {
      if (level) inner.dataset.fit = String(level);
      else delete inner.dataset.fit;
    };

    fitRef.current = () => {
      const availW = box.clientWidth;
      const availH = box.clientHeight;
      if (!availW || !availH) return;

      // Layout size only. `scrollWidth`/`scrollHeight` would be tempting, but they
      // also count children that are mid-animation with a transform, so the
      // diagram would appear to grow and shrink while cards slide into place.
      const measure = () => {
        const w = inner.offsetWidth;
        const h = inner.offsetHeight;
        return w && h ? Math.min(1, availW / w, availH / h) : 1;
      };

      const before = Number(inner.dataset.fit || 0);
      let level = before;
      let scale = measure();

      if (level > 0 && scale >= ROOMY) {
        // Plenty of room: try one level less, and keep it only if it holds.
        setLevel(level - 1);
        const lower = measure();
        if (lower >= LEVEL_UP[level - 1]) { level -= 1; scale = lower; } else setLevel(level);
      } else {
        while (level < MAX_LEVEL && scale < LEVEL_UP[level]) {
          level += 1;
          setLevel(level);
          scale = measure();
        }
      }

      scale = Math.max(0.05, scale);
      const w = inner.offsetWidth;
      const h = inner.offsetHeight;
      const x = (availW - w * scale) / 2;
      const y = (availH - h * scale) / 2;

      // A new level reflows the content in one go, so the transform follows
      // suddenly too; easing it would show the reflowed content at the old scale.
      if (level !== before) inner.style.transition = 'none';
      inner.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${scale.toFixed(4)})`;
      if (level !== before) {
        inner.getBoundingClientRect(); // commit the un-eased change
        requestAnimationFrame(() => { inner.style.transition = ''; });
      }
    };

    // Runs before the first paint, so the content never flashes at full size.
    fitRef.current();
    // Only start animating once the first placement is in, or the content
    // would visibly slide in from the corner on load.
    const raf = requestAnimationFrame(() => inner.classList.add('is-ready'));

    const observer = new ResizeObserver(() => fitRef.current());
    observer.observe(box);
    observer.observe(inner);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  // Cheap enough to run after every render, and it means a step that changes
  // the content is placed in the same frame that it appears.
  useLayoutEffect(() => { fitRef.current(); });

  return (
    <div className="fit" ref={boxRef}>
      <div className={`fit__inner ${className}`} ref={innerRef}>{children}</div>
    </div>
  );
}
