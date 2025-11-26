/**
 * LP 用スクロールアニメーション
 * .lp-animate / .lp-card-animate に対して .lp-visible を付与する
 * React が後からDOMを描画する前提なので、MutationObserver で監視する
 */
const SELECTOR = ".lp-animate, .lp-card-animate";

function setupLpScrollAnimation() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const observed = new WeakSet<Element>();

  const intersectionObserver = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          el.classList.add("lp-visible");
          obs.unobserve(el); // 1回出てきたら監視解除
        }
      }
    },
    {
      threshold: 0.18,
      rootMargin: "0px 0px -10% 0px",
    }
  );

  const attachTargets = () => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR));
    for (const el of nodes) {
      if (observed.has(el)) continue;
      observed.add(el);

      // data-lp-delay or style で delay が指定されていない場合だけ、ちょいディレイを付ける
      if (!el.style.getPropertyValue("--lp-delay")) {
        const index = nodes.indexOf(el);
        const delay = Math.min(0.03 * index, 0.25);
        el.style.setProperty("--lp-delay", `${delay}s`);
      }

      intersectionObserver.observe(el);
    }
  };

  // 最初の描画にも一応対応
  attachTargets();

  // React があとから描画した要素も拾う
  const mutationObserver = new MutationObserver((_mutations) => {
    attachTargets();
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", () => {
    setupLpScrollAnimation();
  });
} else {
  setupLpScrollAnimation();
}
