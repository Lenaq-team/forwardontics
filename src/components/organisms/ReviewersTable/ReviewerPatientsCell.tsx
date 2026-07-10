"use client";

import { useState } from "react";
import { Loader2, Trash2, Ban, CheckCircle2, CalendarPlus, MoreVertical, KeyRound, Key, Copy, Check } from "lucide-react";
import { toast } from "sonner";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
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
import { useAdminReviewerPatients } from "@/hooks";
import type { AdminReviewerPatient } from "@/hooks";

type ActionType = "disable" | "enable" | "extend" | "delete" | "reset-email" | "reset-temp";

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

function ReviewerPatientsTable({ reviewerId }: { reviewerId: string }) {
    const { patients, isLoading, isError, mutate } = useAdminReviewerPatients(reviewerId);

    const [actionModal, setActionModal] = useState<{
        type: ActionType;
        patient: AdminReviewerPatient;
    } | null>(null);
    const [days, setDays] = useState("30");
    const [submitting, setSubmitting] = useState(false);
    const [tempPassword, setTempPassword] = useState<string | null>(null);

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
            <TableHead className={`w-[50px] ${subtableHeaderClass}`} />
        </>
    );
    const colSpan = 8;

    function openAction(type: ActionType, patient: AdminReviewerPatient) {
        setDays("30");
        setTempPassword(null);
        setActionModal({ type, patient });
    }

    function closeModal() {
        setActionModal(null);
        setTempPassword(null);
    }

    async function handleAction() {
        if (!actionModal) return;
        const { type, patient } = actionModal;

        if (type === "reset-temp" && tempPassword) {
            closeModal();
            return;
        }

        setSubmitting(true);
        try {
            if (type === "delete") {
                setActionModal(null);
                const res = await fetch(`/api/admin/patients/${patient.id}`, { method: "DELETE" });
                if (!res.ok) {
                    const b = await res.json().catch(() => ({}));
                    throw new Error(b.error ?? `Request failed (${res.status})`);
                }
                await mutate();
                toast.success(`${patient.fullName || patient.email || "Patient"} has been deleted.`);

            } else if (type === "reset-email") {
                setActionModal(null);
                const res = await fetch(`/api/admin/patients/${patient.id}/reset-password`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ method: "email" }),
                });
                if (!res.ok) {
                    const b = await res.json().catch(() => ({}));
                    throw new Error(b.error ?? `Request failed (${res.status})`);
                }
                toast.success(`Reset email sent to ${patient.email}.`);

            } else if (type === "reset-temp") {
                const res = await fetch(`/api/admin/patients/${patient.id}/reset-password`, {
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

            } else {
                // disable / enable / extend
                const payload: { action: string; days?: number } = { action: type };
                if (type === "enable" || type === "extend") payload.days = parseInt(days, 10);
                setActionModal(null);
                const res = await fetch(`/api/admin/patients/${patient.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) {
                    const b = await res.json().catch(() => ({}));
                    throw new Error(b.error ?? `Request failed (${res.status})`);
                }
                const data: { membershipExpiresAt?: string } = await res.json();
                await mutate();
                const name = patient.fullName || patient.email || "Patient";
                if (type === "disable") toast.success(`${name} has been disabled.`);
                else if (type === "enable") {
                    const exp = data.membershipExpiresAt ? new Date(data.membershipExpiresAt).toLocaleDateString() : "";
                    toast.success(`${name} enabled until ${exp}.`);
                } else {
                    const exp = data.membershipExpiresAt ? new Date(data.membershipExpiresAt).toLocaleDateString() : "";
                    toast.success(`Membership extended. New expiry: ${exp}.`);
                }
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Action failed.");
        } finally {
            setSubmitting(false);
        }
    }

    type DialogConfig = {
        title: string;
        description: (name: string, email: string) => string;
        confirmLabel: string;
        confirmClass: string;
        showDaysInput: boolean;
    };

    const dialogConfig: Record<ActionType, DialogConfig> = {
        disable: {
            title: "Disable patient",
            description: (name) => `Disable ${name}? Their membership will be revoked immediately and they will be blocked from uploading videos.`,
            confirmLabel: "Disable",
            confirmClass: "bg-destructive text-white hover:bg-destructive/90",
            showDaysInput: false,
        },
        enable: {
            title: "Enable patient",
            description: (name) => `How many days should ${name}'s membership be active?`,
            confirmLabel: "Enable",
            confirmClass: "bg-emerald-600 text-white hover:bg-emerald-600/90",
            showDaysInput: true,
        },
        extend: {
            title: "Extend membership",
            description: (name) => `How many days do you want to add to ${name}'s membership?`,
            confirmLabel: "Extend",
            confirmClass: "bg-accent text-white hover:bg-accent/90",
            showDaysInput: true,
        },
        delete: {
            title: "Delete patient",
            description: (name) => `Are you sure you want to permanently delete ${name}? This will remove their account from Cognito, all their video uploads, and cannot be undone.`,
            confirmLabel: "Delete",
            confirmClass: "bg-destructive text-white hover:bg-destructive/90",
            showDaysInput: false,
        },
        "reset-email": {
            title: "Send password reset email",
            description: (_, email) => `Send a password reset email to ${email}? Cognito will email them a verification code to set a new password.`,
            confirmLabel: "Send email",
            confirmClass: "bg-accent text-white hover:bg-accent/90",
            showDaysInput: false,
        },
        "reset-temp": {
            title: tempPassword ? "Temporary password set" : "Set temporary password",
            description: (name) =>
                tempPassword
                    ? `Share this temporary password with ${name}. They will be required to change it on next login.`
                    : `Generate and set a temporary password for ${name}? They will be required to change it on next login.`,
            confirmLabel: tempPassword ? "Close" : "Generate & set",
            confirmClass: "bg-accent text-white hover:bg-accent/90",
            showDaysInput: false,
        },
    };

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

    const cfg = actionModal ? dialogConfig[actionModal.type] : null;
    const patientName = actionModal ? (actionModal.patient.fullName || actionModal.patient.email || "this patient") : "";
    const patientEmail = actionModal ? (actionModal.patient.email || "") : "";

    return (
        <>
            <div className="rounded-lg border border-neutral-200 overflow-hidden dark:border-neutral-800">
                <Table>
                    <TableHeader className={subtableHeaderClass}>
                        <TableRow className={`border-neutral-200 dark:border-neutral-700 hover:opacity-100 ${subtableHeaderClass}`}>
                            {tableHeaders}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {patients.map((p: AdminReviewerPatient) => {
                            const isActive = p.membershipDaysRemaining != null && p.membershipDaysRemaining > 0;
                            return (
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
                                        ) : "—"}
                                    </TableCell>
                                    <TableCell className="text-center tabular-nums">{p.totalUploads}</TableCell>
                                    <TableCell className="text-center tabular-nums text-amber-600 dark:text-amber-400">{p.pendingReviews}</TableCell>
                                    <TableCell className="text-center tabular-nums text-emerald-600 dark:text-emerald-400">{p.completedReviews}</TableCell>
                                    <TableCell className="text-right pr-2">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    disabled={submitting}
                                                    className="inline-flex items-center justify-center rounded p-1.5 text-muted-foreground hover:bg-neutral-100 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                                                    aria-label="Patient actions"
                                                >
                                                    {submitting ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <MoreVertical className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-52">
                                                {isActive ? (
                                                    <DropdownMenuItem
                                                        className="text-destructive focus:text-destructive gap-2"
                                                        onSelect={() => openAction("disable", p)}
                                                    >
                                                        <Ban className="h-4 w-4" />
                                                        Disable
                                                    </DropdownMenuItem>
                                                ) : (
                                                    <DropdownMenuItem
                                                        className="text-emerald-600 focus:text-emerald-600 gap-2"
                                                        onSelect={() => openAction("enable", p)}
                                                    >
                                                        <CheckCircle2 className="h-4 w-4" />
                                                        Enable
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem className="gap-2" onSelect={() => openAction("extend", p)}>
                                                    <CalendarPlus className="h-4 w-4" />
                                                    Extend membership
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="gap-2" onSelect={() => openAction("reset-email", p)}>
                                                    <KeyRound className="h-4 w-4" />
                                                    Send reset email
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="gap-2" onSelect={() => openAction("reset-temp", p)}>
                                                    <Key className="h-4 w-4" />
                                                    Set temporary password
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive gap-2"
                                                    onSelect={() => openAction("delete", p)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    Delete patient
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={actionModal !== null} onOpenChange={(open) => { if (!open) closeModal(); }}>
                {cfg && (
                    <DialogContent showCloseButton={false}>
                        <DialogHeader>
                            <DialogTitle>{cfg.title}</DialogTitle>
                            <DialogDescription>
                                {cfg.description(patientName, patientEmail)}
                            </DialogDescription>
                        </DialogHeader>

                        {cfg.showDaysInput && (
                            <div className="flex items-center gap-3">
                                <Input
                                    type="number"
                                    min={1}
                                    max={3650}
                                    value={days}
                                    onChange={(e) => setDays(e.target.value)}
                                    className="w-28"
                                />
                                <span className="text-sm text-muted-foreground">days</span>
                            </div>
                        )}

                        {actionModal?.type === "reset-temp" && tempPassword && (
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
                                className={cfg.confirmClass}
                                onClick={handleAction}
                                disabled={submitting}
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : cfg.confirmLabel}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                )}
            </Dialog>
        </>
    );
}

export default ReviewerPatientsTable;
