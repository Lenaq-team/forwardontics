import { NextRequest, NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const token = req.cookies.get('idToken')?.value;
    const referer = req.headers.get('referer');

    // Allow access to public pages without authentication
    if (
        pathname === '/unauthorized' ||
        pathname === '/login' ||
        pathname === '/login/forgot-password' ||
        pathname === '/terms'
    ) {
        return NextResponse.next();
    }

    // If coming from login page, allow the redirect to complete
    if (referer && referer.includes('/login')) {
        return NextResponse.next();
    }

    // Handle root: always show landing page. Don't redirect authenticated users away.
    if (pathname === '/') {
        return NextResponse.next();
    }

    // For platform routes, check authentication
    if (pathname.startsWith('/platform')) {
        if (!token) {
            // Don't redirect if we're already on a login-related path
            if (pathname.includes('login')) {
                return NextResponse.next();
            }
            return NextResponse.redirect(new URL('/login', req.url));
        }

        // Only verify token for admin/reviewer routes to reduce API calls
        if (
            pathname.startsWith('/platform/admin') ||
            pathname.startsWith('/platform/reviewer')
        ) {
            try {
                // Call the verify-token API endpoint
                const verifyResponse = await fetch(
                    `${req.nextUrl.origin}/api/auth/verify-token`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ token }),
                    }
                );

                if (!verifyResponse.ok) {
                    return NextResponse.redirect(new URL('/login', req.url));
                }

                const verifyData = await verifyResponse.json();

                if (!verifyData.success) {
                    return NextResponse.redirect(new URL('/login', req.url));
                }

                const { user } = verifyData;
                const groups = user?.groups ?? [];

                // Use Cognito groups only - "Admin"/"Reviewer" means group membership
                const roles = groups;

                // Protect /admin routes
                if (
                    pathname.startsWith('/platform/admin/') &&
                    !roles.includes('Admin')
                ) {
                    return NextResponse.redirect(
                        new URL('/unauthorized', req.url)
                    );
                }

                // Protect /reviewer routes (Reviewer, Admin, or Reviewer-test)
                if (
                    pathname.startsWith('/platform/reviewer') &&
                    !roles.includes('Reviewer') &&
                    !roles.includes('Reviewer-test')
                ) {
                    return NextResponse.redirect(
                        new URL('/unauthorized', req.url)
                    );
                }
            } catch (error) {
                console.error('Token verification failed:', error);
                // On error, don't redirect - let the client handle it
                return NextResponse.next();
            }
        }

        return NextResponse.next();
    }

    // For all other routes, just check if token exists
    if (!token) {
        return NextResponse.redirect(new URL('/login', req.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/',
        '/platform/admin/:path*',
        '/platform/reviewer/:path*',
        '/platform/:path*',
        '/platform/admin',
        '/unauthorized',
    ],
};
