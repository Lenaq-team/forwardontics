"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Play, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSWRConfig } from "swr";
import { Review } from "@/hooks/useData";
import { Skeleton } from "@/components/ui/skeleton";
import { ProxyVideo } from "@/components/atoms/ProxyVideo";

const getVideoUrl = (s3Key: string | undefined, bucket?: string): string | null => {
    if (!s3Key) return null;
    const params = new URLSearchParams({ key: s3Key });
    if (bucket) params.set("bucket", bucket);
    return `/api/videos/proxy?${params.toString()}`;
};

const EditPage = () => {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { mutate } = useSWRConfig();
    // FUTURE: Reviewer membership not enforced. Uncomment to hide submit when expired:
    // const { data: reviewerData } = useReviewerMe(true);
    // const isMembershipActive = reviewerData?.isMembershipActive ?? false;
    const [review, setReview] = useState<Review | null>(null);
    const [loading, setLoading] = useState(true);
    const [rating, setRating] = useState<number | null>(null);
    const [comments, setComments] = useState("");

    useEffect(() => {
        const loadReview = async () => {
            setLoading(true);
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 500));

            // Get review data from URL parameters
            const reviewDataParam = searchParams.get('data');

            if (reviewDataParam) {
                try {
                    const reviewData = JSON.parse(decodeURIComponent(reviewDataParam));
                    setReview(reviewData);
                    setRating(reviewData.rating || null);
                    setComments(reviewData.comments || "");
                } catch (error) {
                    console.error('Error parsing review data:', error);
                    setReview(null);
                }
            } else {
                // Fallback: try to find review by slug if no data parameter
                const slug = params.slug as string;
                console.warn('No review data in URL, falling back to slug-based lookup');
                setReview(null);
            }

            setLoading(false);
        };

        loadReview();
    }, [params.slug, searchParams]);

    const handleSubmitEdit = async () => {
        if (!review || rating == null) return;

        setLoading(true);
        try {
            const res = await fetch(`/api/reviewers/reviews/${review.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ rating, comments }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error ?? "Failed to update review");
            }
            await mutate("/api/reviewers/completed-reviews");
            await mutate("/api/reviewers/me");
            if (review.patientId) await mutate(`/api/reviewers/patients/${review.patientId}/videos`);
            router.push("/platform/completedreviews");
        } catch (err) {
            console.error("Update review error:", err);
            alert(err instanceof Error ? err.message : "Failed to update review");
        } finally {
            setLoading(false);
        }
    };

    const renderStars = (rating: number | null, interactive = false) => {
        return (
            <div className="flex items-center gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                    <Star
                        key={i}
                        className={`w-6 h-6 cursor-pointer ${i < (rating || 0)
                            ? 'fill-orange-400 text-orange-400'
                            : 'text-gray-300'
                            }`}
                        onClick={() => interactive && setRating(i + 1)}
                    />
                ))}
                <span className="text-sm text-gray-600 ml-2">
                    {rating ? `${rating}/5` : 'Not rated'}
                </span>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="p-6 w-full max-w-4xl mx-auto mt-8 md:mt-0 space-y-8">
                <div className="flex flex-col gap-4">
                    <Skeleton className="h-10 w-36" />
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="w-full aspect-video rounded-lg" />
                        <div className="space-y-2 p-4 border rounded-lg">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-4 w-36" />
                        </div>
                    </div>
                    <div className="space-y-6">
                        <Skeleton className="h-6 w-28" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-24 w-full rounded-lg" />
                        <Skeleton className="h-32 w-full rounded-lg" />
                        <Skeleton className="h-12 w-full rounded-lg" />
                    </div>
                </div>
            </div>
        );
    }

    if (!review) {
        return (
            <div className="p-6 max-w-4xl mx-auto mt-8 md:mt-0">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Review Not Found</h1>
                    <p className="text-gray-600 mb-6">The requested review could not be found.</p>
                    <Button onClick={() => router.push("/platform/completedreviews")} className="bg-main text-white hover:bg-main/90">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Completed Reviews
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 w-full mx-auto mt-8 md:mt-0">
            {/* Header */}
            <div className="mb-8">
                <Button
                    variant="ghost"
                    onClick={() => router.push("/platform/completedreviews")}
                    className="mb-4 has-[>svg]:px-0 "
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Completed Reviews
                </Button>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Review</h1>
                <p className="text-gray-600">
                    Edit the review for <span className="font-bold">{review.patientName}</span>
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Video Section */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-900">Video Submission</h2>
                    <div className="bg-gray-100 rounded-lg p-4">
                        <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
                            {review.videoS3Key ? (
                                <ProxyVideo
                                    src={getVideoUrl(review.videoS3Key, review.bucket)!}
                                    controls
                                    className="w-full h-full rounded-lg object-contain"
                                />
                            ) : (
                                <div className="text-center">
                                    <Play className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                                    <p className="text-sm text-gray-600">Video Player</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {review.videoS3Key?.replace('.mp4', '') || 'No video'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border p-4">
                        <h3 className="font-medium text-gray-900 mb-2">Patient Information</h3>
                        <div className="space-y-2 text-sm">
                            <div>
                                <span className="text-gray-500">Name:</span>
                                <span className="ml-2 font-medium">{review.patientName}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">Email:</span>
                                <span className="ml-2 font-medium">{review.patientEmail}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">Submitted:</span>
                                <span className="ml-2 font-medium">
                                    {new Date(review.submittedDate).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </span>
                            </div>
                            {review.reviewerName && (
                                <div>
                                    <span className="text-gray-500">Reviewed by:</span>
                                    <span className="ml-2 font-medium">{review.reviewerName}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Review Form */}
                <div className="space-y-6">
                    <h2 className="text-xl font-semibold text-gray-900">Edit Form</h2>

                    {/* Rating */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Rating</label>
                        {renderStars(rating, true)}
                    </div>

                    {/* Comments */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Comments</label>
                        <textarea
                            value={comments}
                            onChange={(e) => setComments(e.target.value)}
                            placeholder="Update your feedback about the patient's performance..."
                            className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-accent focus:border-transparent"
                        />
                    </div>

                    {/* Submit Button (FUTURE: wrap in isMembershipActive when reviewer membership enforced) */}
                    <Button
                        onClick={handleSubmitEdit}
                        disabled={!rating || !comments.trim()}
                        className="w-full bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
                        size="lg"
                    >
                        Save Changes
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default EditPage; 