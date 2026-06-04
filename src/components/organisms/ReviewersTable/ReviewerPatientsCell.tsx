"use client";

import { Loader2 } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useAdminReviewerPatients } from "@/hooks";
import type { AdminReviewerPatient } from "@/hooks";

function ReviewerPatientsTable({ reviewerId }: { reviewerId: string }) {
    const { patients, isLoading, isError } = useAdminReviewerPatients(reviewerId);

    const subtableHeaderClass = "bg-quaternary text-neutral-900 dark:text-neutral-100";
    const tableHeaders = (
        <>
            <TableHead className={`w-[200px] ${subtableHeaderClass}`}>Patient</TableHead>
            <TableHead className={subtableHeaderClass}>Email</TableHead>
            <TableHead className={subtableHeaderClass}>Status</TableHead>
            <TableHead className={subtableHeaderClass}>Membership</TableHead>
            <TableHead className={`text-center ${subtableHeaderClass}`}>Videos</TableHead>
            <TableHead className={`text-center ${subtableHeaderClass}`}>Pending</TableHead>
            <TableHead className={`text-center ${subtableHeaderClass}`}>Completed</TableHead>
        </>
    );
    const colSpan = 7;

    if (isLoading) {
        return (
            <div className="rounded-lg border border-neutral-200 overflow-hidden dark:border-neutral-800">
                <Table>
                    <TableHeader className={subtableHeaderClass}>
                        <TableRow className={`border-neutral-200 dark:border-neutral-700 hover:opacity-100 ${subtableHeaderClass}`}>
                            {tableHeaders}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow className="bg-white">
                            <TableCell colSpan={colSpan} className="h-24">
                                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                    <Loader2 className="h-5 w-5 animate-spin shrink-0" />
                                    <span className="text-sm">Loading patients…</span>
                                </div>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        );
    }
    if (isError) {
        return (
            <div className="rounded-lg border border-neutral-200 overflow-hidden dark:border-neutral-800">
                <Table>
                    <TableHeader className={subtableHeaderClass}>
                        <TableRow className={`border-neutral-200 dark:border-neutral-700 hover:opacity-100 ${subtableHeaderClass}`}>
                            {tableHeaders}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow className="bg-white">
                            <TableCell colSpan={colSpan} className="text-sm text-destructive">
                                Failed to load patients.
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        );
    }
    if (patients.length === 0) {
        return (
            <div className="rounded-lg border border-neutral-200 overflow-hidden dark:border-neutral-800">
                <Table>
                    <TableHeader className={subtableHeaderClass}>
                        <TableRow className={`border-neutral-200 dark:border-neutral-700 hover:opacity-100 ${subtableHeaderClass}`}>
                            {tableHeaders}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow className="bg-white">
                            <TableCell colSpan={colSpan} className="text-sm text-muted-foreground">
                                No patients assigned.
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-neutral-200 overflow-hidden dark:border-neutral-800">
            <Table>
                <TableHeader className={subtableHeaderClass}>
                    <TableRow className={`border-neutral-200 dark:border-neutral-700 hover:opacity-100 ${subtableHeaderClass}`}>
                        {tableHeaders}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {patients.map((p: AdminReviewerPatient) => (
                        <TableRow key={p.id} className="bg-white">
                            <TableCell className="font-medium">{p.fullName || "—"}</TableCell>
                            <TableCell>{p.email || "—"}</TableCell>
                            <TableCell>
                                <span className="capitalize">{p.status}</span>
                            </TableCell>
                            <TableCell>
                                {p.membershipDaysRemaining != null ? (
                                    p.membershipDaysRemaining > 0 ? (
                                        `${p.membershipDaysRemaining} days left`
                                    ) : (
                                        <span className="text-destructive">Expired</span>
                                    )
                                ) : (
                                    "—"
                                )}
                            </TableCell>
                            <TableCell className="text-center tabular-nums">{p.totalUploads}</TableCell>
                            <TableCell className="text-center tabular-nums text-amber-600 dark:text-amber-400">
                                {p.pendingReviews}
                            </TableCell>
                            <TableCell className="text-center tabular-nums text-emerald-600 dark:text-emerald-400">
                                {p.completedReviews}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

export default ReviewerPatientsTable;
