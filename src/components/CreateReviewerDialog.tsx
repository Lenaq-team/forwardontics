"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FULL_NAME_REGEX = /^[a-zA-Z\s]*$/;

export type CreateReviewerDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
};

const DEFAULT_ROLE: "Reviewer" | "Reviewer-test" = "Reviewer-test";

export function CreateReviewerDialog({
    open,
    onOpenChange,
    onSuccess,
}: CreateReviewerDialogProps) {
    const [email, setEmail] = useState("");
    const [fullName, setFullName] = useState("");
    const [role, setRole] = useState<"Reviewer" | "Reviewer-test">(DEFAULT_ROLE);
    const [loading, setLoading] = useState(false);
    const [debouncedEmail, setDebouncedEmail] = useState("");

    useEffect(() => {
        const t = setTimeout(() => setDebouncedEmail(email), 400);
        return () => clearTimeout(t);
    }, [email]);

    const fullNameValid = FULL_NAME_REGEX.test(fullName);
    const fullNameError = fullName.length > 0 && !fullNameValid ? "Only letters and spaces" : null;
    const emailValid = EMAIL_REGEX.test(email.trim());
    const emailError = debouncedEmail.length > 0 && !EMAIL_REGEX.test(debouncedEmail.trim()) ? "Enter a valid email address" : null;
    const canSubmit =
        email.trim().length > 0 &&
        fullName.trim().length > 0 &&
        emailValid &&
        fullNameValid &&
        !loading;

    const clearForm = () => {
        setEmail("");
        setFullName("");
        setRole(DEFAULT_ROLE);
        setDebouncedEmail("");
    };

    const handleOpenChange = (next: boolean) => {
        if (!next) clearForm();
        onOpenChange(next);
    };

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setLoading(true);
        try {
            const res = await fetch("/api/admin/create-user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: email.trim(),
                    fullName: fullName.trim() || undefined,
                    role,
                }),
                credentials: "include",
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "Failed to create reviewer");
            toast.success("Reviewer invited. They will receive an email to set their password.");
            clearForm();
            onOpenChange(false);
            onSuccess?.();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to create reviewer");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create reviewer</DialogTitle>
                    <DialogDescription>
                        Enter full name and email. They will receive an invitation to set their password.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                    <div className="grid gap-2">
                        <Label htmlFor="create-reviewer-fullname">Full name</Label>
                        <Input
                            id="create-reviewer-fullname"
                            type="text"
                            placeholder="JANE DOE"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                            aria-invalid={!!fullNameError}
                        />
                        {fullNameError && (
                            <p className="text-sm text-red-600 dark:text-red-400" role="alert">{fullNameError}</p>
                        )}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="create-reviewer-email">Email</Label>
                        <Input
                            id="create-reviewer-email"
                            type="email"
                            placeholder="reviewer@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                            aria-invalid={!!emailError}
                        />
                        {emailError && (
                            <p className="text-sm text-red-600 dark:text-red-400" role="alert">{emailError}</p>
                        )}
                    </div>
                    <div className="grid gap-2">
                        <Label>Role</Label>
                        <Select
                            value={role}
                            onValueChange={(v) => setRole(v as "Reviewer" | "Reviewer-test")}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Reviewer-test">Reviewer-test</SelectItem>
                                <SelectItem value="Reviewer">Reviewer</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => {
                            clearForm();
                            onOpenChange(false);
                        }}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="bg-main hover:bg-main/90"
                    >
                        {loading ? "Creating…" : "Create reviewer"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
