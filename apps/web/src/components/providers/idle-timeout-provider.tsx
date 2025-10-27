'use client';

import { useIdleTimeout } from '@/lib/auth/use-idle-timeout';

export function IdleTimeoutProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useIdleTimeout();
  return <>{children}</>;
}
