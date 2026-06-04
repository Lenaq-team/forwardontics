// Environment utility functions to handle different deployment environments

export const isVercel = process.env.VERCEL === '1';
export const isProduction = process.env.NODE_ENV === 'production';
export const isDevelopment = process.env.NODE_ENV === 'development';

// Get the base URL for the current environment
export const getBaseUrl = () => {
    if (isVercel) {
        return process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : '';
    }

    if (isDevelopment) {
        return 'http://localhost:3000';
    }

    return process.env.NEXT_PUBLIC_BASE_URL || '';
};

// Check if we should skip certain redirects to prevent loops
export const shouldSkipRedirect = (currentPath: string, targetPath: string) => {
    // Skip redirects that could cause loops
    if (currentPath === targetPath) {
        return true;
    }

    // Skip redirects between login and platform if we're in a loop
    if (
        (currentPath === '/login' && targetPath.startsWith('/platform')) ||
        (targetPath === '/login' && currentPath.startsWith('/platform'))
    ) {
        // Check if we've been redirecting recently
        const lastRedirect = sessionStorage.getItem('lastRedirect');
        const now = Date.now();

        if (lastRedirect && now - parseInt(lastRedirect) < 1000) {
            return true; // Skip if we redirected less than 1 second ago
        }

        sessionStorage.setItem('lastRedirect', now.toString());
    }

    return false;
};

// Safe redirect function that prevents loops
export const safeRedirect = (url: string) => {
    if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;

        if (shouldSkipRedirect(currentPath, url)) {
            console.log(
                'Skipping redirect to prevent loop:',
                currentPath,
                '->',
                url
            );
            return;
        }

        console.log('Safe redirect:', currentPath, '->', url);
        window.location.href = url;
    }
};

// Check if we're in a redirect loop
export const isInRedirectLoop = () => {
    if (typeof window === 'undefined') return false;

    const redirectHistory = sessionStorage.getItem('redirectHistory');
    if (!redirectHistory) return false;

    try {
        const history = JSON.parse(redirectHistory);
        const now = Date.now();

        // Clean old entries (older than 10 seconds)
        const recentHistory = history.filter(
            (entry: { timestamp: number }) => now - entry.timestamp < 10000
        );

        // Check if we have too many recent redirects
        if (recentHistory.length > 5) {
            console.warn('Potential redirect loop detected');
            return true;
        }

        // Update history
        recentHistory.push({ path: window.location.pathname, timestamp: now });
        sessionStorage.setItem(
            'redirectHistory',
            JSON.stringify(recentHistory)
        );

        return false;
    } catch (error) {
        console.error('Error checking redirect history:', error);
        return false;
    }
};
