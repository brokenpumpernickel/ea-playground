import { decodeConfig, encodeConfig, type RunConfig } from './run-config';

/** Links longer than this are warned about: some chat and mail tools cut or break long URLs. */
export const longLinkLimit = 2000;

/** The page's own address without any hash, which is where a link's `#v1.…` goes. */
export const addressWithoutHash = (href: string): string => href.split('#')[0]!;

export const linkFor = (href: string, config: RunConfig): string => addressWithoutHash(href) + encodeConfig(config);

/** What the address the app was opened with asks for. */
export type Startup =
  | { readonly kind: 'none' }
  | { readonly kind: 'config'; readonly config: RunConfig }
  | { readonly kind: 'invalid'; readonly problems: readonly string[] };

/**
 * A hash starting `#v` and a digit is an attempt at a share link, so a damaged one is reported rather than ignored.
 * Any other hash (an in-page anchor, nothing at all) is not ours and is left alone.
 */
export function startupOf(hash: string): Startup {
  if (!/^#v\d/.test(hash)) return { kind: 'none' };
  const result = decodeConfig(hash);
  return result.ok ? { kind: 'config', config: result.config } : { kind: 'invalid', problems: result.problems };
}
