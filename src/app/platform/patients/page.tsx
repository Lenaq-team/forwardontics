import { Suspense } from "react";
import AssignedPatientsPage from "@/components/views/AssignedPatientsPage/AssignedPatientsPage";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function PatientsPageSkeleton() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex gap-2 items-center">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <Skeleton className="h-5 w-28 mb-2" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-9 w-28" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex justify-between items-center gap-4 p-4 rounded-lg border">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-10 w-10 rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PatientsPage() {
  return (
    <Suspense fallback={<PatientsPageSkeleton />}>
      <AssignedPatientsPage />
    </Suspense>
  );
}
