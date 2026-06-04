"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

export function TermsGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<"loading" | "allowed" | "redirect">("loading");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/auth/terms-status", {
          credentials: "include",
        });
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) {
          setStatus("allowed");
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (data.termsAccepted) {
          setStatus("allowed");
        } else {
          setStatus("redirect");
          window.location.href = "/terms";
        }
      } catch {
        if (!cancelled) setStatus("allowed");
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (status === "redirect") {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
