'use client';

import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useState } from 'react';

interface SignOutButtonProps {
  variant?: 'default' | 'ghost' | 'outline';
  className?: string;
  showIcon?: boolean;
}

export function SignOutButton({
  variant = 'ghost',
  className,
  showIcon = true
}: SignOutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    setIsLoading(true);
    await signOut({
      callbackUrl: '/auth/signin',
      redirect: true,
    });
  };

  return (
    <Button
      onClick={handleSignOut}
      variant={variant}
      className={className}
      disabled={isLoading}
    >
      {showIcon && <LogOut className="mr-2 h-4 w-4" />}
      {isLoading ? 'Signing out...' : 'Sign out'}
    </Button>
  );
}
