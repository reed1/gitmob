'use client';

import { useEffect } from 'react';
import { trackAppDepth } from '../../lib/app-depth';

export default function AppDepthTracker() {
  useEffect(() => {
    trackAppDepth();
  }, []);
  return null;
}
