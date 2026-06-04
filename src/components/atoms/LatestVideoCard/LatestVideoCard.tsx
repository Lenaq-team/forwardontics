"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { ProxyVideo } from "@/components/atoms/ProxyVideo"
import { Star } from "lucide-react"
import { exercises } from "@/lib/data/exercises"

export type LatestVideo = {
    id: string
    date: string
    key: string
    bucket?: string
    exerciseType?: number
    rating: number | null
    comments?: string | null
    status: "pending" | "reviewed" | "approved"
}

interface LatestVideoCardProps {
    video?: LatestVideo | null
}

const LatestVideoCard = ({ video }: LatestVideoCardProps) => {
    const isPending = !video || video.status === "pending" || video.rating == null
    const rating = video?.rating ?? 0

    const renderStars = (r: number) => {
        return Array.from({ length: 5 }, (_, i) => (
            <Star
                key={i}
                className={`w-4 h-4 ${i < r ? "fill-orange-400 text-orange-400" : "text-gray-300"}`}
            />
        ))
    }

    const videoUrl = video?.key
        ? `/api/videos/proxy?key=${encodeURIComponent(video.key)}${video.bucket ? `&bucket=${encodeURIComponent(video.bucket)}` : ""}`
        : null
    const exerciseName = video?.exerciseType
        ? exercises.find((e) => e.id === video.exerciseType)?.name ?? "Exercise"
        : null

    return (
        <Card className="w-full h-full">
            <CardHeader>
                <CardTitle className="text-lg font-semibold text-center">LATEST VIDEO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 flex-1">
                {/* Rating / Status */}
                <div className="flex items-center justify-between gap-2">
                    {isPending ? (
                        <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Pending
                        </span>
                    ) : (
                        <div className="flex items-center space-x-2">
                            {renderStars(rating)}
                            <span className="text-sm text-gray-600 ml-2">{rating}/5</span>
                        </div>
                    )}
                    {video?.date && (
                        <span className="text-xs text-gray-500">
                            {new Date(video.date).toLocaleDateString("en-US")}
                        </span>
                    )}
                </div>

                {/* Video Player */}
                <div className="relative w-full aspect-video max-h-48 bg-gray-200 rounded-lg overflow-hidden">
                    {videoUrl ? (
                        <ProxyVideo
                            src={videoUrl}
                            controls
                            className="w-full h-full object-contain"
                            preload="metadata"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                            No videos yet
                        </div>
                    )}
                </div>

                {/* Exercise + Feedback */}
                {exerciseName && (
                    <p className="text-xs text-gray-500">{exerciseName}</p>
                )}
                <div className="text-sm text-gray-700 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                    {isPending
                        ? "Awaiting review from your doctor."
                        : (video?.comments ?? "No feedback yet.")}
                </div>
            </CardContent>
        </Card>
    )
}

export default LatestVideoCard