const CHROME_PACKAGE = 'com.android.chrome';

function chromeIntentUrl(url: string): string | null {
  if (typeof window === 'undefined') return null;
  if (!/Android/i.test(navigator.userAgent)) return null;
  if (!window.matchMedia('(display-mode: standalone)').matches) return null;

  const parsed = new URL(url, window.location.href);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  const scheme = parsed.protocol.slice(0, -1);
  const target = `${parsed.host}${parsed.pathname}${parsed.search}`;
  const fallback = encodeURIComponent(parsed.href);
  return `intent://${target}#Intent;scheme=${scheme};package=${CHROME_PACKAGE};S.browser_fallback_url=${fallback};end`;
}

/**
 * An installed PWA hands out-of-scope URLs to a Chrome Custom Tab, so they open
 * in an in-app view. The intent hands them to the Chrome app instead; when no
 * Chrome is installed to take it, browser_fallback_url restores the custom tab.
 */
export function openExternal(url: string) {
  const intent = chromeIntentUrl(url);
  if (intent) {
    window.location.href = intent;
    return;
  }
  window.open(url, '_blank');
}
