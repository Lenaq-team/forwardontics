"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { safeRedirect, isInRedirectLoop } from '@/lib/utils/environment';

interface User {
    role: string;
    groups: string[];
    email: string;
    name: string;
    avatar?: string;
    // Add other user properties as needed
}

interface UserContextType {
    user: User | null;
    loading: boolean;
    roles: string[];
    isLoggingOut: boolean;
    logout: () => void;
    refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// Cache key for localStorage
const USER_CACHE_KEY = 'forwardontics_user_cache';
const USER_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Cache interface
interface UserCache {
    user: User;
    timestamp: number;
}

export const UserProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [redirectAttempts, setRedirectAttempts] = useState(0);
    const [lastFetchTime, setLastFetchTime] = useState<number>(0);

    // Load user from cache if available and not expired
    const loadFromCache = useCallback((): User | null => {
        try {
            const cached = localStorage.getItem(USER_CACHE_KEY);
            if (cached) {
                const userCache: UserCache = JSON.parse(cached);
                const now = Date.now();

                // Check if cache is still valid (within 30 minutes)
                if (now - userCache.timestamp < USER_CACHE_DURATION) {
                    console.log('UserContext: Loading user from cache');
                    return userCache.user;
                } else {
                    // Cache expired, remove it
                    localStorage.removeItem(USER_CACHE_KEY);
                }
            }
        } catch (error) {
            console.warn('UserContext: Failed to load from cache:', error);
            localStorage.removeItem(USER_CACHE_KEY);
        }
        return null;
    }, []);

    // Save user to cache
    const saveToCache = useCallback((userData: User) => {
        try {
            const userCache: UserCache = {
                user: userData,
                timestamp: Date.now()
            };
            localStorage.setItem(USER_CACHE_KEY, JSON.stringify(userCache));
        } catch (error) {
            console.warn('UserContext: Failed to save to cache:', error);
        }
    }, []);

    // Clear cache
    const clearCache = useCallback(() => {
        try {
            localStorage.removeItem(USER_CACHE_KEY);
        } catch (error) {
            console.warn('UserContext: Failed to clear cache:', error);
        }
    }, []);

    const fetchUser = useCallback(async (forceRefresh = false) => {
        console.log('UserContext: fetchUser called, forceRefresh:', forceRefresh);

        // Check for redirect loops
        if (isInRedirectLoop()) {
            console.warn('UserContext: Redirect loop detected, stopping');
            setLoading(false);
            setIsInitialized(true);
            return;
        }

        // Don't fetch if we have a recent fetch (within 5 minutes) unless forced
        const now = Date.now();
        if (!forceRefresh && now - lastFetchTime < 5 * 60 * 1000) {
            console.log('UserContext: Skipping fetch, too recent');
            return;
        }

        try {
            const response = await fetch('/api/auth/me', {
                credentials: 'include', // Include cookies
            });

            if (response.ok) {
                const userData = await response.json();
                console.log('UserContext: User authenticated:', userData);

                // Ensure user has required properties with fallbacks
                const userWithDefaults: User = {
                    ...userData,
                    name: userData.name || userData.email?.split('@')[0] || 'User',
                    avatar: userData.avatar || '', // Default avatar
                };

                setUser(userWithDefaults);
                setLastFetchTime(now);
                saveToCache(userWithDefaults);

                // Reset redirect attempts on successful auth
                setRedirectAttempts(0);
            } else if (response.status === 401) {
                // Token expired or invalid
                console.log('UserContext: User not authenticated (401)');
                setUser(null);
                clearCache();

                // Only redirect if we're not already on login page and this is not the initial load
                // Also prevent infinite redirect loops
                if (isInitialized &&
                    window.location.pathname !== '/login' &&
                    redirectAttempts < 3) {
                    console.log('UserContext: Redirecting to login');
                    setRedirectAttempts(prev => prev + 1);
                    // Use safe redirect to prevent loops
                    safeRedirect('/login');
                }
            }
        } catch (error) {
            console.error('UserContext: Failed to fetch user:', error);
            setUser(null);
        } finally {
            setLoading(false);
            setIsInitialized(true);
        }
    }, [isInitialized, redirectAttempts, lastFetchTime, saveToCache, clearCache]);

    const refreshUser = useCallback(async () => {
        console.log('UserContext: refreshUser called');
        await fetchUser(true); // Force refresh
    }, [fetchUser]);

    const logout = useCallback(() => {
        console.log('UserContext: logout called');
        setIsLoggingOut(true);
        setUser(null);
        setRedirectAttempts(0);
        clearCache();

        // Clear cookies via API
        fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        // Use safe redirect to prevent loops
        safeRedirect('/login');
    }, [clearCache]);

    // Initialize user data on mount
    useEffect(() => {
        console.log('UserContext: Initial effect');

        // Try to load from cache first
        const cachedUser = loadFromCache();
        if (cachedUser) {
            setUser(cachedUser);
            setLoading(false);
            setIsInitialized(true);
            console.log('UserContext: User loaded from cache');
        } else {
            // No cache, fetch from server
            fetchUser();
        }
    }, []); // Empty dependency array - only run once on mount

    // Refresh user data periodically (every 30 minutes) - only when user is authenticated
    useEffect(() => {
        if (!user || !isInitialized) return;

        console.log('UserContext: Setting up periodic refresh (30 minutes)');
        const interval = setInterval(() => {
            console.log('UserContext: Periodic refresh');
            fetchUser(); // Not forced, will respect cache timing
        }, 30 * 60 * 1000); // 30 minutes

        return () => {
            console.log('UserContext: Clearing periodic refresh');
            clearInterval(interval);
        };
    }, [user, isInitialized, fetchUser]);

    // Roles = Cognito groups only. "User"/"Reviewer"/"Admin" in access means group membership.
    const roles = useMemo(() => {
        const groups = user?.groups ?? [];
        console.log('UserContext: Roles (Cognito groups):', groups);
        return groups;
    }, [user?.groups]);

    // Memoize context value to prevent unnecessary re-renders
    const contextValue = useMemo(() => {
        console.log('UserContext: Context value computed');
        return {
            user,
            loading,
            roles,
            isLoggingOut,
            logout,
            refreshUser
        };
    }, [user, loading, roles, isLoggingOut, logout, refreshUser]);

    console.log('UserContext: Rendering with user:', user?.email, 'loading:', loading);

    return (
        <UserContext.Provider value={contextValue}>
            {children}
            {isLoggingOut && (
                <div
                    className="fixed inset-0 z-[99999] flex items-center justify-center bg-background/95 backdrop-blur-sm"
                    aria-hidden="true"
                >
                    <div className="flex flex-col items-center gap-4">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-foreground" />
                        <p className="text-muted-foreground text-sm">Logging out…</p>
                    </div>
                </div>
            )}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
