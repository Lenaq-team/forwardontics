"use client";

import { useState } from "react";
import { Home, UserPlus } from "lucide-react";
import ReviewersTable from "@/components/organisms/ReviewersTable/ReviewersTable";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { CreateReviewerDialog } from "@/components/CreateReviewerDialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useAdminReviewers } from "@/hooks/useData";

const AdminPage = () => {
    const { reviewers, isLoading, isError, mutate } = useAdminReviewers();
    const [createReviewerOpen, setCreateReviewerOpen] = useState(false);

    // Show error state if data fetching failed
    if (isError) {
        return (
            <div className=" p-4  space-y-6">
                <div className="text-center text-red-600">
                    <p>Failed to load users. Please try again.</p>
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
        <div className=" p-4 space-y-6">
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
                        <BreadcrumbLink href="/platform/admin">Admin</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Users</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
                    <h2 className="text-lg font-semibold">Reviewers</h2>
                    <Button
                        onClick={() => setCreateReviewerOpen(true)}
                        className="w-fit bg-accent hover:bg-accent/90 text-white"
                    >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Create reviewer
                    </Button>
                </div>
                <CreateReviewerDialog
                    open={createReviewerOpen}
                    onOpenChange={setCreateReviewerOpen}
                    onSuccess={mutate}
                />
                {isLoading ? (
                    <div className="space-y-4">
                        <div className="p-4">
                            <Skeleton className="h-10 max-w-sm" />
                        </div>
                        {/* Mobile card skeletons */}
                        <div className="block lg:hidden space-y-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="bg-white rounded-lg border p-4 shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="space-y-2">
                                            <Skeleton className="h-4 w-12" />
                                            <Skeleton className="h-5 w-28" />
                                        </div>
                                        <div className="space-y-2">
                                            <Skeleton className="h-4 w-10" />
                                            <Skeleton className="h-4 w-16" />
                                        </div>
                                    </div>
                                    <div className="mb-3 space-y-2">
                                        <Skeleton className="h-4 w-12" />
                                        <Skeleton className="h-4 w-40" />
                                    </div>
                                    <div className="mb-3 space-y-2">
                                        <Skeleton className="h-4 w-14" />
                                        <div className="flex gap-2">
                                            <Skeleton className="h-6 w-14 rounded-full" />
                                            <Skeleton className="h-6 w-16 rounded-full" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-12" />
                                        <Skeleton className="h-4 w-24" />
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Desktop table skeleton */}
                        <div className="hidden lg:block overflow-hidden rounded-lg border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead><Skeleton className="h-4 w-8" /></TableHead>
                                        <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                                        <TableHead><Skeleton className="h-4 w-32" /></TableHead>
                                        <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                                        <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {[1, 2, 3, 4, 5, 6].map((i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                ) : reviewers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-12">
                        No reviewers found.
                    </p>
                ) : (
                    <ReviewersTable data={reviewers} />
                )}
            </div>
        </div>
    );
};

export default AdminPage;
