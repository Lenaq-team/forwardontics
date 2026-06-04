"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { TIMEZONE_STORAGE_KEY } from "@/lib/data/timezones";

interface TimezoneContextType {
  timezone: string;
  setTimezone: (tz: string) => void;
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(
  undefined
);

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const [timezone, setTimezoneState] = useState<string>("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(TIMEZONE_STORAGE_KEY);
      if (stored) {
        setTimezoneState(stored);
      } else {
        setTimezoneState(Intl.DateTimeFormat().resolvedOptions().timeZone);
      }
    } catch {
      setTimezoneState("UTC");
    }
  }, []);

  const setTimezone = useCallback((tz: string) => {
    setTimezoneState(tz);
    try {
      localStorage.setItem(TIMEZONE_STORAGE_KEY, tz);
    } catch (e) {
      console.warn("TimezoneContext: Failed to persist timezone", e);
    }
  }, []);

  const value = useMemo(
    () => ({ timezone, setTimezone }),
    [timezone, setTimezone]
  );

  return (
    <TimezoneContext.Provider value={value}>
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezone() {
  const ctx = useContext(TimezoneContext);
  if (ctx === undefined) {
    throw new Error("useTimezone must be used within a TimezoneProvider");
  }
  return ctx;
}
