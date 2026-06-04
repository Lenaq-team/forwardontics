"use client";

import { useParams } from "next/navigation";
import { Home, ArrowLeft } from "lucide-react";
import Link from "next/link";
import VideoTable from "@/components/organisms/VideoTable/VideoTable";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePatientVideos } from "@/hooks";

export default function PatientVideosPage() {
  const params = useParams();
  const patientId = (params.patientId as string) ?? null;
  const { videos, patient, isLoading, isError, mutate } = usePatientVideos(patientId);
  const patientName = patient?.fullName ?? "Patient";

  if (isError) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-destructive space-y-4">
          <p>Failed to load patient videos. The patient may not exist or you may not have access.</p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={() => mutate()} className="gap-2">
              Retry
            </Button>
            <Link href="/platform/patients">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Patients
              </Button>
            </Link>
          </div>
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
            <BreadcrumbLink href="/platform/patients">My Patients</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            {isLoading ? (
              <Skeleton className="h-4 w-40" />
            ) : (
              <BreadcrumbPage>{patientName}&apos;s Videos</BreadcrumbPage>
            )}
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          {isLoading ? (
            <>
              <Skeleton className="h-9 w-36" />
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-72" />
            </>
          ) : (
            <>
              <Link href="/platform/patients">
                <Button variant="ghost" size="sm" className="gap-2 -ml-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Patients
                </Button>
              </Link>
              <h1 className="text-2xl font-bold">{patientName}&apos;s Videos</h1>
              <p className="text-muted-foreground text-sm">
                All video submissions from this patient
              </p>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {/* Search + Filter skeleton */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Skeleton className="h-10 flex-1 max-w-md" />
            <Skeleton className="h-10 w-[200px]" />
          </div>
          {/* Mobile card skeletons */}
          <div className="block lg:hidden space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-lg border p-4 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                  <Skeleton className="h-10 w-10 rounded" />
                </div>
                <div className="mb-3 space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="mb-3">
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table skeleton */}
          <div className="hidden lg:block overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-secondary">
                <TableRow className="border-b">
                  <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {/* Pagination skeleton */}
          <div className="flex items-center justify-end gap-8">
            <div className="hidden lg:flex items-center gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-20" />
            </div>
            <Skeleton className="h-4 w-24" />
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-8 w-8 rounded" />
              ))}
            </div>
          </div>
        </div>
      ) : videos.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          No videos submitted yet.
        </p>
      ) : (
        <VideoTable data={videos} />
      )}
    </div>
  );
}
