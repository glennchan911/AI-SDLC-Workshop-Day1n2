const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Trims and collapses internal whitespace so tag names stay comparable/unique. */
export function normalizeTagName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function isValidHexColor(color: string): boolean {
  return HEX_COLOR_RE.test(color.trim());
}
