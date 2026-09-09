import logo from "@/assets/seo-command-orange-logo.png";
import { cn } from "@/lib/cn";

/** Reuse the approved artwork, with viewports for the full lockup and compact mark. */
export function BrandLogo({
  variant = "full",
  className,
}: {
  variant?: "full" | "mark";
  className?: string;
}) {
  const mark = variant === "mark";
  return (
    <svg
      viewBox={mark ? "125 170 385 385" : "145 168 1882 388"}
      role="img"
      aria-label="SEO Command"
      className={cn("block shrink-0", mark ? "h-9 w-9" : "brand-logo-full h-auto w-48", className)}
    >
      <image href={logo.src} width={2172} height={724} />
    </svg>
  );
}
