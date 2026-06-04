import { Suspense } from "react";
import { PatientVideoComponent } from "@/components";
import { Skeleton } from "@/components/ui/skeleton";

export default function RecordVideo() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen p-6 space-y-6">
                    <Skeleton className="h-10 w-48" />
                    <div className="flex flex-col lg:flex-row gap-6">
                        <Skeleton className="flex-1 aspect-video rounded-lg max-h-[70vh]" />
                        <div className="space-y-4 w-full lg:w-80">
                            <Skeleton className="h-12 w-full rounded-lg" />
                            <Skeleton className="h-32 w-full rounded-lg" />
                            <Skeleton className="h-10 w-full rounded-lg" />
                            <Skeleton className="h-10 w-full rounded-lg" />
                        </div>
                    </div>
                </div>
            }
        >
            <PatientVideoComponent />
        </Suspense>
    );
}