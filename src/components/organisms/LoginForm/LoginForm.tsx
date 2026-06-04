"use client";

import { cn } from "@/lib/utils/helpers";
import { useState, useEffect, useCallback, useMemo, memo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Check, X } from "lucide-react";
import { safeRedirect } from "@/lib/utils/environment";

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/;

const LoginForm = memo(({ className, ...props }: React.ComponentProps<"div">) => {
    console.log('LoginForm: Rendering');

    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [newPasswordRequired, setNewPasswordRequired] = useState(false);
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [newPasswordVisible, setNewPasswordVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

    // Use ref instead of state to prevent infinite loops
    const hasCheckedAuth = useRef(false);

    // Password validation state
    const [passwordValidation, setPasswordValidation] = useState({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        special: false
    });

    // Check if user is already authenticated on component mount
    useEffect(() => {
        console.log('LoginForm: Checking authentication');
        const checkAuth = async () => {
            try {
                // Only check auth once to prevent loops
                if (hasCheckedAuth.current) {
                    console.log('LoginForm: Auth already checked, skipping');
                    setIsCheckingAuth(false);
                    return;
                }

                const response = await fetch('/api/auth/me', {
                    credentials: 'include',
                });

                if (response.ok) {
                    console.log('LoginForm: User already authenticated, redirecting');
                    // User is already authenticated, redirect to platform
                    hasCheckedAuth.current = true;
                    safeRedirect('/platform');
                    return;
                } else {
                    console.log('LoginForm: User not authenticated, showing login form');
                }
            } catch (error) {
                console.error('LoginForm: Auth check failed:', error);
            } finally {
                setIsCheckingAuth(false);
                hasCheckedAuth.current = true;
            }
        };

        checkAuth();
    }, []); // No dependencies to prevent infinite loops

    // Update password validation when newPassword changes
    useEffect(() => {
        if (newPassword) {
            setPasswordValidation({
                length: newPassword.length >= 8,
                uppercase: /[A-Z]/.test(newPassword),
                lowercase: /[a-z]/.test(newPassword),
                number: /\d/.test(newPassword),
                special: /[^\da-zA-Z]/.test(newPassword)
            });
        } else {
            setPasswordValidation({
                length: false,
                uppercase: false,
                lowercase: false,
                number: false,
                special: false
            });
        }
    }, [newPassword]);

    // Check if all password requirements are met
    const isPasswordValid = useMemo(() => {
        const valid = Object.values(passwordValidation).every(Boolean);
        console.log('LoginForm: Password validation computed:', valid);
        return valid;
    }, [passwordValidation]);

    // Memoize handlers to prevent recreation
    const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setEmail(e.target.value);
    }, []);

    const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setPassword(e.target.value);
    }, []);

    const handleNewPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setNewPassword(e.target.value);
    }, []);

    const handleConfirmPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setConfirmPassword(e.target.value);
    }, []);

    const togglePasswordVisible = useCallback(() => {
        setPasswordVisible(prev => !prev);
    }, []);

    const toggleNewPasswordVisible = useCallback(() => {
        setNewPasswordVisible(prev => !prev);
    }, []);

    const handleLogin = useCallback(async () => {
        console.log('LoginForm: handleLogin called');
        try {
            setIsLoading(true);

            if (newPasswordRequired) {
                // Validate new password using the validation state
                if (!isPasswordValid) {
                    toast.error("New password does not meet all requirements.", {
                        style: {
                            background: 'rgba(220, 38, 38, 0.1)',
                            color: 'red',
                            border: '1px solid rgba(220, 38, 38, 0.4)'
                        }
                    });
                    return;
                }
                if (newPassword !== confirmPassword) {
                    toast.error("Passwords do not match.", {
                        style: {
                            background: 'rgba(220, 38, 38, 0.1)',
                            color: 'red',
                            border: '1px solid rgba(220, 38, 38, 0.4)'
                        }
                    });
                    return;
                }

                const res = await fetch("/api/auth/complete-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, oldPassword: password, newPassword }),
                });

                if (!res.ok) {
                    toast.error("Failed to set new password", {
                        style: {
                            background: 'rgba(220, 38, 38, 0.1)',
                            color: 'red',
                            border: '1px solid rgba(220, 38, 38, 0.4)'
                        }
                    });
                    return;
                }

                toast.success("Password updated successfully!", {
                    style: {
                        background: 'rgba(0, 160, 154, 0.1)',
                        color: '#00a09a',
                        border: '1px solid rgba(0, 160, 154, 0.4)'
                    }
                });
            } else {
                const res = await fetch("/api/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password }),
                });

                if (res.status === 409) {
                    // password change required
                    setNewPasswordRequired(true);
                    toast.info("Please set a new password to continue", {
                        style: {
                            background: 'rgba(0, 160, 154, 0.1)',
                            color: '#00a09a',
                            border: '1px solid rgba(0, 160, 154, 0.4)'
                        }
                    });
                    return;
                }

                if (!res.ok) {
                    toast.error("Login failed. Please check your credentials.", {
                        style: {
                            background: 'rgba(220, 38, 38, 0.1)',
                            color: 'red',
                            border: '1px solid rgba(220, 38, 38, 0.4)'
                        }
                    });
                    return;
                }

                toast.success("Login successful!", {
                    style: {
                        background: 'rgba(0, 160, 154, 0.1)',
                        color: '#00a09a',
                        border: '1px solid rgba(0, 160, 154, 0.4)'
                    }
                });
            }

            // After successful login or password completion, redirect immediately
            // Don't check user role again to prevent loops
            console.log('LoginForm: Login successful, redirecting to platform');
            safeRedirect("/platform");

        } catch (error) {
            console.error("Login error:", error);
            toast.error("An unexpected error occurred", {
                style: {
                    background: 'rgba(220, 38, 38, 0.1)',
                    color: 'red',
                    border: '1px solid rgba(220, 38, 38, 0.4)'
                }
            });
        } finally {
            setIsLoading(false);
        }
    }, [newPasswordRequired, isPasswordValid, newPassword, confirmPassword, email, password]);

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        handleLogin();
    }, [handleLogin]);

    // Show loading state while checking authentication
    if (isCheckingAuth) {
        console.log('LoginForm: Showing loading state');
        return (
            <div className={cn("flex flex-col gap-6", className)} {...props}>
                <Card>
                    <CardHeader className="text-center space-y-2">
                        <Skeleton className="h-6 w-32 mx-auto" />
                        <Skeleton className="h-4 w-64 mx-auto" />
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-12" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <Skeleton className="h-10 w-full rounded-md" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    console.log('LoginForm: Rendering login form');
    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card>
                <CardHeader className="text-center">
                    <CardTitle className="text-xl">Welcome back</CardTitle>
                    <CardDescription>
                        {newPasswordRequired
                            ? "Set a new password to continue"
                            : "Login with your credentials"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-6">
                            <div className="grid gap-3">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={handleEmailChange}
                                    required
                                />
                            </div>

                            {!newPasswordRequired && (
                                <div className="grid gap-3">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="password">Password</Label>
                                        <Link
                                            href="/login/forgot-password"
                                            className="text-sm text-muted-foreground hover:text-foreground"
                                        >
                                            Forgot password?
                                        </Link>
                                    </div>
                                    <div className="relative">
                                        <Input
                                            id="password"
                                            type={passwordVisible ? "text" : "password"}
                                            value={password}
                                            onChange={handlePasswordChange}
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={togglePasswordVisible}
                                            className="absolute inset-y-0 right-3 flex items-center text-sm"
                                        >
                                            {passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {newPasswordRequired && (
                                <>
                                    <div className="grid gap-3">
                                        <Label htmlFor="newPassword">New Password</Label>
                                        <div className="relative">
                                            <Input
                                                id="newPassword"
                                                type={newPasswordVisible ? "text" : "password"}
                                                value={newPassword}
                                                onChange={handleNewPasswordChange}
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={toggleNewPasswordVisible}
                                                className="absolute inset-y-0 right-3 flex items-center text-sm"
                                            >
                                                {newPasswordVisible ? (
                                                    <EyeOff size={16} />
                                                ) : (
                                                    <Eye size={16} />
                                                )}
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-xs font-medium text-muted-foreground">Password requirements:</p>
                                            <div className="grid grid-cols-1 gap-1.5 text-xs">
                                                <div className="flex items-center gap-2 transition-all duration-200">
                                                    {passwordValidation.length ? (
                                                        <Check size={14} className="text-green-500" />
                                                    ) : (
                                                        <div className="w-3.5 h-3.5 rounded-full border border-gray-200" />
                                                    )}
                                                    <span className={`transition-colors duration-200 ${passwordValidation.length ? "text-green-700" : "text-gray-500"}`}>
                                                        8+ characters
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 transition-all duration-200">
                                                    {passwordValidation.uppercase ? (
                                                        <Check size={14} className="text-green-500" />
                                                    ) : (
                                                        <div className="w-3.5 h-3.5 rounded-full border border-gray-200" />
                                                    )}
                                                    <span className={`transition-colors duration-200 ${passwordValidation.uppercase ? "text-green-700" : "text-gray-500"}`}>
                                                        1 uppercase letter
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 transition-all duration-200">
                                                    {passwordValidation.lowercase ? (
                                                        <Check size={14} className="text-green-500" />
                                                    ) : (
                                                        <div className="w-3.0 h-3.0 rounded-full border border-gray-200" />
                                                    )}
                                                    <span className={`transition-colors duration-200 ${passwordValidation.lowercase ? "text-green-700" : "text-gray-500"}`}>
                                                        1 lowercase letter
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 transition-all duration-200">
                                                    {passwordValidation.number ? (
                                                        <Check size={14} className="text-green-500" />
                                                    ) : (
                                                        <div className="w-3.5 h-3.5 rounded-full border border-gray-200" />
                                                    )}
                                                    <span className={`transition-colors duration-200 ${passwordValidation.number ? "text-green-700" : "text-gray-500"}`}>
                                                        1 number
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 transition-all duration-200">
                                                    {passwordValidation.special ? (
                                                        <Check size={14} className="text-green-500" />
                                                    ) : (
                                                        <div className="w-3.5 h-3.5 rounded-full border border-gray-200" />
                                                    )}
                                                    <span className={`transition-colors duration-200 ${passwordValidation.special ? "text-green-700" : "text-gray-500"}`}>
                                                        1 special character
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid gap-3">
                                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                                        <Input
                                            id="confirmPassword"
                                            type="password"
                                            value={confirmPassword}
                                            onChange={handleConfirmPasswordChange}
                                            required
                                        />
                                        {confirmPassword && (
                                            <div className="flex items-center gap-2 text-xs">
                                                {newPassword === confirmPassword ? (
                                                    <>
                                                        <Check size={14} className="text-green-500" />
                                                        <span className="text-green-700">Passwords match</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <X size={14} className="text-red-500" />
                                                        <span className="text-red-700">Passwords do not match</span>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            <Button
                                type="submit"
                                disabled={isLoading || (newPasswordRequired && (!isPasswordValid || newPassword !== confirmPassword))}
                                className="w-full bg-tertiary text-primary-foreground hover:bg-primary/90"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {newPasswordRequired ? "Setting Password..." : "Logging in..."}
                                    </>
                                ) : (
                                    newPasswordRequired ? "Set New Password" : "Login"
                                )}
                            </Button>

                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
});

LoginForm.displayName = 'LoginForm';

export default LoginForm;
