'use client';

import { useEffect, useRef } from 'react';

// Holding a spare history entry open while something is dismissable is what makes the phone's
// back gesture dismiss it instead of leaving the page — on the front page that means back empties
// the search box first, and only closes the PWA once there is nothing left to dismiss.
export function useBackToDismiss(active: boolean, onDismiss: () => void) {
  const pushed = useRef(false);

  useEffect(() => {
    if (active && !pushed.current) {
      pushed.current = true;
      window.history.pushState({ ...window.history.state }, '');
    } else if (!active && pushed.current) {
      // Dismissed some other way (the clear button, deleting the last character): drop the spare
      // entry again so back does not have to be pressed twice.
      pushed.current = false;
      window.history.back();
    }
  }, [active]);

  useEffect(() => {
    function onPopState() {
      if (!pushed.current) return;
      pushed.current = false;
      onDismiss();
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  });
}
