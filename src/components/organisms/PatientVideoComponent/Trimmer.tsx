import React, { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Pause } from "lucide-react";

interface VideoSegmentPlayerProps {
    videoBlob: Blob;
    recordingDuration: number;
    onSegmentChange?: (segmentStart: number, segmentEnd: number) => void;
}

export default function VideoSegmentPlayer({ videoBlob, recordingDuration, onSegmentChange }: VideoSegmentPlayerProps) {
    const SEGMENT_DURATION = 3; // seconds

    const videoRef = useRef<HTMLVideoElement>(null);
    const [videoUrl, setVideoUrl] = useState<string>("");
    const [videoDuration, setVideoDuration] = useState<number>(0);
    const [segmentStart, setSegmentStart] = useState<number>(0);
    const [segmentEnd, setSegmentEnd] = useState<number>(SEGMENT_DURATION);
    const [isVideoLoaded, setIsVideoLoaded] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    // Segment dragging state
    const [isDraggingSegment, setIsDraggingSegment] = useState(false);
    const [dragStartX, setDragStartX] = useState(0);
    const [dragStartSegmentStart, setDragStartSegmentStart] = useState(0);
    const [dragType, setDragType] = useState<'start' | 'end' | null>(null);

    // Current video time state for indicator
    const [currentTime, setCurrentTime] = useState<number>(0);

    // Refs for smooth dragging performance
    const lastSeekTimeRef = useRef(0);

    // Create URL from blob
    useEffect(() => {
        if (!videoBlob) return;
        if (videoBlob.size === 0) {
            console.error("Video blob is empty");
            return;
        }
        const url = URL.createObjectURL(videoBlob);
        setVideoUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [videoBlob]);

    // Set initial durations from recordingDuration or video metadata
    useEffect(() => {
        if (recordingDuration > 0) {
            setVideoDuration(recordingDuration);
            setSegmentStart(0);
            setSegmentEnd(Math.min(SEGMENT_DURATION, recordingDuration));
            setIsVideoLoaded(true);
        }
    }, [recordingDuration]);

    // Listen for loadedmetadata to get duration if recordingDuration not provided
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onLoadedMetadata = () => {
            if (recordingDuration <= 0 || !isFinite(recordingDuration)) {
                const dur = video.duration;
                if (isFinite(dur) && dur > 0) {
                    setVideoDuration(dur);
                    setSegmentStart(0);
                    setSegmentEnd(Math.min(SEGMENT_DURATION, dur));
                    setIsVideoLoaded(true);
                }
            }
        };

        video.addEventListener("loadedmetadata", onLoadedMetadata);
        return () => video.removeEventListener("loadedmetadata", onLoadedMetadata);
    }, [videoUrl, recordingDuration]);

    // Play segment
    const playSegment = () => {
        if (!videoRef.current) return;

        if (videoRef.current.paused) {
            videoRef.current.currentTime = segmentStart;
            videoRef.current.play();
            setIsPlaying(true);
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
        }
    };

    // Pause at segment end and handle segment boundaries
    const onTimeUpdate = () => {
        if (!videoRef.current) return;

        // Update current time state for indicator
        setCurrentTime(videoRef.current.currentTime);

        // Pause at segment end
        if (videoRef.current.currentTime >= segmentEnd) {
            videoRef.current.pause();
            setIsPlaying(false);
        } else if (videoRef.current.currentTime < segmentStart) {
            // If video jumped outside segment, reset to start
            videoRef.current.currentTime = segmentStart;
        }
    };

    // Handle segment slider mouse down
    const handleSegmentSliderMouseDown = useCallback((e: React.MouseEvent) => {
        if (!isVideoLoaded) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickPercent = clickX / rect.width;
        const clickTime = clickPercent * videoDuration;

        // Calculate new segment start, ensuring it doesn't exceed video duration
        const newStart = Math.max(0, Math.min(clickTime, videoDuration - SEGMENT_DURATION));

        setSegmentStart(newStart);
        setSegmentEnd(newStart + SEGMENT_DURATION);

        // Update video position to match
        if (videoRef.current) {
            videoRef.current.currentTime = newStart;
        }

        // Start dragging
        setIsDraggingSegment(true);
        setDragStartX(e.clientX);
        setDragStartSegmentStart(newStart);
    }, [isVideoLoaded, videoDuration]);

    // Handle segment slider touch start
    const handleSegmentSliderTouchStart = useCallback((e: React.TouchEvent) => {
        if (!isVideoLoaded) return;

        const touch = e.touches[0];
        const rect = e.currentTarget.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const touchPercent = touchX / rect.width;
        const touchTime = touchPercent * videoDuration;

        // Calculate new segment start, ensuring it doesn't exceed video duration
        const newStart = Math.max(0, Math.min(touchTime, videoDuration - SEGMENT_DURATION));

        setSegmentStart(newStart);
        setSegmentEnd(newStart + SEGMENT_DURATION);

        // Update video position to match
        if (videoRef.current) {
            videoRef.current.currentTime = newStart;
        }

        // Start dragging
        setIsDraggingSegment(true);
        setDragStartX(touch.clientX);
        setDragStartSegmentStart(newStart);
    }, [isVideoLoaded, videoDuration]);

    // Handle segment slider mouse up
    const handleSegmentSliderMouseUp = () => {
        setIsDraggingSegment(false);
        setDragStartX(0);
        setDragStartSegmentStart(0);
    };

    // Handle segment slider touch end
    const handleSegmentSliderTouchEnd = () => {
        setIsDraggingSegment(false);
        setDragStartX(0);
        setDragStartSegmentStart(0);
    };

    // Handle segment handle mouse down
    const handleSegmentHandleMouseDown = (e: React.MouseEvent, handleType: 'start' | 'end') => {
        if (!isVideoLoaded) return;
        e.stopPropagation();

        // Start dragging
        setIsDraggingSegment(true);
        setDragType(handleType);
        setDragStartX(e.clientX);
        setDragStartSegmentStart(segmentStart);
    };

    // Handle segment handle touch start
    const handleSegmentHandleTouchStart = (e: React.TouchEvent, handleType: 'start' | 'end') => {
        if (!isVideoLoaded) return;
        e.stopPropagation();

        const touch = e.touches[0];

        // Start dragging
        setIsDraggingSegment(true);
        setDragType(handleType);
        setDragStartX(touch.clientX);
        setDragStartSegmentStart(segmentStart);
    };

    // Global mouse and touch event listeners for segment dragging
    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (!isDraggingSegment || !isVideoLoaded) return;

            const deltaX = e.clientX - dragStartX;
            const sliderElement = document.querySelector('[data-segment-slider]');
            if (!sliderElement) return;

            const rect = sliderElement.getBoundingClientRect();
            const deltaPercent = deltaX / rect.width;
            const deltaTime = deltaPercent * videoDuration;

            if (dragType === 'start') {
                // Moving start handle - end handle follows to maintain 3-second gap
                const newStart = Math.max(0, Math.min(dragStartSegmentStart + deltaTime, videoDuration - SEGMENT_DURATION));

                // Update state immediately for smooth UI
                setSegmentStart(newStart);
                setSegmentEnd(newStart + SEGMENT_DURATION);

                // Throttled video seeking for smooth performance
                seekVideo(newStart);
            } else if (dragType === 'end') {
                // Moving end handle - start handle follows to maintain 3-second gap
                const newEnd = Math.min(videoDuration, Math.max(dragStartSegmentStart + SEGMENT_DURATION + deltaTime, SEGMENT_DURATION));

                // Update state immediately for smooth UI
                setSegmentEnd(newEnd);
                setSegmentStart(newEnd - SEGMENT_DURATION);

                // Throttled video seeking for smooth performance
                seekVideo(newEnd - SEGMENT_DURATION);
            } else {
                // Moving entire segment
                const newStart = Math.max(0, Math.min(dragStartSegmentStart + deltaTime, videoDuration - SEGMENT_DURATION));

                // Update state immediately for smooth UI
                setSegmentStart(newStart);
                setSegmentEnd(newStart + SEGMENT_DURATION);

                // Throttled video seeking for smooth performance
                seekVideo(newStart);
            }
        };

        const handleGlobalTouchMove = (e: TouchEvent) => {
            if (!isDraggingSegment || !isVideoLoaded) return;

            const touch = e.touches[0];
            const deltaX = touch.clientX - dragStartX;
            const sliderElement = document.querySelector('[data-segment-slider]');
            if (!sliderElement) return;

            const rect = sliderElement.getBoundingClientRect();
            const deltaPercent = deltaX / rect.width;
            const deltaTime = deltaPercent * videoDuration;

            if (dragType === 'start') {
                // Moving start handle - end handle follows to maintain 3-second gap
                const newStart = Math.max(0, Math.min(dragStartSegmentStart + deltaTime, videoDuration - SEGMENT_DURATION));
                setSegmentStart(newStart);
                setSegmentEnd(newStart + SEGMENT_DURATION);

                // Throttled video seeking for smooth performance
                seekVideo(newStart);
            } else if (dragType === 'end') {
                // Moving end handle - start handle follows to maintain 3-second gap
                const newEnd = Math.min(videoDuration, Math.max(dragStartSegmentStart + SEGMENT_DURATION + deltaTime, SEGMENT_DURATION));
                setSegmentEnd(newEnd);
                setSegmentStart(newEnd - SEGMENT_DURATION);

                // Throttled video seeking for smooth performance
                seekVideo(newEnd - SEGMENT_DURATION);
            } else {
                // Moving entire segment
                const newStart = Math.max(0, Math.min(dragStartSegmentStart + deltaTime, videoDuration - SEGMENT_DURATION));
                setSegmentStart(newStart);
                setSegmentEnd(newStart + SEGMENT_DURATION);

                // Throttled video seeking for smooth performance
                seekVideo(newStart);
            }
        };

        const handleGlobalMouseUp = () => {
            setIsDraggingSegment(false);
            setDragType(null);
            setDragStartX(0);
            setDragStartSegmentStart(0);
        };

        const handleGlobalTouchEnd = () => {
            setIsDraggingSegment(false);
            setDragType(null);
            setDragStartX(0);
            setDragStartSegmentStart(0);
        };

        if (isDraggingSegment) {
            document.addEventListener('mousemove', handleGlobalMouseMove);
            document.addEventListener('mouseup', handleGlobalMouseUp);
            document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
            document.addEventListener('touchend', handleGlobalTouchEnd);
        }

        return () => {
            document.removeEventListener('mousemove', handleGlobalMouseMove);
            document.removeEventListener('mouseup', handleGlobalMouseUp);
            document.removeEventListener('touchmove', handleGlobalTouchMove);
            document.removeEventListener('touchend', handleGlobalTouchEnd);
        };
    }, [isDraggingSegment, dragType, isVideoLoaded, videoDuration, dragStartX, dragStartSegmentStart]);

    // Keep video position synchronized with segment start
    useEffect(() => {
        if (videoRef.current && isVideoLoaded && !isDraggingSegment) {
            // Only update if not currently dragging to avoid conflicts
            videoRef.current.currentTime = segmentStart;
        }
    }, [segmentStart, isVideoLoaded, isDraggingSegment]);

    // Notify parent component of segment changes
    useEffect(() => {
        if (onSegmentChange && isVideoLoaded) {
            onSegmentChange(segmentStart, segmentEnd);
        }
    }, [segmentStart, segmentEnd, onSegmentChange, isVideoLoaded]);

    // Optimized video seeking function with throttling
    const seekVideo = (time: number, force = false) => {
        if (!videoRef.current) return;

        const now = Date.now();

        // Throttle seeking to every 16ms (60fps) unless forced
        if (!force && now - lastSeekTimeRef.current < 16) {
            return;
        }

        lastSeekTimeRef.current = now;

        // Use requestAnimationFrame for smooth seeking
        requestAnimationFrame(() => {
            if (videoRef.current) {
                videoRef.current.currentTime = time;
            }
        });
    };

    return (
        <>
            {videoUrl ? (
                <div className="relative w-full max-h-[60vh] max-w-[60vh]">
                    <video
                        ref={videoRef}
                        src={videoUrl}
                        onTimeUpdate={onTimeUpdate}
                        className="w-full max-h-[60vh] max-w-[60vh] rounded-md"
                        style={{ objectFit: "cover" }}
                        preload="metadata"
                    />

                    {/* Custom Video Controls */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 rounded-b-md">
                        {/* Unified Segment Slider with Video Progress */}
                        <div className="mb-3">
                            {/* Unified Slider - Shows both segment and video progress */}
                            <div className="mb-4 flex flex-col items-center">
                                <div
                                    className={`relative bg-gray-600 rounded-full h-2 ${!isVideoLoaded ? 'opacity-50 cursor-not-allowed' : isDraggingSegment ? 'cursor-grabbing' : 'cursor-grab'}`}
                                    style={{ width: '100%', maxWidth: '400px' }}
                                    onMouseDown={handleSegmentSliderMouseDown}
                                    onMouseUp={handleSegmentSliderMouseUp}
                                    onMouseLeave={handleSegmentSliderMouseUp}
                                    onTouchStart={handleSegmentSliderTouchStart}
                                    onTouchEnd={handleSegmentSliderTouchEnd}
                                    data-segment-slider
                                >
                                    {/* Video progress indicator (darker blue) - shows progress only within segment boundaries */}
                                    <div
                                        className="absolute bg-main h-2 "
                                        style={{
                                            left: `${(segmentStart / videoDuration) * 100}%`,
                                            width: `${((Math.min(segmentStart + SEGMENT_DURATION, currentTime) - segmentStart) / videoDuration) * 100}%`
                                        }}
                                    ></div>

                                    {/* Segment range indicator (brighter blue) */}
                                    <div
                                        className="absolute bg-main h-2 "
                                        style={{
                                            left: `${(Math.max(0, segmentStart - 0.1) / videoDuration) * 100}%`,
                                            width: `${((SEGMENT_DURATION + 0.2) / videoDuration) * 100}%`
                                        }}
                                    ></div>

                                    {/* Current video position indicator (thin red line) - constrained to segment boundaries, avoiding handles */}
                                    {!isDraggingSegment && (
                                        <div
                                            className="absolute w-3 h-3 bg-white shadow-sm z-10 rounded-full"
                                            style={{
                                                left: `${(() => {
                                                    const constrainedTime = Math.max(segmentStart + 0.05, Math.min(segmentStart + SEGMENT_DURATION - 0.05, currentTime));
                                                    return (constrainedTime / videoDuration) * 100;
                                                })()}%`,
                                                top: '50%',
                                                transform: 'translate(-50%, -50%)'
                                            }}
                                        ></div>
                                    )}

                                    {/* Start handle */}
                                    <div
                                        className={`absolute w-3 h-6 bg-main border-1 border-main shadow-md ${isVideoLoaded ? 'cursor-ew-resize' : 'cursor-not-allowed'}`}
                                        style={{
                                            left: `${(Math.max(0, segmentStart - 0.1) / videoDuration) * 100}%`,
                                            top: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            borderRadius: '2px'
                                        }}
                                        onMouseDown={(e) => handleSegmentHandleMouseDown(e, 'start')}
                                        onTouchStart={(e) => handleSegmentHandleTouchStart(e, 'start')}
                                    ></div>

                                    {/* End handle */}
                                    <div
                                        className={`absolute w-3 h-6 bg-main border-1 border-main shadow-md ${isVideoLoaded ? 'cursor-ew-resize' : 'cursor-not-allowed'}`}
                                        style={{
                                            left: `${(segmentStart + SEGMENT_DURATION + 0.1) / videoDuration * 100}%`,
                                            top: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            borderRadius: '2px'
                                        }}
                                        onMouseDown={(e) => handleSegmentHandleMouseDown(e, 'end')}
                                        onTouchStart={(e) => handleSegmentHandleTouchStart(e, 'end')}
                                    ></div>
                                </div>
                            </div>
                        </div>

                        {/* Control Buttons */}
                        <div className="flex items-center w-full justify-center space-x-4">
                            <Button
                                onClick={playSegment}
                                variant="ghost"
                                size="icon"
                                className="text-white hover:text-blue-300 hover:bg-white/10"
                                disabled={!isVideoLoaded}
                            >
                                {isPlaying ? (
                                    <Pause className="w-6 h-6" />
                                ) : (
                                    <Play className="w-6 h-6" />
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <Skeleton className="w-full aspect-video rounded-lg" />
            )}
        </>
    );
}