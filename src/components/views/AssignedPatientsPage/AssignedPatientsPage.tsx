"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Home, Film, UserPlus, Loader2 } from "lucide-react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FULL_NAME_REGEX = /^[a-zA-Z\s]*$/;
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssignedPatients } from "@/hooks";

const AssignedPatientsPage = () => {
  const searchParams = useSearchParams();
  const { patients, maxPatientCapacity, isLoading, isError, mutate } = useAssignedPatients();
  // FUTURE: Reviewer membership not enforced. Doctor limited by patient quota only. Patient 90-day enrollment may be added.
  // const { data: reviewerData } = useReviewerMe(true);
  // const membershipExpiresAt = reviewerData?.membershipExpiresAt ?? null;
  // const membershipDaysRemaining = membershipExpiresAt && (reviewerData?.isMembershipActive ?? false)
  //   ? Math.ceil((new Date(membershipExpiresAt).getTime() - Date.now()) / 86400000) : null;
  // const showMembershipWarning = membershipDaysRemaining != null && membershipDaysRemaining < 30;
  const atCapacity = patients.length >= maxPatientCapacity;
  const cannotAddPatient = atCapacity;
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [debouncedEmail, setDebouncedEmail] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
    !submitLoading;

  useEffect(() => {
    if (searchParams.get("add") === "1" && !isLoading && !cannotAddPatient) {
      setAddDialogOpen(true);
    }
  }, [searchParams, isLoading, cannotAddPatient]);

  const clearAddPatientForm = () => {
    setEmail("");
    setFullName("");
    setDebouncedEmail("");
    setSubmitError(null);
  };

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitError(null);
    setSubmitLoading(true);
    try {
      const res = await fetch("/api/reviewers/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), fullName: fullName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to create patient");
      }
      setAddDialogOpen(false);
      clearAddPatientForm();
      mutate();
      toast.success("Patient invited successfully", {
        description: "They will receive an email to set up their account.",
        style: {
          background: "rgba(0, 160, 154, 0.1)",
          color: "#00a09a",
          border: "1px solid rgba(0, 160, 154, 0.4)",
        },
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitLoading(false);
    }
  };

  if (isError) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-destructive">
          <p>Failed to load patients</p>
          <button
            onClick={() => mutate()}
            className="mt-2 px-4 py-2 bg-main text-white rounded hover:bg-main/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Breadcrumb className="mb-6 hidden md:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/platform">
              <Home className="h-4 w-4" />
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>My Patients</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-2xl font-bold mb-1">Assigned Patients</h1>
        <p className="text-muted-foreground text-sm">
          Patients assigned to you for video reviews. You can have up to {maxPatientCapacity} patients.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Patient List</CardTitle>
            <CardDescription>
              {isLoading ? (
                <Skeleton className="h-4 w-32" />
              ) : (
                `${patients.length}/${maxPatientCapacity} patient${patients.length !== 1 ? "s" : ""} assigned`
              )}
            </CardDescription>
          </div>
          <Button
            onClick={() => {
              if (!cannotAddPatient) {
                setAddDialogOpen(true);
                setSubmitError(null);
              }
            }}
            disabled={cannotAddPatient}
            className="bg-accent hover:bg-accent/90 text-white shrink-0 disabled:opacity-70 disabled:cursor-not-allowed"
            title={atCapacity ? `Patient limit reached (${maxPatientCapacity} maximum)` : undefined}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add Patient
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <>
              <div className="block lg:hidden space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="bg-white rounded-lg border p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-40" />
                      </div>
                      <Skeleton className="h-8 w-8 rounded" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                    <div className="flex justify-between mt-3">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden lg:block overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader className="bg-secondary text-white sticky top-0 z-10">
                    <TableRow className="bg-secondary text-white">
                      <TableHead className="text-white"><Skeleton className="h-4 w-16 bg-white/20" /></TableHead>
                      <TableHead className="text-white"><Skeleton className="h-4 w-12 bg-white/20" /></TableHead>
                      <TableHead className="text-white"><Skeleton className="h-4 w-12 bg-white/20" /></TableHead>
                      <TableHead className="text-white"><Skeleton className="h-4 w-14 bg-white/20" /></TableHead>
                      <TableHead className="text-white text-right"><Skeleton className="h-4 w-20 ml-auto bg-white/20" /></TableHead>
                      <TableHead className="text-white text-right"><Skeleton className="h-4 w-24 ml-auto bg-white/20" /></TableHead>
                      <TableHead className="text-white text-right"><Skeleton className="h-4 w-24 ml-auto bg-white/20" /></TableHead>
                      <TableHead className="text-white text-right"><Skeleton className="h-4 w-8 bg-white/20" /></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="data-[slot=table-cell]:first:w-8 data-[slot=table-cell]:last:w-2">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <TableRow key={i} className="bg-white">
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-4 w-10 ml-auto" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                        <TableCell className="text-left w-8"><Skeleton className="h-8 w-8 rounded" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : patients.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              No patients assigned yet.
            </p>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block lg:hidden space-y-4">

                {patients.map((p) => (
                  <div
                    key={p.id}
                    className="bg-white rounded-lg border p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-500">Patient</span>
                        <span className="font-medium text-gray-900">
                          {p.fullName || "—"}
                        </span>
                        <span className="text-sm text-gray-500">
                          {p.email || "—"}
                        </span>
                        <span className="text-sm text-gray-500">
                          {p.phone || "—"}
                        </span>
                      </div>
                      <Link href={`/platform/patients/${p.id}/videos`}>
                        <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 bg-accent hover:bg-accent/80 text-white">
                          <Film className="h-5 w-5" />
                        </Button>
                      </Link>
                    </div>
                    <div className="mb-3">
                      <span className="text-sm text-gray-500">Status</span>
                      <div className="mt-1">
                        <Badge
                          variant={
                            p.status === "active" ? "default" : "secondary"
                          }
                          className={
                            p.status === "active"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : ""
                          }
                        >
                          {p.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <div>
                        <span className="text-gray-500">Current streak: </span>
                        <span className="font-medium">{p.currentStreakDays} days</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Longest: </span>
                        <span className="font-medium">{p.longestStreakDays} days</span>
                      </div>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-500">Membership: </span>
                      <span className={`font-medium ${p.membershipDaysRemaining != null && p.membershipDaysRemaining < 0 ? "text-red-600" : p.membershipDaysRemaining != null && p.membershipDaysRemaining <= 7 ? "text-amber-600" : ""}`}>
                        {p.membershipDaysRemaining == null ? "—" : p.membershipDaysRemaining < 0 ? "Expired" : `${p.membershipDaysRemaining} days left`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader className="bg-secondary text-white sticky top-0 z-10">
                    <TableRow className="bg-secondary text-white">
                      <TableHead className="text-white">Name</TableHead>
                      <TableHead className="text-white">Email</TableHead>
                      <TableHead className="text-white">Phone</TableHead>
                      <TableHead className="text-white">Status</TableHead>
                      <TableHead className="text-white text-right">Membership</TableHead>
                      <TableHead className="text-white text-right">Current Streak</TableHead>
                      <TableHead className="text-white text-right">Longest Streak</TableHead>
                      <TableHead className="text-white text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="data-[slot=table-cell]:first:w-8 data-[slot=table-cell]:last:w-2">
                    {patients.map((p) => (
                      <TableRow key={p.id} className="bg-white">
                        <TableCell className="font-medium">
                          {p.fullName || "—"}
                        </TableCell>
                        <TableCell>{p.email || "—"}</TableCell>
                        <TableCell>{p.phone || "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              p.status === "active" ? "default" : "secondary"
                            }
                            className={
                              p.status === "active"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : ""
                            }
                          >
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={p.membershipDaysRemaining != null && p.membershipDaysRemaining < 0 ? "text-red-600 font-medium" : p.membershipDaysRemaining != null && p.membershipDaysRemaining <= 7 ? "text-amber-600 font-medium" : ""}>
                            {p.membershipDaysRemaining == null ? "—" : p.membershipDaysRemaining < 0 ? "Expired" : `${p.membershipDaysRemaining}d`}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {p.currentStreakDays} days
                        </TableCell>
                        <TableCell className="text-right">
                          {p.longestStreakDays} days
                        </TableCell>
                        <TableCell className="text-left w-8">
                          <Link href={`/platform/patients/${p.id}/videos`}>
                            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 bg-accent hover:bg-accent/80 text-white">
                              <Film className="h-5 w-5" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) clearAddPatientForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Patient</DialogTitle>
            <DialogDescription>
              Enter full name and email. They will receive an invitation to set their password. The patient will be assigned to you as their reviewer.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddPatient} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="add-patient-fullname">Full name *</Label>
              <Input
                id="add-patient-fullname"
                type="text"
                placeholder="JOHN DOE"
                value={fullName}
                onChange={(e) => setFullName(e.target.value.toUpperCase())}
                disabled={submitLoading}
                className="uppercase"
                aria-invalid={!!fullNameError}
              />
              {fullNameError && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">{fullNameError}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-patient-email">Email *</Label>
              <Input
                id="add-patient-email"
                type="email"
                placeholder="patient@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitLoading}
                autoComplete="email"
                aria-invalid={!!emailError}
              />
              {emailError && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">{emailError}</p>
              )}
            </div>
            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  clearAddPatientForm();
                  setAddDialogOpen(false);
                }}
                disabled={submitLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-main hover:bg-main/90 text-white"
                disabled={!canSubmit}
              >
                {submitLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create Patient"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AssignedPatientsPage;
