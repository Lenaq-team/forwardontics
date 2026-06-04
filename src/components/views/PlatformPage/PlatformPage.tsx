"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useUser, useTimezone } from "@/contexts";
import {
    ProgressCard,
    LatestVideoCard,
} from "@/components"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Skeleton } from "@/components/ui"
import { CreateReviewerDialog } from "@/components/CreateReviewerDialog"
import { Star, UserPlus } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { exercises } from "@/lib/data/exercises"
import type { LatestVideo } from "@/components/atoms/LatestVideoCard"
import {
    usePatientMe,
    useReviewerMe,
    useAdminStats,
    useTodayStatus,
    useVideos,
} from "@/hooks"

const PlatformPage = () => {
    const { user, roles } = useUser();
    const { timezone } = useTimezone();
    const isAdmin = roles.some((r) => r?.toLowerCase() === "admin");
    const isAdminOrReviewer =
        isAdmin ||
        roles.some((r) => r?.toLowerCase() === "reviewer") ||
        roles.some((r) => r?.toLowerCase() === "reviewer-test");

    const { data: patientData, isLoading: patientLoading } = usePatientMe(!isAdminOrReviewer);
    const { data: reviewerData, isLoading: reviewerLoading } = useReviewerMe(isAdminOrReviewer);
    const { totalReviewers, totalPatients, isLoading: adminStatsLoading, mutate: mutateAdminStats } = useAdminStats(isAdmin);
    const { data: todayData, isLoading: todayLoading } = useTodayStatus(!isAdminOrReviewer ? (timezone || "UTC") : "");
    const { videos, isLoading: videosLoading } = useVideos(!isAdminOrReviewer);

    const patientFullName = patientData?.fullName ?? null;
    const patientNameFetched = isAdminOrReviewer || !patientLoading;
    const reviewerFullName = reviewerData?.fullname ?? null;
    const reviewerStats = reviewerData ? {
        totalPatientCapacity: typeof reviewerData.totalPatientCapacity === "number" ? reviewerData.totalPatientCapacity : 0,
        maxPatientCapacity: typeof reviewerData.maxPatientCapacity === "number" ? reviewerData.maxPatientCapacity : 0,
        pendingReviews: typeof reviewerData.pendingReviews === "number" ? reviewerData.pendingReviews : 0,
        totalReviewsMade: typeof reviewerData.totalReviewsMade === "number" ? reviewerData.totalReviewsMade : 0,
    } : null;
    const reviewerStatsFetched = !isAdminOrReviewer || !reviewerLoading;
    const exerciseStatus: Record<number, boolean> = todayData
        ? { 1: !!todayData[1], 2: !!todayData[2], 3: !!todayData[3] }
        : { 1: false, 2: false, 3: false };
    const currentStreak = typeof todayData?.currentStreak === "number" ? todayData.currentStreak : 0;
    const longestStreak = typeof todayData?.longestStreak === "number" ? todayData.longestStreak : 0;
    const totalCompletedDays = typeof todayData?.totalCompletedDays === "number" ? todayData.totalCompletedDays : 0;
    const todayStatusFetched = isAdminOrReviewer || !todayLoading;

    const latestVideo: LatestVideo | null = videos[0]
        ? {
            id: videos[0].id,
            date: videos[0].date,
            key: videos[0].key,
            bucket: videos[0].bucket,
            exerciseType: videos[0].exerciseType,
            rating: videos[0].rating,
            comments: videos[0].comments,
            status: (videos[0].status === "reviewed" || videos[0].status === "approved" ? videos[0].status : "pending") as LatestVideo["status"],
        }
        : null;
    const ratedVideos = videos.filter((v: { rating?: number | null }) => v.rating != null && v.rating >= 1 && v.rating <= 5);
    const averageRating =
        ratedVideos.length > 0
            ? ratedVideos.reduce((a: number, b: { rating?: number | null }) => a + (b.rating ?? 0), 0) / ratedVideos.length
            : null;
    const latestVideoFetched = isAdminOrReviewer || !videosLoading;

    const rawName = (isAdminOrReviewer ? reviewerFullName : patientFullName) || user?.name || "there";
    const firstWord = rawName.trim().split(/\s+/)[0] || rawName;
    const displayName = firstWord ? firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase() : rawName;

    const allCompleted = exerciseStatus[1] && exerciseStatus[2];

    const getMsUntilMidnight = useCallback((tz: string) => {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat("en-CA", {
            timeZone: tz || "UTC",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });
        const parts = formatter.formatToParts(now);
        const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
        const min = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
        const sec = parseInt(parts.find((p) => p.type === "second")?.value ?? "0", 10);
        const totalSec = hour * 3600 + min * 60 + sec;
        return (24 * 60 * 60 - totalSec) * 1000 - (1000 - now.getMilliseconds());
    }, []);

    const [timeLeft, setTimeLeft] = useState<string>("");
    const [createReviewerOpen, setCreateReviewerOpen] = useState(false);

    useEffect(() => {
        if (isAdminOrReviewer || !patientData?.membershipExpiresAt) return;
        const exp = new Date(patientData.membershipExpiresAt);
        if (exp <= new Date()) return;
        const days = Math.ceil((exp.getTime() - Date.now()) / 86400000);
        if (days > 7) return;
        const key = "membership-expiry-toast-shown";
        if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
        if (days === 0) {
            toast.warning("Your membership expires today. Contact your clinician to renew.");
        } else if (days === 1) {
            toast.warning("Your membership expires in 1 day. Contact your clinician to renew.");
        } else {
            toast.warning(`Your membership expires in ${days} days. Contact your clinician to renew.`);
        }
    }, [isAdminOrReviewer, patientData?.membershipExpiresAt]);

    useEffect(() => {
        if (allCompleted) return;
        const tz = timezone || "UTC";
        const update = () => {
            const ms = getMsUntilMidnight(tz);
            if (ms <= 0) {
                setTimeLeft("Day ended");
                return;
            }
            const h = Math.floor(ms / 3600000);
            const m = Math.floor((ms % 3600000) / 60000);
            const s = Math.floor((ms % 60000) / 1000);
            setTimeLeft(`${h}h ${m}m ${s}s`);
        };
        update();
        const id = setInterval(update, 1000);
        return () => clearInterval(id);
    }, [allCompleted, timezone, getMsUntilMidnight]);
    const formattedDate = new Date().toLocaleDateString("en-US", {
        timeZone: timezone || "UTC",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    const greetingLoading =
        !user ||
        (isAdminOrReviewer && !isAdmin && !reviewerStatsFetched) ||
        (!isAdminOrReviewer && !patientNameFetched);

    // FUTURE: Reviewer membership display. Uncomment when enforced:
    // const membershipExpiresAt = reviewerData?.membershipExpiresAt ?? null;
    const patientMembershipExpDate = !isAdminOrReviewer && patientData?.membershipExpiresAt ? new Date(patientData.membershipExpiresAt) : null;
    const patientMembershipDaysRemaining =
        patientMembershipExpDate && patientMembershipExpDate > new Date()
            ? Math.ceil((patientMembershipExpDate.getTime() - Date.now()) / 86400000)
            : patientMembershipExpDate ? 0 : null;
    const patientMembershipFormattedDate = patientMembershipExpDate
        ? patientMembershipExpDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
        : null;

    const greetingCard = greetingLoading ? (
        <Card className="mb-6">
            <CardContent className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-5 w-64" />
            </CardContent>
        </Card>
    ) : (
        <Card className="mb-6">
            <CardContent>
                <h2 className="text-2xl font-semibold">
                    {isAdminOrReviewer ? "Hello" : "Good day"}, {displayName}
                </h2>
                <p className="text-base text-muted-foreground">It&apos;s {formattedDate}</p>
                {/* FUTURE: Reviewer membership not enforced. Doctor limited by patient quota only. */}
                {!isAdminOrReviewer && patientNameFetched && patientData && (
                    <p className="mt-2 text-sm">
                        {patientData.isMembershipActive ? (
                            <span
                                className={
                                    patientMembershipDaysRemaining != null && patientMembershipDaysRemaining <= 30
                                        ? "text-amber-600 dark:text-amber-400"
                                        : "text-muted-foreground"
                                }
                            >
                                Membership: {patientMembershipFormattedDate ?? "—"}
                                {patientMembershipDaysRemaining != null
                                    ? ` · ${patientMembershipDaysRemaining} days remaining`
                                    : patientMembershipExpDate
                                        ? " · Expired"
                                        : " · Active"}
                            </span>
                        ) : (
                            <span className="text-red-600 dark:text-red-400">Membership expired</span>
                        )}
                    </p>
                )}
            </CardContent>
        </Card>
    );

    // Admin: Home shows only admin tasks (stats + links, no reviewer cards)
    if (isAdmin) {
        return (
            <div className="container mx-auto p-6 overflow-y-auto">
                {greetingCard}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {adminStatsLoading ? (
                        <>
                            <Card className="max-w-xl">
                                <CardHeader>
                                    <Skeleton className="h-5 w-32" />
                                </CardHeader>
                                <CardContent>
                                    <Skeleton className="h-10 w-16" />
                                </CardContent>
                            </Card>
                            <Card className="max-w-xl">
                                <CardHeader>
                                    <Skeleton className="h-5 w-32" />
                                </CardHeader>
                                <CardContent>
                                    <Skeleton className="h-10 w-16" />
                                </CardContent>
                            </Card>
                        </>
                    ) : (
                        <>
                            <Card className="max-w-xl">
                                <CardHeader>
                                    <CardTitle className="text-base">Total reviewers</CardTitle>
                                    <CardDescription>Reviewers in the platform</CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-row justify-between gap-3">
                                    <p className="text-2xl font-bold text-main">{totalReviewers}</p>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-fit border-accent text-accent hover:bg-accent/10 hover:text-accent/80"
                                        onClick={() => setCreateReviewerOpen(true)}
                                    >
                                        <UserPlus className="h-4 w-4 mr-1.5" />
                                        Create reviewer
                                    </Button>
                                    <CreateReviewerDialog
                                        open={createReviewerOpen}
                                        onOpenChange={setCreateReviewerOpen}
                                        onSuccess={mutateAdminStats}
                                    />
                                </CardContent>
                            </Card>
                            <Card className="max-w-xl">
                                <CardHeader>
                                    <CardTitle className="text-base">Total patients</CardTitle>
                                    <CardDescription>Enrolled patients</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold text-main">{totalPatients}</p>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // Reviewer (non-admin): reviewer dashboard cards
    if (isAdminOrReviewer) {
        return (
            <div className="container mx-auto p-6 overflow-y-auto">
                {greetingCard}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {!reviewerStatsFetched ? (
                        <>
                            <Card className="max-w-xl">
                                <CardHeader>
                                    <Skeleton className="h-5 w-48" />
                                </CardHeader>
                                <CardContent>
                                    <Skeleton className="h-10 w-24" />
                                </CardContent>
                            </Card>
                            <Card className="max-w-xl">
                                <CardHeader>
                                    <Skeleton className="h-5 w-40" />
                                </CardHeader>
                                <CardContent>
                                    <Skeleton className="h-10 w-16" />
                                </CardContent>
                            </Card>
                            <Card className="max-w-xl">
                                <CardHeader>
                                    <Skeleton className="h-5 w-40" />
                                </CardHeader>
                                <CardContent>
                                    <Skeleton className="h-10 w-16" />
                                </CardContent>
                            </Card>
                        </>
                    ) : (
                        <>

                            <Link href="/platform/patients" className="block">
                                <Card className="max-w-xl cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:border-main/50 dark:hover:border-main/50 border-2">
                                    <CardHeader>
                                        <CardTitle className="text-base">Assigned patients</CardTitle>
                                        <CardDescription>Of total possible capacity</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex justify-between items-center">
                                        <p className="text-2xl font-bold">
                                            <span className="text-main">{reviewerStats?.totalPatientCapacity ?? 0}</span> <span className="text-muted-foreground font-normal text-lg">/ {reviewerStats?.maxPatientCapacity ?? 0}</span>
                                        </p>
                                    </CardContent>
                                </Card>
                            </Link>

                            <Link href="/platform/pendingreviews" className="block">
                                <Card className="max-w-xl cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:border-amber-400/50 dark:hover:border-amber-500/50 border-2">
                                    <CardHeader>
                                        <CardTitle className="text-base">Pending reviews</CardTitle>
                                        <CardDescription>Videos awaiting your feedback</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{reviewerStats?.pendingReviews ?? 0}</p>
                                    </CardContent>
                                </Card>
                            </Link>
                            <Link href="/platform/completedreviews" className="block">
                                <Card className="max-w-xl cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:border-emerald-400/50 dark:hover:border-emerald-500/50 border-2">
                                    <CardHeader>
                                        <CardTitle className="text-base">Reviews completed</CardTitle>
                                        <CardDescription>Total videos you&apos;ve reviewed</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{reviewerStats?.totalReviewsMade ?? 0}</p>
                                    </CardContent>
                                </Card>
                            </Link>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 overflow-y-auto">

            {greetingCard}



            <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
                {/* Exercise streak card */}
                <div className="break-inside-avoid mb-6">
                    {!todayStatusFetched ? (
                        <Card>
                            <CardHeader>
                                <Skeleton className="h-6 w-3/4" />
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 gap-4">
                                    {exercises.map((exercise) => (
                                        <div
                                            key={exercise.id}
                                            className="break-inside-avoid rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 flex items-center justify-between gap-3"
                                        >
                                            <div className="min-w-0 flex-1 space-y-2">
                                                <Skeleton className="h-5 w-32" />
                                                <Skeleton className="h-6 w-20 rounded-full" />
                                            </div>
                                            <Skeleton className="h-14 w-14 rounded-full flex-shrink-0" />
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex flex-wrap items-center gap-2">
                                    {allCompleted
                                        ? "Day Completed — Keep It Going"
                                        : "Don't break the streak!"}
                                    {!allCompleted && timeLeft && (
                                        <span className="text-base font-normal text-muted-foreground tabular-nums">
                                            — {timeLeft} left
                                        </span>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1  gap-4">
                                    {exercises.map((exercise) => (
                                        <div
                                            key={exercise.id}
                                            className="break-inside-avoid rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 shadow-xl flex items-center justify-between gap-3"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-semibold mb-2">
                                                    {exercise.name}
                                                    {(exercise as { optional?: boolean }).optional && (
                                                        <span className="ml-2 text-xs font-normal text-muted-foreground">(Optional)</span>
                                                    )}
                                                </h3>
                                                <span
                                                    className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${exerciseStatus[exercise.id]
                                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                                        : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                                        }`}
                                                >
                                                    {exerciseStatus[exercise.id] ? "Completed" : "Pending"}
                                                </span>
                                            </div>
                                            {!exerciseStatus[exercise.id] && (patientData?.isMembershipActive ?? true) && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Link href={`/platform/recordvideo?exercise=${exercise.id}`}>
                                                            <Button
                                                                variant="destructive"
                                                                className="flex items-center justify-center h-14 w-14 rounded-full flex-shrink-0"
                                                            >
                                                                <div className="h-4 w-4 rounded-sm bg-white"></div>
                                                            </Button>
                                                        </Link>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        Record video for {exercise.name}
                                                    </TooltipContent>
                                                </Tooltip>
                                            )}
                                            {!exerciseStatus[exercise.id] && !(patientData?.isMembershipActive ?? true) && (
                                                <span className="text-sm text-muted-foreground">Membership expired</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* 30-Day Progress Card */}
                <div className="break-inside-avoid h-fit">
                    {!todayStatusFetched ? (
                        <Card className="w-full h-full">
                            <CardHeader>
                                <Skeleton className="h-5 w-full max-w-[12rem] mx-auto" />
                            </CardHeader>
                            <CardContent className="flex flex-col items-center space-y-4">
                                <Skeleton className="w-32 h-32 rounded-full" />
                                <div className="flex flex-col space-y-2 w-full">
                                    <Skeleton className="h-5 w-full" />
                                    <Skeleton className="h-5 w-full" />
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <ProgressCard
                            currentDays={currentStreak}
                            totalDays={30}
                            longestStreak={longestStreak}
                        />
                    )}
                </div>

                {/* Total Days Card - all-time completed days (not just consecutive) */}
                <div className="break-inside-avoid h-fit">
                    {!todayStatusFetched ? (
                        <Card className="w-full h-full">
                            <CardHeader>
                                <Skeleton className="h-5 w-32" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-10 w-16" />
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="w-full h-full">
                            <CardHeader>
                                <CardTitle className="text-base">Total days</CardTitle>
                                <CardDescription>All days you&apos;ve uploaded videos</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold tabular-nums">{totalCompletedDays} days</p>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Average Rating Card */}
                <div className="break-inside-avoid h-fit">
                    {!latestVideoFetched ? (
                        <Card className="w-full h-full">
                            <CardHeader>
                                <Skeleton className="h-5 w-32" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-10 w-24" />
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="w-full h-full">
                            <CardHeader>
                                <CardTitle className="text-base">Average rating</CardTitle>
                                <CardDescription>Your videos reviewed by your clinician</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {averageRating != null ? (
                                    <div className="flex items-center gap-2">
                                        <div className="flex">
                                            {[1, 2, 3, 4, 5].map((i) => (
                                                <Star
                                                    key={i}
                                                    className={`w-6 h-6 ${i <= Math.round(averageRating)
                                                        ? "fill-amber-400 text-amber-400"
                                                        : "text-neutral-200 dark:text-neutral-600"
                                                        }`}
                                                />
                                            ))}
                                        </div>
                                        <span className="text-2xl font-bold tabular-nums">
                                            {averageRating.toFixed(1)}<span className="text-base font-normal text-muted-foreground">/5</span>
                                        </span>
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-sm">No reviews yet. Submit videos to get feedback.</p>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Latest Video Card - only show when patient has videos */}
                {!latestVideoFetched ? (
                    <div className="break-inside-avoid h-fit">
                        <Card className="w-full h-full">
                            <CardHeader>
                                <Skeleton className="h-5 w-32 mx-auto" />
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between gap-2">
                                    <Skeleton className="h-6 w-16 rounded-full" />
                                    <Skeleton className="h-4 w-20" />
                                </div>
                                <Skeleton className="w-full aspect-video max-h-48 rounded-lg" />
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-12 w-full rounded-lg" />
                            </CardContent>
                        </Card>
                    </div>
                ) : videos.length > 0 ? (
                    <div className="break-inside-avoid h-fit">
                        <LatestVideoCard video={latestVideo} />
                    </div>
                ) : null}
                {/* Stats Card */}
                {/* <div className="break-inside-avoid h-fit">
                    <StatsCard
                        achievements={[
                            "You're in the top 25% of all users by streak length."
                        ]}
                        tips={[
                            "Tip: Engage your core to reduce lower back strain."
                        ]}
                    />
                </div> */}

                {/* Streak Card */}
                {/* <div className="break-inside-avoid h-fit">
                    <StreakCard
                        title="Don't break the streak!"
                        message="You haven't uploaded your Day 13 video yet. Keep the momentum going."
                        dayNumber={13}
                    />
                </div> */}

                {/* Random Forwardontics Video */}
                {/* <div className="break-inside-avoid h-fit">
                    <RandomVideoCard
                        videoTitle={randomVideo.title}
                        videoUrl={randomVideo.url}
                        viewCount={randomVideo.views}
                        publishedDate={randomVideo.date}
                    />
                </div> */}


            </div>
        </div>
    )
}

export default PlatformPage
