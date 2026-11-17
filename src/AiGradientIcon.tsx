import { useId, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
/** Figma Astra/Colors/Gradient/Gradient 1; decorative cue, not connection status. */
export function AiGradientIcon({
  icon: Icon,
  size = 20,
}: {
  icon?: LucideIcon;
  size?: number;
}) {
  const id = `astra-ai-${useId().replace(/:/g, "")}`;
  const defs: ReactNode = (
    <defs>
      <linearGradient
        id={id}
        x1="0"
        y1="0"
        x2={Icon ? 24 : 82}
        y2="0"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#4F46E5" />
        <stop offset="1" stopColor="#2DD4BF" />
      </linearGradient>
    </defs>
  );
  if (Icon)
    return (
      <Icon
        size={size}
        aria-hidden="true"
        stroke={`url(#${id})`}
        className="astra-ai-gradient-icon"
      >
        {defs}
      </Icon>
    );
  // Exact central symbol vector from Figma Brand Identity node 103:332.
  return (
    <svg
      width={size}
      height={size}
      viewBox="-4 -4 90 90"
      aria-hidden="true"
      className="astra-ai-gradient-icon"
      fill="none"
    >
      <defs>
        <linearGradient
          id={id}
          x1="0"
          y1="0"
          x2={Icon ? 24 : 82}
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#4F46E5" />
          <stop offset="1" stopColor="#2DD4BF" />
        </linearGradient>
      </defs>
      <path
        d="M 0 41 C 25 41 41 20.5 41 0 C 41 20.5 56 41 82 41 C 56.5 41 41 56 41 82 C 41 56 25 41 0 41 Z"
        stroke={`url(#${id})`}
        strokeWidth="6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
