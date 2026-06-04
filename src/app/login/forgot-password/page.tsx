"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Button,
} from "@/components/ui";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Check, X, ArrowLeft } from "lucide-react";

const PASSWORD_REGEX =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/;

export default function ForgotPasswordPage() {
    const [step, setStep] = useState<"email" | "reset">("email");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const [passwordValidation, setPasswordValidation] = useState({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        special: false,
    });

    const updatePasswordValidation = useCallback((pwd: string) => {
        if (pwd) {
            setPasswordValidation({
                length: pwd.length >= 8,
                uppercase: /[A-Z]/.test(pwd),
                lowercase: /[a-z]/.test(pwd),
                number: /\d/.test(pwd),
                special: /[^\da-zA-Z]/.test(pwd),
            });
        } else {
            setPasswordValidation({
                length: false,
                uppercase: false,
                lowercase: false,
                number: false,
                special: false,
            });
        }
    }, []);

    const isPasswordValid = useMemo(
        () => Object.values(passwordValidation).every(Boolean),
        [passwordValidation]
    );

    const handleEmailSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            const trimmed = email.trim();
            if (!trimmed) {
                toast.error("Please enter your email.", {
                    style: {
                        background: "rgba(220, 38, 38, 0.1)",
                        color: "red",
                        border: "1px solid rgba(220, 38, 38, 0.4)",
                    },
                });
                return;
            }
            setIsLoading(true);
            try {
                const res = await fetch("/api/auth/forgot-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: trimmed }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    toast.error(data.error || "Something went wrong.", {
                        style: {
                            background: "rgba(220, 38, 38, 0.1)",
                            color: "red",
                            border: "1px solid rgba(220, 38, 38, 0.4)",
                        },
                    });
                    return;
                }
                toast.success(data.message || "Check your email for the code.", {
                    style: {
                        background: "rgba(0, 160, 154, 0.1)",
                        color: "#00a09a",
                        border: "1px solid rgba(0, 160, 154, 0.4)",
                    },
                });
                setStep("reset");
            } finally {
                setIsLoading(false);
            }
        },
        [email]
    );

    const handleResetSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            if (!isPasswordValid) {
                toast.error("New password does not meet all requirements.", {
                    style: {
                        background: "rgba(220, 38, 38, 0.1)",
                        color: "red",
                        border: "1px solid rgba(220, 38, 38, 0.4)",
                    },
                });
                return;
            }
            if (newPassword !== confirmPassword) {
                toast.error("Passwords do not match.", {
                    style: {
                        background: "rgba(220, 38, 38, 0.1)",
                        color: "red",
                        border: "1px solid rgba(220, 38, 38, 0.4)",
                    },
                });
                return;
            }
            setIsLoading(true);
            try {
                const res = await fetch("/api/auth/confirm-forgot-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: email.trim(),
                        code: code.trim(),
                        newPassword,
                    }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    toast.error(data.error || "Failed to reset password.", {
                        style: {
                            background: "rgba(220, 38, 38, 0.1)",
                            color: "red",
                            border: "1px solid rgba(220, 38, 38, 0.4)",
                        },
                    });
                    return;
                }
                toast.success(
                    data.message ||
                        "Password reset. Please sign in with your new password.",
                    {
                        style: {
                            background: "rgba(0, 160, 154, 0.1)",
                            color: "#00a09a",
                            border: "1px solid rgba(0, 160, 154, 0.4)",
                        },
                    }
                );
                window.location.href = "/login";
            } finally {
                setIsLoading(false);
            }
        },
        [email, code, newPassword, confirmPassword, isPasswordValid]
    );

    return (
        <div className="bg-quaternary flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
            <div className="w-full max-w-sm flex flex-col gap-6">
                <a
                    href="https://gopex.org/"
                    className="flex items-center gap-2 self-center font-medium"
                    rel="noopener noreferrer"
                    target="_blank"
                >
                    <Image
                        src="/images/gopex.jpeg"
                        alt="logo"
                        width={50}
                        height={50}
                        className="rounded-lg"
                    />
                    <h1 className="text-3xl font-bold">GOPex</h1>
                </a>

                <Card>
                    <CardHeader className="text-center">
                        <CardTitle className="text-xl">
                            {step === "email"
                                ? "Reset password"
                                : "Enter verification code"}
                        </CardTitle>
                        <CardDescription>
                            {step === "email"
                                ? "Enter your email and we'll send you a verification code."
                                : "Enter the code from your email and choose a new password."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {step === "email" ? (
                            <form onSubmit={handleEmailSubmit}>
                                <div className="grid gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="forgot-email">Email</Label>
                                        <Input
                                            id="forgot-email"
                                            type="email"
                                            value={email}
                                            onChange={(e) =>
                                                setEmail(e.target.value)
                                            }
                                            placeholder="you@example.com"
                                            required
                                        />
                                    </div>
                                    <Button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full bg-tertiary text-primary-foreground hover:bg-primary/90"
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Sending...
                                            </>
                                        ) : (
                                            "Send verification code"
                                        )}
                                    </Button>
                                </div>
                            </form>
                        ) : (
                            <form onSubmit={handleResetSubmit}>
                                <div className="grid gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="forgot-email-readonly">
                                            Email
                                        </Label>
                                        <Input
                                            id="forgot-email-readonly"
                                            type="email"
                                            value={email}
                                            readOnly
                                            className="bg-muted"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="forgot-code">
                                            Verification code
                                        </Label>
                                        <Input
                                            id="forgot-code"
                                            type="text"
                                            value={code}
                                            onChange={(e) =>
                                                setCode(e.target.value)
                                            }
                                            placeholder="123456"
                                            required
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="forgot-new-password">
                                            New password
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="forgot-new-password"
                                                type={
                                                    passwordVisible
                                                        ? "text"
                                                        : "password"
                                                }
                                                value={newPassword}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    setNewPassword(v);
                                                    updatePasswordValidation(v);
                                                }}
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setPasswordVisible((p) => !p)
                                                }
                                                className="absolute inset-y-0 right-3 flex items-center text-sm"
                                            >
                                                {passwordVisible ? (
                                                    <EyeOff size={16} />
                                                ) : (
                                                    <Eye size={16} />
                                                )}
                                            </button>
                                        </div>
                                        <div className="space-y-1.5 text-xs">
                                            <p className="font-medium text-muted-foreground">
                                                Password requirements:
                                            </p>
                                            <div className="grid grid-cols-1 gap-1">
                                                <div className="flex items-center gap-2">
                                                    {passwordValidation.length ? (
                                                        <Check
                                                            size={14}
                                                            className="text-green-500"
                                                        />
                                                    ) : (
                                                        <div className="h-3.5 w-3.5 rounded-full border border-gray-200" />
                                                    )}
                                                    <span
                                                        className={
                                                            passwordValidation.length
                                                                ? "text-green-700"
                                                                : "text-gray-500"
                                                        }
                                                    >
                                                        8+ characters
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {passwordValidation.uppercase ? (
                                                        <Check
                                                            size={14}
                                                            className="text-green-500"
                                                        />
                                                    ) : (
                                                        <div className="h-3.5 w-3.5 rounded-full border border-gray-200" />
                                                    )}
                                                    <span
                                                        className={
                                                            passwordValidation.uppercase
                                                                ? "text-green-700"
                                                                : "text-gray-500"
                                                        }
                                                    >
                                                        1 uppercase letter
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {passwordValidation.lowercase ? (
                                                        <Check
                                                            size={14}
                                                            className="text-green-500"
                                                        />
                                                    ) : (
                                                        <div className="h-3.5 w-3.5 rounded-full border border-gray-200" />
                                                    )}
                                                    <span
                                                        className={
                                                            passwordValidation.lowercase
                                                                ? "text-green-700"
                                                                : "text-gray-500"
                                                        }
                                                    >
                                                        1 lowercase letter
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {passwordValidation.number ? (
                                                        <Check
                                                            size={14}
                                                            className="text-green-500"
                                                        />
                                                    ) : (
                                                        <div className="h-3.5 w-3.5 rounded-full border border-gray-200" />
                                                    )}
                                                    <span
                                                        className={
                                                            passwordValidation.number
                                                                ? "text-green-700"
                                                                : "text-gray-500"
                                                        }
                                                    >
                                                        1 number
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {passwordValidation.special ? (
                                                        <Check
                                                            size={14}
                                                            className="text-green-500"
                                                        />
                                                    ) : (
                                                        <div className="h-3.5 w-3.5 rounded-full border border-gray-200" />
                                                    )}
                                                    <span
                                                        className={
                                                            passwordValidation.special
                                                                ? "text-green-700"
                                                                : "text-gray-500"
                                                        }
                                                    >
                                                        1 special character
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="forgot-confirm-password">
                                            Confirm password
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="forgot-confirm-password"
                                                type={
                                                    confirmVisible
                                                        ? "text"
                                                        : "password"
                                                }
                                                value={confirmPassword}
                                                onChange={(e) =>
                                                    setConfirmPassword(
                                                        e.target.value
                                                    )
                                                }
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setConfirmVisible((p) => !p)
                                                }
                                                className="absolute inset-y-0 right-3 flex items-center text-sm"
                                            >
                                                {confirmVisible ? (
                                                    <EyeOff size={16} />
                                                ) : (
                                                    <Eye size={16} />
                                                )}
                                            </button>
                                        </div>
                                        {confirmPassword && (
                                            <div className="flex items-center gap-2 text-xs">
                                                {newPassword ===
                                                confirmPassword ? (
                                                    <>
                                                        <Check
                                                            size={14}
                                                            className="text-green-500"
                                                        />
                                                        <span className="text-green-700">
                                                            Passwords match
                                                        </span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <X
                                                            size={14}
                                                            className="text-red-500"
                                                        />
                                                        <span className="text-red-700">
                                                            Passwords do not
                                                            match
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        type="submit"
                                        disabled={
                                            isLoading ||
                                            !isPasswordValid ||
                                            newPassword !== confirmPassword
                                        }
                                        className="w-full bg-tertiary text-primary-foreground hover:bg-primary/90"
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Resetting...
                                            </>
                                        ) : (
                                            "Reset password"
                                        )}
                                    </Button>
                                </div>
                            </form>
                        )}

                        <div className="mt-4 text-center">
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                            >
                                <ArrowLeft size={14} />
                                Back to login
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
