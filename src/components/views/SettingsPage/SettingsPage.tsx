"use client";

import { useMemo, useEffect, useState } from "react";
import { CalendarIcon, Home, LogOut } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useTimezone, useUser } from "@/contexts";
import {
  COMMON_TIMEZONES,
  getTimezoneLabel,
  getTimezoneOffsetMinutes,
} from "@/lib/data/timezones";
import { toast } from "sonner";

type PatientData = {
  fullName: string | null;
  email: string | null;
  assignedDoctor: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  sex: string | null;
  status: string;
  timezone: string;
  membershipExpiresAt: string | null;
  isMembershipActive: boolean;
};

/** Remaining calendar days until expiry (positive = future, negative = past). */
function getRemainingDays(expiresAt: string | null | undefined): number | null {
  if (!expiresAt) return null;
  const end = new Date(expiresAt);
  if (isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - Date.now()) / 86400000);
}

type ReviewerData = {
  fullname: string | null;
  email: string | null;
  phone: string | null;
  maxPatientCapacity: number;
  totalPatientCapacity: number;
  membershipExpiresAt: string | null;
  isMembershipActive: boolean;
};

const SEX_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

/** Parse YYYY-MM-DD or ISO string to Date for display; avoids Invalid Date from concat. */
function parseDateOnly(str: string | null | undefined): Date | undefined {
  if (!str || typeof str !== "string") return undefined;
  const match = str.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return undefined;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  const d = new Date(year, month, day);
  return isNaN(d.getTime()) ? undefined : d;
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  },
  inactive: {
    label: "Inactive",
    className: "bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700",
  },
  pending: {
    label: "Pending",
    className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  },
};

const toastStyle = {
  success: {
    style: {
      background: "rgba(0, 160, 154, 0.1)",
      color: "#00a09a",
      border: "1px solid rgba(0, 160, 154, 0.4)",
    },
  },
  error: {
    style: {
      background: "rgba(220, 38, 38, 0.1)",
      color: "red",
      border: "1px solid rgba(220, 38, 38, 0.4)",
    },
  },
};

const SettingsPage = () => {
  const { setTimezone } = useTimezone();
  const { roles, loading: userLoading, logout } = useUser();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isPatient = roles.includes("User") || roles.includes("Admin");
  const isReviewer =
    roles.includes("Reviewer") ||
    roles.includes("Admin") ||
    roles.includes("Reviewer-test");

  const [patient, setPatient] = useState<PatientData | null>(null);
  const [patientForm, setPatientForm] = useState<PatientData>({
    fullName: "",
    email: "",
    assignedDoctor: "",
    phone: "",
    dateOfBirth: "",
    sex: "",
    status: "active",
    timezone: "UTC",
    membershipExpiresAt: null,
    isMembershipActive: false,
  });

  const [reviewer, setReviewer] = useState<ReviewerData | null>(null);
  const [reviewerForm, setReviewerForm] = useState<ReviewerData>({
    fullname: "",
    email: "",
    phone: "",
    maxPatientCapacity: 0,
    totalPatientCapacity: 0,
    membershipExpiresAt: null,
    isMembershipActive: false,
  });

  const [isSavingPatient, setIsSavingPatient] = useState(false);
  const [isSavingReviewer, setIsSavingReviewer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());

  useEffect(() => {
    const fetches: Promise<void>[] = [];

    if (isPatient) {
      fetches.push(
        fetch("/api/patients/me", { credentials: "include" })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data) {
              const rawDob = data.dateOfBirth ?? "";
              const dobMatch = typeof rawDob === "string" && rawDob.match(/^(\d{4}-\d{2}-\d{2})/);
              const dateOfBirth = dobMatch ? dobMatch[1] : rawDob;
              const p: PatientData = {
                fullName: data.fullName ?? "",
                email: data.email ?? "",
                assignedDoctor: data.assignedDoctor ?? "",
                phone: data.phone ?? "",
                dateOfBirth,
                sex: data.sex ?? "",
                status: data.status ?? "active",
                timezone: data.timezone ?? "UTC",
                membershipExpiresAt: data.membershipExpiresAt ?? null,
                isMembershipActive: data.isMembershipActive ?? false,
              };
              setPatient(p);
              setPatientForm(p);
              if (data.timezone) setTimezone(data.timezone);
            }
          })
          .catch(() => { })
      );
    }

    if (isReviewer) {
      fetches.push(
        fetch("/api/reviewers/me", { credentials: "include" })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data) {
              const r: ReviewerData = {
                fullname: data.fullname ?? "",
                email: data.email ?? "",
                phone: data.phone ?? "",
                maxPatientCapacity: data.maxPatientCapacity ?? 0,
                totalPatientCapacity: data.totalPatientCapacity ?? 0,
                membershipExpiresAt: data.membershipExpiresAt ?? null,
                isMembershipActive: data.isMembershipActive ?? false,
              };
              setReviewer(r);
              setReviewerForm(r);
            }
          })
          .catch(() => { })
      );
    }

    if (fetches.length === 0) {
      setIsLoading(false);
      return;
    }

    Promise.all(fetches).finally(() => setIsLoading(false));
  }, [isPatient, isReviewer, setTimezone]);

  const hasPatientUnsavedChanges = useMemo(() => {
    if (!patient) return false;
    return (
      patientForm.fullName !== (patient.fullName ?? "") ||
      patientForm.phone !== (patient.phone ?? "") ||
      patientForm.dateOfBirth !== (patient.dateOfBirth ?? "") ||
      patientForm.sex !== (patient.sex ?? "") ||
      patientForm.timezone !== patient.timezone
    );
  }, [patient, patientForm]);

  const hasReviewerUnsavedChanges = useMemo(() => {
    if (!reviewer) return false;
    return (
      reviewerForm.fullname !== (reviewer.fullname ?? "") ||
      reviewerForm.phone !== (reviewer.phone ?? "")
    );
  }, [reviewer, reviewerForm]);

  const handleSavePatient = async () => {
    setIsSavingPatient(true);
    try {
      const res = await fetch("/api/patients/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: patientForm.fullName || null,
          email: patientForm.email || null,
          phone: patientForm.phone || null,
          dateOfBirth: patientForm.dateOfBirth || null,
          sex: patientForm.sex || null,
          timezone: patientForm.timezone,
        }),
      });
      if (res.ok) {
        const updated: PatientData = { ...patientForm, assignedDoctor: patient?.assignedDoctor ?? "" };
        setPatient(updated);
        setTimezone(patientForm.timezone);
        toast.success("Patient settings saved", { ...toastStyle.success });
      } else {
        toast.error("Could not save patient settings", { ...toastStyle.error });
      }
    } catch {
      toast.error("Could not save patient settings", { ...toastStyle.error });
    } finally {
      setIsSavingPatient(false);
    }
  };

  const handleSaveReviewer = async () => {
    setIsSavingReviewer(true);
    try {
      const res = await fetch("/api/reviewers/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullname: reviewerForm.fullname || null,
          email: reviewerForm.email || null,
          phone: reviewerForm.phone || null,
        }),
      });
      if (res.ok) {
        setReviewer({ ...reviewerForm });
        toast.success("Reviewer settings saved", { ...toastStyle.success });
      } else {
        toast.error("Could not save reviewer settings", { ...toastStyle.error });
      }
    } catch {
      toast.error("Could not save reviewer settings", { ...toastStyle.error });
    } finally {
      setIsSavingReviewer(false);
    }
  };

  const patientTimezoneOptions = useMemo(() => {
    const set = new Set(COMMON_TIMEZONES);
    if (patientForm.timezone && !set.has(patientForm.timezone)) {
      const custom = patientForm.timezone;
      const offset = getTimezoneOffsetMinutes(custom);
      const idx = COMMON_TIMEZONES.findIndex(
        (tz) => getTimezoneOffsetMinutes(tz) < offset
      );
      const insertAt = idx === -1 ? COMMON_TIMEZONES.length : idx;
      return [
        ...COMMON_TIMEZONES.slice(0, insertAt),
        custom,
        ...COMMON_TIMEZONES.slice(insertAt),
      ];
    }
    return [...COMMON_TIMEZONES];
  }, [patientForm.timezone]);

  const updatePatientForm = (updates: Partial<PatientData>) => {
    setPatientForm((prev) => ({ ...prev, ...updates }));
  };

  const updateReviewerForm = (updates: Partial<ReviewerData>) => {
    setReviewerForm((prev) => ({ ...prev, ...updates }));
  };

  const handleTimezoneChange = (value: string) => {
    updatePatientForm({ timezone: value });
    setTimezone(value);
  };

  if (userLoading || isLoading) {
    return (
      <div className="container mx-auto p-6 overflow-y-auto space-y-6">
        <div className="mb-6 hidden md:block">
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full max-w-md" />
              </div>
            ))}
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>
          </CardContent>
        </Card>
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-80 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full max-w-md" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 overflow-y-auto space-y-6">
      <Breadcrumb className="mb-6 hidden md:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/platform">
              <Home className="h-4 w-4" />
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Settings</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-2xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage your profile and preferences.
        </p>
      </div>

      {isPatient && (
        <>
          <Card className="max-w-xl mx-auto">
            <CardHeader>
              <CardTitle>Patient Profile</CardTitle>
              <CardDescription>
                Your personal information and assigned doctor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="patient-fullName">Full name</Label>
                <Input
                  id="patient-fullName"
                  value={patientForm.fullName ?? ""}
                  onChange={(e) =>
                    updatePatientForm({ fullName: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g. JOHN SMITH"
                  className="max-w-md uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="patient-email">Email</Label>
                <p id="patient-email" className="text-sm">
                  {patientForm.email || "—"}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="patient-phone">Phone</Label>
                <Input
                  id="patient-phone"
                  type="tel"
                  value={patientForm.phone ?? ""}
                  onChange={(e) => updatePatientForm({ phone: e.target.value })}
                  placeholder="+1 234 567 8900"
                  className="max-w-md"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="patient-dateOfBirth">Date of birth</Label>
                <Popover
                  open={datePickerOpen}
                  onOpenChange={(open) => {
                    setDatePickerOpen(open);
                    if (open) {
                      const d = parseDateOnly(patientForm.dateOfBirth);
                      setCalendarMonth(d ?? new Date());
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      id="patient-dateOfBirth"
                      variant="outline"
                      className="max-w-md justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {(() => {
                        const d = parseDateOnly(patientForm.dateOfBirth);
                        return d ? d.toLocaleDateString() : "Pick a date";
                      })()}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      month={calendarMonth}
                      onMonthChange={setCalendarMonth}
                      selected={parseDateOnly(patientForm.dateOfBirth)}
                      onSelect={(date) => {
                        updatePatientForm({
                          dateOfBirth: date
                            ? date.toISOString().slice(0, 10)
                            : "",
                        });
                        if (date) setDatePickerOpen(false);
                      }}
                      captionLayout="dropdown"
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="patient-sex">Sex</Label>
                <Select
                  value={patientForm.sex || undefined}
                  onValueChange={(v) => updatePatientForm({ sex: v })}
                >
                  <SelectTrigger id="patient-sex" className="max-w-md">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEX_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="patient-assignedDoctor">Assigned doctor</Label>
                <Badge
                  id="patient-assignedDoctor"
                  variant="outline"
                  className="bg-accent/10 text-accent border-accent  font-normal p-2"
                >
                  {patientForm.assignedDoctor || "—"}
                </Badge>
              </div>
              <div className="space-y-2">
                <Label htmlFor="patient-status">Status</Label>
                <Badge
                  id="patient-status"
                  variant="outline"
                  className={
                    STATUS_BADGES[patientForm.status]?.className ??
                    STATUS_BADGES.active.className
                  }
                >
                  {STATUS_BADGES[patientForm.status]?.label ?? patientForm.status}
                </Badge>
              </div>
              <div className="space-y-2">
                <Label>Remaining days of access</Label>
                <p className="text-sm">
                  {patientForm.membershipExpiresAt == null ? (
                    "—"
                  ) : (() => {
                    const days = getRemainingDays(patientForm.membershipExpiresAt);
                    if (days === null) return "—";
                    if (days < 0)
                      return (
                        <span className="text-destructive font-medium">
                          Access expired
                        </span>
                      );
                    if (days === 0)
                      return (
                        <span className="text-amber-600 font-medium">
                          Expires today
                        </span>
                      );
                    return (
                      <>
                        <span className="font-medium">{days}</span> day{days !== 1 ? "s" : ""} remaining
                        <span className="text-muted-foreground ml-1">
                          (expires{" "}
                          {new Date(
                            patientForm.membershipExpiresAt
                          ).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                          )
                        </span>
                      </>
                    );
                  })()}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="max-w-xl mx-auto">
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>
                Choose how dates and times are displayed across the app.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={patientForm.timezone || undefined}
                  onValueChange={handleTimezoneChange}
                >
                  <SelectTrigger id="timezone" className="max-w-md">
                    <SelectValue
                      placeholder={
                        patientForm.timezone
                          ? getTimezoneLabel(patientForm.timezone)
                          : "Select timezone"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {patientTimezoneOptions.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {getTimezoneLabel(tz)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {hasPatientUnsavedChanges && (
            <div className="flex gap-2">
              <Button
                onClick={handleSavePatient}
                disabled={isSavingPatient}
                className="bg-main text-white hover:bg-main/90"
              >
                {isSavingPatient ? "Saving…" : "Save"}
              </Button>
            </div>
          )}
        </>
      )}

      {isReviewer && (
        <>
          <Card className="max-w-xl mx-auto">
            <CardHeader>
              <CardTitle>Reviewer Profile</CardTitle>
              <CardDescription>
                Your reviewer information and patient capacity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reviewer-fullname">Full name</Label>
                <Input
                  id="reviewer-fullname"
                  value={reviewerForm.fullname ?? ""}
                  onChange={(e) =>
                    updateReviewerForm({
                      fullname: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="e.g. DR. JANE DOE"
                  className="max-w-md uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reviewer-email">Email</Label>
                <p id="reviewer-email" className="text-sm">
                  {reviewerForm.email || "—"}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reviewer-phone">Phone</Label>
                <Input
                  id="reviewer-phone"
                  type="tel"
                  value={reviewerForm.phone ?? ""}
                  onChange={(e) =>
                    updateReviewerForm({ phone: e.target.value })
                  }
                  placeholder="+1 234 567 8900"
                  className="max-w-md"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reviewer-maxCapacity">Max patient capacity</Label>
                <p id="reviewer-maxCapacity" className="text-sm">
                  {reviewerForm.maxPatientCapacity}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reviewer-totalCapacity">
                  Total patients
                </Label>
                <p id="reviewer-totalCapacity" className="text-sm">
                  {reviewerForm.totalPatientCapacity}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Remaining days of access</Label>
                <p className="text-sm">
                  {reviewerForm.membershipExpiresAt == null ? (
                    "—"
                  ) : (() => {
                    const days = getRemainingDays(
                      reviewerForm.membershipExpiresAt
                    );
                    if (days === null) return "—";
                    if (days < 0)
                      return (
                        <span className="text-destructive font-medium">
                          Access expired
                        </span>
                      );
                    if (days === 0)
                      return (
                        <span className="text-amber-600 font-medium">
                          Expires today
                        </span>
                      );
                    return (
                      <>
                        <span className="font-medium">{days}</span> day
                        {days !== 1 ? "s" : ""} remaining
                        <span className="text-muted-foreground ml-1">
                          (expires{" "}
                          {new Date(
                            reviewerForm.membershipExpiresAt
                          ).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                          )
                        </span>
                      </>
                    );
                  })()}
                </p>
              </div>
            </CardContent>
          </Card>

          {hasReviewerUnsavedChanges && (
            <div className="flex justify-center gap-2">
              <Button
                onClick={handleSaveReviewer}
                disabled={isSavingReviewer}
                className="bg-main text-white hover:bg-main/90"
              >
                {isSavingReviewer ? "Saving…" : "Save"}
              </Button>
            </div>
          )}
        </>
      )}

      {!isPatient && !isReviewer && (
        <Card className="max-w-xl mx-auto">
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              No profile settings available for your role.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="max-w-xl mx-auto">
        <CardContent className="pt-6">
          <Button
            variant="destructive"
            onClick={async () => {
              setIsLoggingOut(true);
              try {
                logout();
              } finally {
                setIsLoggingOut(false);
              }
            }}
            disabled={isLoggingOut}
            className="w-full gap-2"
          >
            <LogOut className={`h-5 w-5 ${isLoggingOut ? "animate-spin" : ""}`} />
            {isLoggingOut ? "Logging out…" : "Log out"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
