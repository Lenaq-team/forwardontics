import { SWRConfiguration } from 'swr';

// Custom fetcher with credentials for auth
export const fetcher = async (url: string) => {
    const response = await fetch(url, {
        credentials: 'include',
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
    }
    return response.json();
};

// Global SWR configuration
export const swrConfig: SWRConfiguration = {
    fetcher,
    revalidateOnFocus: true, // Refresh data when user returns to tab
    revalidateOnReconnect: true,
    dedupingInterval: 2000, // 2s dedupe for faster navigation
    errorRetryCount: 2,
    errorRetryInterval: 5000,
    keepPreviousData: true,
};
