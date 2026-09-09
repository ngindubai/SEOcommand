import { isValidElement, type ReactNode } from "react";

/** Export semantic cell content independently of the value used to sort it. */
export function cellText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(cellText).filter(Boolean).join(" ");
  if (isValidElement<{ children?: ReactNode; label?: string; value?: string | number }>(node)) {
    return cellText(node.props.children) || String(node.props.label ?? node.props.value ?? "");
  }
  return "";
}

export function csvCell(value: string | number | null | undefined): string {
  const safe = typeof value === "string" && /^[=+@\-\t\r]/.test(value) ? `'${value}` : String(value ?? "");
  return `"${safe.replace(/"/g, '""')}"`;
}
