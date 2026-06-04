"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui";
import { useUser } from "@/contexts";

export default function UserPage() {
  const { logout } = useUser();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      logout();
    } catch (error) {
      console.error("Logout error:", error);
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="container mx-auto p-6 flex flex-col items-center justify-center min-h-[60vh]">
      <Button
        variant="destructive"
        size="lg"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="gap-2"
      >
        <LogOut className={`h-5 w-5 ${isLoggingOut ? "animate-spin" : ""}`} />
        {isLoggingOut ? "Logging out..." : "Log out"}
      </Button>
    </div>
  );
}
