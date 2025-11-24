function getRoot(): HTMLElement | null {
  return (
    (document.querySelector("main") as HTMLElement | null) ??
    (document.querySelector("#root") as HTMLElement | null) ??
    document.body
  );
}

function getTargets(root: HTMLElement): HTMLElement[] {
  // まず section を全部
  let nodes = Array.from(root.querySelectorAll<HTMLElement>("section"));

  // section がほぼ無い場合は、大きめの div コンテナを拾う
  if (nodes.length === 0) {
    nodes = Array.from(
      root.querySelectorAll<HTMLElement>(
        "main > div, main > section, #root > div, div[class*='py-'][class*='max-w']"
      )
    );
  }

  const uniq: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  for (const el of nodes) {
    if (seen.has(el)) continue;
    // 高さがそれなりにある要素だけを対象にする
    if (el.offsetHeight < 80) continue;

    seen.add(el);
    uniq.push(el);
  }

  return uniq;
}

export function initScrollReveal() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const root = getRoot();
  if (!root) return;

  const targets = getTargets(root);
  if (targets.length === 0) {
    console.warn("[scrollReveal] no targets found");
    return;
  }

  // 初期クラスを付与
  targets.forEach((el, i) => {
    el.classList.add("lp-scroll-section");
    // ちょいずつディレイずらす（CSS側のアニメに乗せる）
    el.style.setProperty("--lp-delay", `${0.06 * i}s`);
  });

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          el.classList.add("lp-scroll-visible");
          obs.unobserve(el);
        }
      });
    },
    {
      threshold: 0.15,
      rootMargin: "0px 0px -10% 0px",
    }
  );

  targets.forEach((el) => observer.observe(el));

  console.log("[scrollReveal] initialized, targets =", targets.length);
}


