"use client";

import { useVideos } from "@/hooks/useData";
import { Home } from "lucide-react";
import VideoTable from "@/components/organisms/VideoTable/VideoTable";
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

const MyVideosPage = () => {
    const { videos, isLoading } = useVideos();

    return (
        <div className="p-4  space-y-6">
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
                        <BreadcrumbPage>My Videos</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div>
                {isLoading ? (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Skeleton className="h-10 flex-1 max-w-md" />
                            <Skeleton className="h-10 w-[200px]" />
                        </div>
                        {/* Mobile card skeletons */}
                        <div className="block lg:hidden space-y-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="bg-white rounded-lg border p-4 shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="space-y-2">
                                            <Skeleton className="h-4 w-24" />
                                            <Skeleton className="h-4 w-36" />
                                        </div>
                                        <Skeleton className="h-10 w-10 rounded" />
                                    </div>
                                    <div className="mb-3 space-y-2">
                                        <Skeleton className="h-4 w-20" />
                                        <Skeleton className="h-4 w-16" />
                                    </div>
                                    <div className="mb-3">
                                        <Skeleton className="h-5 w-20 rounded-full" />
                                    </div>
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-16" />
                                        <Skeleton className="h-4 w-full" />
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Desktop table skeleton */}
                        <div className="hidden lg:block overflow-hidden rounded-lg border">
                            <Table>
                                <TableHeader className="bg-secondary">
                                    <TableRow className="border-b">
                                        <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                                        <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                                        <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                                        <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                                        <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                                        <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {[1, 2, 3, 4, 5, 6].map((i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="flex items-center justify-end gap-8">
                            <div className="hidden lg:flex items-center gap-2">
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-9 w-20" />
                            </div>
                            <Skeleton className="h-4 w-24" />
                            <div className="flex gap-2">
                                {[1, 2, 3, 4].map((i) => (
                                    <Skeleton key={i} className="h-8 w-8 rounded" />
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <VideoTable data={videos} />
                )}
            </div>
        </div>
    );
};

export default MyVideosPage; 