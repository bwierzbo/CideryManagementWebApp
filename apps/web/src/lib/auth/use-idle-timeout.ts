'use client';

import { useEffect, useRef } from 'react';
import { signOut, useSession } from 'next-auth/react';

const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_TIME = 5 * 60 * 1000;  // Show warning 5 minutes before

export function useIdleTimeout() {
  const { status } = useSession();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const warningRef = useRef<NodeJS.Timeout>();

  const resetTimer = () => {
    // Only reset if user is authenticated
    if (status !== 'authenticated') return;

    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    // Set warning timer
    warningRef.current = setTimeout(() => {
      // Show warning
      console.warn('You will be signed out due to inactivity in 5 minutes');
      // TODO: You could show a toast here using your toast library
      // toast.warning('You will be signed out due to inactivity in 5 minutes');
    }, IDLE_TIMEOUT - WARNING_TIME);

    // Set signout timer
    timeoutRef.current = setTimeout(() => {
      signOut({ callbackUrl: '/auth/signin?reason=idle' });
    }, IDLE_TIMEOUT);
  };

  useEffect(() => {
    // Only enable idle timeout for authenticated users
    if (status !== 'authenticated') return;

    // Events that reset the timer
    const events = [
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    // Reset timer on any activity
    events.forEach(event => {
      document.addEventListener(event, resetTimer);
    });

    // Start initial timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
    };
  }, [status]);
}
