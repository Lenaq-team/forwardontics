"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { TERMS_CONTENT, TERMS_TITLE } from "@/content/terms";

export default function TermsPage() {
  const [accepted, setAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/terms-status", { credentials: "include" });
      if (res.status === 401 || res.status === 403) {
        setIsAuthenticated(false);
        window.location.href = "/login";
        return;
      }
      const data = await res.json().catch(() => ({}));
      setIsAuthenticated(true);
      if (data.termsAccepted) {
        window.location.href = "/platform";
      }
    } catch {
      setIsAuthenticated(false);
    } finally {
      setIsCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleAccept = async () => {
    if (!accepted) {
      toast.error("Please confirm that you have read and agree to the terms.", {
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
      const res = await fetch("/api/auth/accept-terms", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to accept terms.", {
          style: {
            background: "rgba(220, 38, 38, 0.1)",
            color: "red",
            border: "1px solid rgba(220, 38, 38, 0.4)",
          },
        });
        return;
      }
      toast.success("Terms accepted. Redirecting…", {
        style: {
          background: "rgba(0, 160, 154, 0.1)",
          color: "#00a09a",
          border: "1px solid rgba(0, 160, 154, 0.4)",
        },
      });
      window.location.href = "/platform";
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="bg-quaternary flex min-h-svh items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="bg-quaternary min-h-svh">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <a
            href="https://gopex.org/"
            className="flex items-center gap-2 font-medium"
            rel="noopener noreferrer"
            target="_blank"
          >
            <Image
              src="/images/gopex.jpeg"
              alt="GOPex"
              width={36}
              height={36}
              className="rounded-lg"
            />
            <span className="text-xl font-bold">GOPex</span>
          </a>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={14} />
            Back to login
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h1 className="mb-6 text-2xl font-semibold">
            {TERMS_TITLE}
          </h1>

          <div className="prose prose-sm max-w-none dark:prose-invert">
            {TERMS_CONTENT}
          </div>

          <div className="mt-8 space-y-6 border-t pt-8">
            <div className="flex items-start gap-3">
              <input
                id="accept"
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-input"
              />
              <label
                htmlFor="accept"
                className="cursor-pointer text-sm leading-relaxed"
              >
                By checking this box, I confirm that I have read and understand
                this Authorization and Disclaimer, I voluntarily agree to its
                terms, and if acting on behalf of a minor, I have legal authority
                to provide this consent.
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleAccept}
                disabled={isLoading || !accepted}
                className="bg-tertiary text-primary-foreground hover:bg-primary/90"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Accepting…
                  </>
                ) : (
                  "I Accept"
                )}
              </Button>
              <Button variant="outline" asChild>
                <Link href="/login">Cancel</Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
