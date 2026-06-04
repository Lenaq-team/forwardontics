"use client";

import { useState, useCallback } from "react";

interface ProxyVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
    /** Proxy URL e.g. /api/videos/proxy?key=X&bucket=Y */
    src: string;
}

/** Video that loads from proxy with retry on error and playsInline for mobile. */
export function ProxyVideo({ src, onError, className, ...props }: ProxyVideoProps) {
    const [retryCount, setRetryCount] = useState(0);
    const [loadError, setLoadError] = useState(false);

    const effectiveSrc =
        retryCount > 0 ? `${src}${src.includes("?") ? "&" : "?"}_retry=1` : src;

    const handleError = useCallback(
        (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
            if (retryCount < 1) {
                setRetryCount(1);
            } else {
                setLoadError(true);
                onError?.(e);
            }
        },
        [retryCount, onError]
    );

    if (loadError) {
        return (
            <div className="flex items-center justify-center w-full aspect-video bg-muted rounded-lg text-muted-foreground text-sm p-4 text-center">
                Video couldn&apos;t load. Try again later.
            </div>
        );
    }

    return (
        <video
            {...props}
            src={effectiveSrc}
            playsInline
            onError={handleError}
            className={className}
        />
    );
}
