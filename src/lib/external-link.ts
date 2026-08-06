const NATIVE_APP_PACKAGES: Record<string, string> = {
  'github.com': 'com.github.android',
};

function androidIntentUrl(url: string): string | null {
  const parsed = new URL(url);
  const pkg = NATIVE_APP_PACKAGES[parsed.hostname];
  if (!pkg || parsed.protocol !== 'https:') return null;

  const target = `${parsed.host}${parsed.pathname}${parsed.search}`;
  const fallback = encodeURIComponent(url);
  return `intent://${target}#Intent;scheme=https;package=${pkg};S.browser_fallback_url=${fallback};end`;
}

export function openExternalUrl(url: string) {
  const intentUrl = (window as unknown as { __webviewApk?: boolean })
    .__webviewApk
    ? androidIntentUrl(url)
    : null;

  if (intentUrl) {
    window.location.href = intentUrl;
    return;
  }
  window.open(url, '_blank');
}
