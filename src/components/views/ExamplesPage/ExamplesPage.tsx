"use client";

import { Home } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProxyVideo } from "@/components/atoms/ProxyVideo";
import { Skeleton } from "@/components/ui/skeleton";
import { useExamples } from "@/hooks";

type ExampleVideo = { key: string; name: string };

const ExamplesPage = () => {
  const { videos, isLoading, isError, mutate } = useExamples();

  if (isError) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-destructive space-y-4">
          <p>Failed to load examples</p>
          <button
            onClick={() => mutate()}
            className="px-4 py-2 bg-main text-white rounded hover:bg-main/90"
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
            <BreadcrumbPage>Examples</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-2xl font-bold mb-1">Example Videos</h1>
        <p className="text-muted-foreground text-sm">
          Reference videos to guide correct exercise form and technique.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-[75%]" />
              </CardHeader>
              <CardContent>
                <Skeleton className="aspect-video w-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : videos.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          No example videos available.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((v: ExampleVideo) => (
            <Card key={v.key} className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{v.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                  <ProxyVideo
                    src={`/api/videos/proxy?key=${encodeURIComponent(v.key)}&bucket=${encodeURIComponent("gopex-examples")}`}
                    controls
                    className="w-full h-full object-contain"
                    preload="metadata"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExamplesPage;
