'use client';

import { useSession } from 'next-auth/react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export function SessionIndicator() {
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <Badge variant="outline" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-xs">Connecting...</span>
      </Badge>
    );
  }

  if (status === 'authenticated') {
    return (
      <Badge variant="outline" className="gap-1 border-green-500 text-green-700">
        <CheckCircle2 className="h-3 w-3" />
        <span className="text-xs">Signed in</span>
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1 border-red-500 text-red-700">
      <XCircle className="h-3 w-3" />
      <span className="text-xs">Not signed in</span>
    </Badge>
  );
}
