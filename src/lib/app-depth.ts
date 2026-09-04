'use client';

import type { useRouter } from 'next/navigation';

type Router = ReturnType<typeof useRouter>;

const HOME = '/app';

// Leaving a project has to unwind every entry the app stacked underneath it — the tab it was on,
// the folders it drilled into, the session it opened, the spare entry the front page's search box
// holds — so that one more back closes the PWA instead of retracing them. The platform gives no
// way to do that blind: there is no index for the current entry, entries below it cannot be
// dropped, and a `go()` past the first one is a silent no-op rather than a clamp. So every entry
// is stamped with its distance from the one the app opened at, as it is created, which leaves a
// single exact `go(-depth)` to get home.

function depthOf(state: unknown): number {
  const depth = (state as { appDepth?: unknown } | null)?.appDepth;
  return typeof depth === 'number' ? depth : 0;
}

function currentDepth(): number {
  return depthOf(window.history.state);
}

let tracking = false;

export function trackAppDepth() {
  if (tracking) return;
  tracking = true;
  const { pushState, replaceState } = window.history;
  // Both wrappers stamp from the entry that is still the current one when they run: a push lands
  // one deeper than it, a replace stands in for it and keeps its depth. Next wraps these same two
  // methods to keep its router in sync with outside changes, and either order of wrapping leaves
  // both on the call path.
  window.history.pushState = function (state, unused, url) {
    pushState.call(
      this,
      { ...state, appDepth: currentDepth() + 1 },
      unused,
      url
    );
  };
  window.history.replaceState = function (state, unused, url) {
    replaceState.call(
      this,
      { ...state, appDepth: currentDepth() },
      unused,
      url
    );
  };
}

export function goHome(router: Router) {
  const depth = currentDepth();
  if (depth === 0) {
    replaceUnlessHome(router);
    return;
  }
  const onPopState = () => {
    window.removeEventListener('popstate', onPopState);
    setTimeout(() => replaceUnlessHome(router), 0);
  };
  window.addEventListener('popstate', onPopState);
  window.history.go(-depth);
}

// The first entry is the front page whenever the app was opened at it, and a project page when a
// notification deep-linked straight into one — nothing to go back to, so it is replaced instead.
function replaceUnlessHome(router: Router) {
  if (window.location.pathname !== HOME) router.replace(HOME);
}
