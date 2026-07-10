"use client";

import { Fragment, useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, MoreVertical, KeyRound, Key, Copy, Check } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { AdminReviewer } from "@/hooks";
import ReviewerPatientsTable from "./ReviewerPatientsCell";

type ReviewerActionType = "reset-email" | "reset-temp";

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium bg-neutral-100 hover:bg-neutral-200 transition-colors"
            title="Copy to clipboard"
        >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
        </button>
    );
}

function ReviewerRowActions({ reviewer }: { reviewer: AdminReviewer }) {
    const [actionModal, setActionModal] = useState<ReviewerActionType | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [tempPassword, setTempPassword] = useState<string | null>(null);

    function openAction(type: ReviewerActionType) {
        setTempPassword(null);
        setActionModal(type);
    }

    function closeModal() {
        setActionModal(null);
        setTempPassword(null);
    }

    async function handleAction() {
        if (!actionModal) return;

        if (actionModal === "reset-temp" && tempPassword) {
            closeModal();
            return;
        }

        setSubmitting(true);
        try {
            if (actionModal === "reset-email") {
                setActionModal(null);
                const res = await fetch(`/api/admin/reviewers/${reviewer.id}/reset-password`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ method: "email" }),
                });
                if (!res.ok) {
                    const b = await res.json().catch(() => ({}));
                    throw new Error(b.error ?? `Request failed (${res.status})`);
                }
                toast.success(`Reset email sent to ${reviewer.email}.`);
            } else {
                const res = await fetch(`/api/admin/reviewers/${reviewer.id}/reset-password`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ method: "temporary" }),
                });
                if (!res.ok) {
                    const b = await res.json().catch(() => ({}));
                    throw new Error(b.error ?? `Request failed (${res.status})`);
                }
                const data: { temporaryPassword?: string } = await res.json();
                setTempPassword(data.temporaryPassword ?? null);
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Action failed.");
            closeModal();
        } finally {
            setSubmitting(false);
        }
    }

    const isResetTemp = actionModal === "reset-temp";

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center rounded p-1.5 text-muted-foreground hover:bg-neutral-100 transition-colors"
                        aria-label="Reviewer actions"
                    >
                        <MoreVertical className="h-4 w-4" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem className="gap-2" onSelect={() => openAction("reset-email")}>
                        <KeyRound className="h-4 w-4" />
                        Send reset email
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2" onSelect={() => openAction("reset-temp")}>
                        <Key className="h-4 w-4" />
                        Set temporary password
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={actionModal !== null} onOpenChange={(open) => { if (!open) closeModal(); }}>
                <DialogContent showCloseButton={false} onClick={(e) => e.stopPropagation()}>
                    <DialogHeader>
                        <DialogTitle>
                            {isResetTemp
                                ? tempPassword ? "Temporary password set" : "Set temporary password"
                                : "Send password reset email"}
                        </DialogTitle>
                        <DialogDescription>
                            {isResetTemp
                                ? tempPassword
                                    ? `Share this temporary password with ${reviewer.fullname || reviewer.email}. They will be required to change it on next login.`
                                    : `Generate and set a temporary password for ${reviewer.fullname || reviewer.email}? They will be required to change it on next login.`
                                : `Send a password reset email to ${reviewer.email}? Cognito will email them a verification code to set a new password.`}
                        </DialogDescription>
                    </DialogHeader>

                    {isResetTemp && tempPassword && (
                        <div className="flex items-center gap-2 rounded-md border bg-neutral-50 px-3 py-2 dark:bg-neutral-900">
                            <code className="flex-1 text-sm font-mono tracking-wider break-all">{tempPassword}</code>
                            <CopyButton text={tempPassword} />
                        </div>
                    )}

                    <DialogFooter className="justify-end">
                        {!tempPassword && (
                            <Button variant="outline" onClick={closeModal} disabled={submitting}>
                                Cancel
                            </Button>
                        )}
                        <Button
                            className="bg-accent text-white hover:bg-accent/90"
                            onClick={handleAction}
                            disabled={submitting}
                        >
                            {submitting
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : isResetTemp
                                    ? tempPassword ? "Close" : "Generate & set"
                                    : "Send email"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];

interface EditableCellProps {
    reviewer: AdminReviewer;
    onSaved: () => void;
}

function NameCell({ reviewer, onSaved }: EditableCellProps) {
    const currentName = reviewer.fullname || reviewer.email || "—";
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(reviewer.fullname);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [editing]);

    const save = async () => {
        const trimmed = value.trim();
        if (!trimmed) {
            setError("Name cannot be empty");
            return;
        }
        if (trimmed === reviewer.fullname) {
            setEditing(false);
            setError(null);
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/reviewers/${reviewer.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fullname: trimmed }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error ?? "Failed to save");
            }
            setEditing(false);
            onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    const cancel = () => {
        setValue(reviewer.fullname);
        setEditing(false);
        setError(null);
    };

    if (!editing) {
        return (
            <button
                className="w-full text-left font-medium hover:underline hover:text-primary cursor-pointer rounded px-1"
                title="Click to edit name"
                onClick={(e) => {
                    e.stopPropagation();
                    setValue(reviewer.fullname);
                    setEditing(true);
                }}
            >
                {currentName}
            </button>
        );
    }

    return (
        <div
            className="flex flex-col gap-1"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-center gap-1">
                <Input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") save();
                        if (e.key === "Escape") cancel();
                    }}
                    onBlur={save}
                    className="h-7 text-sm min-w-[140px]"
                    disabled={saving}
                />
                {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
            </div>
            {error && (
                <span className="text-xs text-red-500">{error}</span>
            )}
        </div>
    );
}

interface MaxCapacityCellProps {
    reviewer: AdminReviewer;
    onSaved: () => void;
}

function MaxCapacityCell({ reviewer, onSaved }: MaxCapacityCellProps) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(String(reviewer.maxPatientCapacity));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [editing]);

    const save = async () => {
        const parsed = parseInt(value, 10);
        if (isNaN(parsed) || parsed < 0) {
            setError("Must be a non-negative integer");
            return;
        }
        if (parsed === reviewer.maxPatientCapacity) {
            setEditing(false);
            setError(null);
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/reviewers/${reviewer.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ maxPatientCapacity: parsed }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error ?? "Failed to save");
            }
            setEditing(false);
            onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    const cancel = () => {
        setValue(String(reviewer.maxPatientCapacity));
        setEditing(false);
        setError(null);
    };

    if (!editing) {
        return (
            <button
                className="w-full tabular-nums text-center hover:underline hover:text-primary cursor-pointer rounded px-1"
                title="Click to edit max capacity"
                onClick={(e) => {
                    e.stopPropagation();
                    setValue(String(reviewer.maxPatientCapacity));
                    setEditing(true);
                }}
            >
                {reviewer.maxPatientCapacity}
            </button>
        );
    }

    return (
        <div
            className="flex flex-col items-center gap-1"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-center gap-1">
                <Input
                    ref={inputRef}
                    type="number"
                    min={0}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") save();
                        if (e.key === "Escape") cancel();
                    }}
                    onBlur={save}
                    className="w-20 h-7 text-center text-sm"
                    disabled={saving}
                />
                {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {error && (
                <span className="text-xs text-red-500">{error}</span>
            )}
        </div>
    );
}

const ReviewersTable = ({
    data,
    onCapacityUpdated,
}: {
    data: AdminReviewer[];
    onCapacityUpdated?: () => void;
}) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(10);

    const pageCount = Math.max(1, Math.ceil(data.length / pageSize));
    const paginatedData = data.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

    useEffect(() => {
        setExpandedId(null);
        setPageIndex((i) => Math.min(i, pageCount - 1));
    }, [pageSize, pageCount]);

    const toggleExpand = (id: string) => {
        setExpandedId((prev) => (prev === id ? null : id));
    };

    return (
        <div className="w-full">
            <div className="overflow-hidden rounded-lg border">
                <Table>
                    <TableHeader className="bg-secondary text-white">
                        <TableRow className="bg-secondary text-white border-secondary hover:bg-secondary">
                            <TableHead className="w-10 text-white"></TableHead>
                            <TableHead className="text-white">Reviewer</TableHead>
                            <TableHead className="text-white">Email</TableHead>
                            <TableHead className="text-white text-center">Patients</TableHead>
                            <TableHead className="text-white text-center">Pending</TableHead>
                            <TableHead className="text-white text-center">Completed</TableHead>
                            <TableHead className="text-white text-center">Max capacity</TableHead>
                            <TableHead className="text-white text-center">Capacity expires</TableHead>
                            <TableHead className="w-[50px] text-white" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                    {paginatedData.map((reviewer) => {
                        const isExpanded = expandedId === reviewer.id;
                        return (
                            <Fragment key={reviewer.id}>
                                <TableRow
                                    key={reviewer.id}
                                    className="bg-white cursor-pointer"
                                    onClick={() => toggleExpand(reviewer.id)}
                                >
                                    <TableCell className="w-10">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleExpand(reviewer.id);
                                            }}
                                        >
                                            {isExpanded ? (
                                                <ChevronDown className="h-4 w-4" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <NameCell
                                            reviewer={reviewer}
                                            onSaved={onCapacityUpdated ?? (() => {})}
                                        />
                                    </TableCell>
                                    <TableCell>{reviewer.email || "—"}</TableCell>
                                    <TableCell className="text-center tabular-nums">
                                        {reviewer.patientCount}
                                    </TableCell>
                                    <TableCell className="text-center tabular-nums text-amber-600 dark:text-amber-400">
                                        {reviewer.pendingReviews}
                                    </TableCell>
                                    <TableCell className="text-center tabular-nums text-emerald-600 dark:text-emerald-400">
                                        {reviewer.completedReviews}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <MaxCapacityCell
                                            reviewer={reviewer}
                                            onSaved={onCapacityUpdated ?? (() => {})}
                                        />
                                    </TableCell>
                                    <TableCell className="text-center text-muted-foreground">
                                        {reviewer.membershipExpiresAt
                                            ? new Date(reviewer.membershipExpiresAt).toLocaleDateString("en-US", {
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric",
                                            })
                                            : "—"}
                                    </TableCell>
                                    <TableCell className="text-right pr-2" onClick={(e) => e.stopPropagation()}>
                                        <ReviewerRowActions reviewer={reviewer} />
                                    </TableCell>
                                </TableRow>
                                {isExpanded && (
                                    <TableRow key={`${reviewer.id}-patients`} className="bg-white">
                                        <TableCell colSpan={9} className="p-0 align-top">
                                            <div className="border-t border-neutral-200 bg-neutral-50/50 px-6 py-2 dark:border-neutral-800 dark:bg-neutral-900/30">
                                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                                    Assigned patients
                                                </p>
                                                <ReviewerPatientsTable reviewerId={reviewer.id} />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </Fragment>
                        );
                    })}
                    </TableBody>
                </Table>
            </div>
            <div className="flex w-full items-center justify-end px-4 mt-5">
                <div className="flex w-full items-center gap-8 lg:w-fit">
                    <div className="hidden items-center gap-2 lg:flex">
                        <Label htmlFor="reviewers-rows-per-page" className="text-sm font-medium">
                            Rows per page
                        </Label>
                        <Select
                            value={`${pageSize}`}
                            onValueChange={(value) => setPageSize(Number(value))}
                        >
                            <SelectTrigger size="sm" className="w-20 bg-white" id="reviewers-rows-per-page">
                                <SelectValue placeholder={pageSize} />
                            </SelectTrigger>
                            <SelectContent side="top">
                                {PAGE_SIZE_OPTIONS.map((size) => (
                                    <SelectItem key={size} value={`${size}`}>
                                        {size}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex w-fit items-center justify-center text-sm font-medium">
                        Page {pageIndex + 1} of {pageCount}
                    </div>
                    <div className="ml-auto flex gap-2 lg:ml-0">
                        <Button
                            variant="outline"
                            className="hidden h-8 w-8 p-0 lg:flex"
                            onClick={() => setPageIndex(0)}
                            disabled={pageIndex <= 0}
                        >
                            <span className="sr-only">Go to first page</span>
                            <ChevronsLeft />
                        </Button>
                        <Button
                            variant="outline"
                            className="size-8"
                            size="icon"
                            onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                            disabled={pageIndex <= 0}
                        >
                            <span className="sr-only">Go to previous page</span>
                            <ChevronLeft />
                        </Button>
                        <Button
                            variant="outline"
                            className="size-8"
                            size="icon"
                            onClick={() => setPageIndex((i) => Math.min(pageCount - 1, i + 1))}
                            disabled={pageIndex >= pageCount - 1}
                        >
                            <span className="sr-only">Go to next page</span>
                            <ChevronRight />
                        </Button>
                        <Button
                            variant="outline"
                            className="hidden size-8 lg:flex"
                            size="icon"
                            onClick={() => setPageIndex(pageCount - 1)}
                            disabled={pageIndex >= pageCount - 1}
                        >
                            <span className="sr-only">Go to last page</span>
                            <ChevronsRight />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReviewersTable;
