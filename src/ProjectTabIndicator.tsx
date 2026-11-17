import { useEffect, useRef } from "react";
export function ProjectTabIndicator() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const marker = ref.current,
      nav = marker?.parentElement;
    if (!marker || !nav) return;
    const update = () => {
      const active = nav.querySelector<HTMLElement>(
        'button[aria-current="page"],button.active',
      );
      if (!active) {
        marker.style.opacity = "0";
        return;
      }
      marker.style.opacity = "1";
      marker.style.width = `${active.offsetWidth}px`;
      marker.style.transform = `translateX(${active.offsetLeft}px)`;
      if (!marker.dataset.ready)
        requestAnimationFrame(() => {
          marker.dataset.ready = "true";
        });
    };
    const mutation = new MutationObserver(update);
    mutation.observe(nav, {
      attributes: true,
      attributeFilter: ["class", "aria-current"],
      subtree: true,
      childList: true,
    });
    const resize = new ResizeObserver(update);
    resize.observe(nav);
    update();
    return () => {
      mutation.disconnect();
      resize.disconnect();
    };
  }, []);
  return (
    <span className="project-tab-indicator" ref={ref} aria-hidden="true" />
  );
}
