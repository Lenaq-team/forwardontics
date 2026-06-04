"use client";

import { SWRConfig } from "swr";
import { UserProvider } from "@/contexts/UserContext";
import { swrConfig } from "@/lib/swr";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={swrConfig}>
      <UserProvider>{children}</UserProvider>
    </SWRConfig>
  );
}
