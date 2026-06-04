"use client";

import { useReviews } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const SWRDemo = () => {
    const { reviews, isLoading, isError, mutate } = useReviews('completed');

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>SWR Demo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <p className="text-sm text-gray-600">
                        This component demonstrates SWR&apos;s caching capabilities:
                    </p>
                    <ul className="text-xs text-gray-500 mt-2 space-y-1">
                        <li>• Data is cached and won&apos;t reload on every render</li>
                        <li>• Use the refresh button to manually revalidate</li>
                        <li>• Data persists across component unmounts/remounts</li>
                        <li>• Automatic error handling and retry</li>
                    </ul>
                </div>

                <div className="text-center">
                    <p className="text-sm font-medium">
                        Reviews loaded: {reviews?.length || 0}
                    </p>
                    <p className="text-xs text-gray-500">
                        Status: {isLoading ? 'Loading...' : isError ? 'Error' : 'Ready'}
                    </p>
                </div>

                <div className="flex gap-2">
                    <Button
                        onClick={() => mutate()}
                        variant="outline"
                        size="sm"
                        disabled={isLoading}
                    >
                        Refresh Data
                    </Button>
                    <Button
                        onClick={() => mutate([], { revalidate: false })}
                        variant="outline"
                        size="sm"
                    >
                        Clear Cache
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};
