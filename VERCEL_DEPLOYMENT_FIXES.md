# Vercel Deployment Fixes

This document explains the fixes applied to prevent redirect loops and infinite rerenders when deploying to Vercel.

## Problem Description

When deployed to Vercel, the application was experiencing:

1. **Infinite redirect loops** between login and platform pages
2. **Excessive rerenders** causing performance issues
3. **Authentication state conflicts** between server-side middleware and client-side context

## Root Causes

### 1. Middleware Redirect Loops

-   Server-side middleware was redirecting unauthenticated users to `/login`
-   Client-side UserContext was also redirecting users, creating conflicts
-   No loop detection or prevention mechanisms

### 2. Infinite Rerenders

-   UserContext had circular dependencies in useEffect hooks
-   Missing memoization causing unnecessary re-renders
-   Periodic refresh intervals triggering unnecessary API calls

### 3. Vercel-Specific Issues

-   Edge runtime differences affecting middleware behavior
-   Server-side vs client-side authentication state mismatches
-   Cookie handling differences in production vs development

## Applied Fixes

### 1. Middleware Optimization (`src/middleware.ts`)

-   **Reduced API calls**: Only verify tokens for admin/reviewer routes
-   **Better path checking**: Prevent redirects to login-related paths
-   **Error handling**: Don't redirect on verification failures, let client handle it
-   **Performance**: Reduced unnecessary token verification for basic platform routes

### 2. UserContext Improvements (`src/contexts/UserContext.tsx`)

-   **Loop prevention**: Added redirect attempt counter (max 3 attempts)
-   **Safe redirects**: Use utility functions to prevent loops
-   **Better state management**: Added `isInitialized` flag to prevent premature redirects
-   **Periodic refresh**: Only refresh when user is authenticated and initialized

### 3. LoginForm Optimization (`src/components/organisms/LoginForm/LoginForm.tsx`)

-   **Single auth check**: Only check authentication once to prevent loops
-   **Immediate redirect**: Skip user role verification after login to prevent loops
-   **Memoization**: Added React.memo and useCallback to prevent rerenders
-   **Loading states**: Better UX during authentication checks

### 4. Environment Utilities (`src/lib/utils/environment.ts`)

-   **Safe redirects**: Prevent redirect loops using session storage
-   **Loop detection**: Track redirect history and detect potential loops
-   **Environment awareness**: Handle Vercel vs development differences
-   **Rate limiting**: Prevent rapid successive redirects

### 5. Vercel Configuration (`vercel.json`)

-   **Function limits**: Set middleware timeout to 10 seconds
-   **Security headers**: Added security headers for production
-   **Route handling**: Optimized route rewrites for platform pages

## Key Changes Made

```typescript
// Before: Infinite loop prone
useEffect(() => {
    fetchUser();
}, [fetchUser]); // fetchUser changes every render!

// After: Single execution
useEffect(() => {
    fetchUser();
}, []); // No dependencies, runs once
```

```typescript
// Before: Always redirect on 401
if (response.status === 401) {
    window.location.href = '/login'; // Could cause loops
}

// After: Smart redirect with loop prevention
if (response.status === 401 && redirectAttempts < 3) {
    safeRedirect('/login'); // Prevents loops
}
```

## Testing the Fixes

### Local Development

1. Run `npm run dev`
2. Navigate to `/login`
3. Check console for render counts
4. Verify no infinite loops

### Vercel Deployment

1. Deploy to Vercel
2. Test authentication flow
3. Check for redirect loops
4. Monitor performance

### Console Monitoring

The fixes include extensive logging to help debug issues:

-   `UserContext: fetchUser called`
-   `LoginForm: Rendering`
-   `UserContext: Redirect loop detected, stopping`

## Prevention Measures

### 1. Redirect Loop Prevention

-   Maximum redirect attempts (3)
-   Time-based redirect throttling (1 second minimum)
-   Session storage tracking
-   Loop detection algorithms

### 2. Performance Optimization

-   React.memo for components
-   useCallback for event handlers
-   useMemo for computed values
-   Reduced API calls

### 3. State Management

-   Single source of truth for user state
-   Proper initialization flags
-   Controlled periodic updates
-   Error boundary handling

## Future Considerations

1. **Remove debug logging** once stable in production
2. **Add monitoring** for redirect patterns
3. **Implement retry mechanisms** for failed auth calls
4. **Add user feedback** during authentication delays

## Troubleshooting

If issues persist:

1. **Check console logs** for loop detection messages
2. **Clear browser storage** to reset redirect history
3. **Verify Vercel environment variables** are set correctly
4. **Check middleware logs** in Vercel function logs
5. **Test with different browsers** to isolate client-specific issues

## Related Files

-   `src/middleware.ts` - Server-side authentication
-   `src/contexts/UserContext.tsx` - Client-side user state
-   `src/components/organisms/LoginForm/LoginForm.tsx` - Login form
-   `src/lib/utils/environment.ts` - Environment utilities
-   `vercel.json` - Vercel configuration
