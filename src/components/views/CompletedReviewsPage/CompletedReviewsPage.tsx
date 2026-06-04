"use client";

import { useReviews, Review } from "@/hooks/useData";
import { Home } from "lucide-react";
import { useRouter } from "next/navigation";
import ReviewTable from "@/components/organisms/ReviewTable/ReviewTable";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

const CompletedReviewsPage = () => {
    const router = useRouter();
    const { reviews, isLoading, isError, mutate } = useReviews('completed');

    const handleReviewClick = (review: Review) => {
        console.log("Review clicked:", review);
        // Navigate to review detail page or open review modal
        // router.push(`/platform/review/${review.id}`);
    };

    const handleDataRefresh = () => {
        console.log("Refreshing data...");
        mutate(); // This will revalidate the data
    };

    // Show error state if data fetching failed
    if (isError) {
        return (
            <div className="container mx-auto px-4 py-8 mt-8 md:mt-0">
                <div className="text-center text-red-600">
                    <p>Failed to load reviews. Please try again.</p>
                    <button
                        onClick={() => mutate()}
                        className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 mt-8 md:mt-0">
            {/* Breadcrumb */}
            <Breadcrumb className="mb-6 hidden md:block">
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/platform">
                            <Home className="h-4 w-4" />
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Completed Reviews</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Completed Reviews</h1>
                <p className="text-gray-600">
                    View and manage completed video reviews and patient feedback
                </p>
            </div>

            {isLoading ? (
                <div className="w-full mt-5 space-y-4">
                    <div className="relative w-full max-w-sm">
                        <Skeleton className="h-10 w-full" />
                    </div>
                    {/* Mobile card skeletons */}
                    <div className="block lg:hidden space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="bg-white rounded-lg border p-4 shadow-sm">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-16" />
                                        <Skeleton className="h-5 w-32" />
                                        <Skeleton className="h-4 w-40" />
                                    </div>
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-12" />
                                        <Skeleton className="h-4 w-16" />
                                    </div>
                                </div>
                                <div className="mb-3 space-y-2">
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-4 w-28" />
                                </div>
                                <div className="mb-3">
                                    <Skeleton className="h-9 w-full rounded" />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Skeleton className="h-5 w-14 rounded-full" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Desktop table skeleton */}
                    <div className="hidden lg:block overflow-hidden rounded-lg border">
                        <Table>
                            <TableHeader className="bg-secondary text-white">
                                <TableRow className="border-b">
                                    <TableHead><Skeleton className="h-4 w-16 bg-white/20" /></TableHead>
                                    <TableHead><Skeleton className="h-4 w-24 bg-white/20" /></TableHead>
                                    <TableHead><Skeleton className="h-4 w-20 bg-white/20" /></TableHead>
                                    <TableHead><Skeleton className="h-4 w-16 bg-white/20" /></TableHead>
                                    <TableHead><Skeleton className="h-4 w-20 bg-white/20" /></TableHead>
                                    <TableHead><Skeleton className="h-4 w-16 bg-white/20" /></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                        <TableCell><Skeleton className="h-8 w-14 rounded" /></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="flex items-center justify-end gap-8">
                        <Skeleton className="h-4 w-24" />
                        <div className="flex gap-2">
                            {[1, 2, 3, 4].map((i) => (
                                <Skeleton key={i} className="h-8 w-8 rounded" />
                            ))}
                        </div>
                    </div>
                </div>
            ) : reviews.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">
                    No completed reviews yet.
                </p>
            ) : (
                <ReviewTable
                    data={reviews}
                    onRowClick={handleReviewClick}
                    onDataRefresh={handleDataRefresh}
                    type="completed"
                />
            )}
        </div>
    );
};

export default CompletedReviewsPage; 