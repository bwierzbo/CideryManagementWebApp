# Session Management

This document describes the session management features including session indicator and idle timeout.

## Session Indicator

The SessionIndicator component shows the current authentication status in the navbar.

### Location
`/src/components/auth/session-indicator.tsx`

### Features
- **Loading state**: Shows "Connecting..." with spinner
- **Authenticated**: Shows "Signed in" with green check icon
- **Unauthenticated**: Shows "Not signed in" with red X icon

### Usage

The SessionIndicator is automatically added to the navbar and shows the current session status.

```typescript
import { SessionIndicator } from '@/components/auth/session-indicator';

export function MyComponent() {
  return (
    <div>
      <SessionIndicator />
    </div>
  );
}
```

### Visual States

1. **Loading**
   - Badge with gray border
   - Spinning loader icon
   - Text: "Connecting..."

2. **Authenticated**
   - Badge with green border and text
   - Check circle icon
   - Text: "Signed in"

3. **Not Authenticated**
   - Badge with red border and text
   - X circle icon
   - Text: "Not signed in"

## Idle Timeout

Automatically signs out users after a period of inactivity to improve security.

### Location
`/src/lib/auth/use-idle-timeout.ts`

### Configuration

```typescript
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_TIME = 5 * 60 * 1000;  // Show warning 5 minutes before
```

### How It Works

1. **Activity Tracking**
   - Monitors user activity via events: mousedown, keydown, scroll, touchstart, click
   - Resets the idle timer on any activity
   - Only active for authenticated users

2. **Warning System**
   - Shows a warning 5 minutes before timeout
   - Currently logs to console (can be upgraded to toast notification)
   - Gives users time to stay active

3. **Automatic Signout**
   - After 30 minutes of inactivity, automatically signs out
   - Redirects to `/auth/signin?reason=idle`
   - Preserves sign-in page to show idle timeout reason

### Usage

The idle timeout is automatically enabled for all authenticated users via the IdleTimeoutProvider.

```typescript
import { useIdleTimeout } from '@/lib/auth/use-idle-timeout';

export function MyComponent() {
  useIdleTimeout(); // Automatically tracks activity
  return <div>Your content</div>;
}
```

### Implementation

The idle timeout is integrated into the root providers:

```typescript
// src/app/providers.tsx
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <IdleTimeoutProvider>
        {/* Other providers */}
      </IdleTimeoutProvider>
    </SessionProvider>
  );
}
```

### Events Monitored

The following events reset the idle timer:
- `mousedown` - Mouse clicks
- `keydown` - Keyboard input
- `scroll` - Page scrolling
- `touchstart` - Touch interactions
- `click` - Click events

### Security Benefits

1. **Automatic logout**: Prevents unauthorized access to unattended sessions
2. **Warning system**: Gives users notice before logout
3. **Activity detection**: Only considers actual user interaction
4. **Server-side protection**: Works with middleware for complete protection

### Customization

To change the timeout duration, edit the constants:

```typescript
// Shorter timeout (15 minutes)
const IDLE_TIMEOUT = 15 * 60 * 1000;
const WARNING_TIME = 2 * 60 * 1000; // Warning at 2 minutes before

// Longer timeout (60 minutes)
const IDLE_TIMEOUT = 60 * 60 * 1000;
const WARNING_TIME = 10 * 60 * 1000; // Warning at 10 minutes before
```

### Adding Toast Notifications

To show a toast warning instead of console.warn:

```typescript
import { toast } from '@/components/ui/use-toast';

// In use-idle-timeout.ts
warningRef.current = setTimeout(() => {
  toast({
    title: 'Session Expiring Soon',
    description: 'You will be signed out due to inactivity in 5 minutes',
    variant: 'warning',
  });
}, IDLE_TIMEOUT - WARNING_TIME);
```

## Integration with Middleware

The session management works in conjunction with the Next.js middleware:

1. **Client-side**: IdleTimeout monitors activity and triggers signout
2. **Server-side**: Middleware validates session on every request
3. **Combined**: Provides complete session protection

## Testing

### Test Idle Timeout

1. Sign in to the application
2. Wait 25 minutes without activity
3. You should see a warning in the console at 25 minutes
4. Wait 5 more minutes (30 total)
5. You should be automatically signed out and redirected to signin

### Test Session Indicator

1. View the navbar before signing in → See "Not signed in" (red)
2. Sign in → See "Signed in" (green)
3. Sign out → See "Not signed in" (red)
4. During page load → See "Connecting..." (gray)

## Browser Compatibility

The idle timeout works in all modern browsers that support:
- `setTimeout` / `clearTimeout`
- Event listeners (`addEventListener` / `removeEventListener`)
- NextAuth session management

## Performance Considerations

- Event listeners are cleaned up on component unmount
- Timers are cleared when reset to prevent memory leaks
- Only active for authenticated users
- Minimal performance impact

## Security Considerations

- Timeout cannot be bypassed on client side (middleware enforces)
- Session token is properly cleared on signout
- Redirect includes reason parameter for auditing
- Works with existing RBAC and route protection

## Future Enhancements

1. **Configurable timeout**: Allow users to set their own timeout duration
2. **Activity indicator**: Show time until timeout in UI
3. **Keep-alive option**: Allow users to stay signed in
4. **Session extension**: Prompt user to extend session before timeout
5. **Multiple device tracking**: Track sessions across devices
