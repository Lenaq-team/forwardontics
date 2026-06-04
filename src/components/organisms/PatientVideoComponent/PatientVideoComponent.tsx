"use client";

/// <reference path="../../../types/ffmpeg.d.ts" />

/**
 * PatientVideoComponent - Storage-Optimized Video Recording
 *
 * Optimizations for reducing S3 storage cost:
 * - Desktop: 540p (960x540), 1.2 Mbps video, 64 kbps audio
 * - Mobile: 720p-ish, 1.2 Mbps video, 64 kbps audio (rear camera)
 * - Codec: VP8 + Opus (WebM)
 * - Progressive fallback to lower resolutions on constraint failures
 */

import Image from "next/image";
import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Play, Pause, CircleQuestionMark, Check } from "lucide-react";
import { toast } from "sonner";
import { Home, Loader2, Video } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { useRecording, useTimezone, useUser } from "@/contexts";
import { usePatientMe, useVideos, useExamples } from "@/hooks/useData";
import { exercises } from "@/lib/data/exercises";
// S3 upload uses server-side presigned URL (see /api/videos/presign)
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ProxyVideo } from "@/components/atoms/ProxyVideo";

function getDateKeyInTimezone(isoDate: string, tz: string): string {
    const d = new Date(isoDate);
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz || "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    return formatter.format(d);
}

const PatientVideoComponent = () => {
    const searchParams = useSearchParams();
    const { roles } = useUser();
    const isPatient = !roles.some((r) => r?.toLowerCase() === "reviewer") && !roles.some((r) => r?.toLowerCase() === "admin");
    const { data: patientData } = usePatientMe(isPatient);
    const { setIsRecording } = useRecording();
    const { timezone } = useTimezone();
    const { videos, mutate: mutateVideos } = useVideos();
    const showExpiredMembershipView = isPatient && patientData && !patientData.isMembershipActive;

    // Block exercise only if reviewed video's upload date is the same as today (patient timezone)
    const blockedExerciseIds = useMemo(() => {
        const tz = timezone || "UTC";
        const todayKey = getDateKeyInTimezone(new Date().toISOString(), tz);
        return new Set(
            videos
                .filter((v: { status?: string; exerciseType?: number | null; date?: string }) => {
                    if (v.status === "pending" || v.exerciseType == null) return false;
                    const videoDateKey = getDateKeyInTimezone(v.date ?? "", tz);
                    return videoDateKey === todayKey;
                })
                .map((v: { exerciseType?: number | null }) => v.exerciseType as number)
        );
    }, [videos, timezone]);
    const videoRefRecord = useRef<HTMLVideoElement>(null);
    const videoRefPlayback = useRef<HTMLVideoElement>(null);
    const activeStreamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const recordingStartTimeRef = useRef<number | null>(null);
    const playbackUrlRef = useRef<string | null>(null);

    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
    const [range, setRange] = useState<[number, number] | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [recordingTooShort, setRecordingTooShort] = useState(false);
    const [canSendVideo, setCanSendVideo] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [postUploadComplete, setPostUploadComplete] = useState(false);
    const [isFinalizingRecording, setIsFinalizingRecording] = useState(false);

    // Trimming is temporarily disabled via TRIMMING_ENABLED, but we keep the state/code for review.
    const [isTrimming, setIsTrimming] = useState(false);
    const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
    const [actualResolution, setActualResolution] = useState<string>("");
    const [cameraFacingMode, setCameraFacingMode] = useState<string>("");
    const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');
    const [selectedExercise, setSelectedExercise] = useState<number | undefined>(undefined);
    const [bodyPostureDialogOpen, setBodyPostureDialogOpen] = useState(false);
    const [exampleVideoDialogOpen, setExampleVideoDialogOpen] = useState(false);
    const [selectedExampleVideo, setSelectedExampleVideo] = useState<{ key: string; name: string } | null>(null);
    const { videos: exampleVideos } = useExamples();
    const ffmpegRef = useRef<FFmpeg | null>(null);

    const getExampleVideoForExercise = useCallback(
        (exerciseId: number) => {
            const exercise = exercises.find((e) => e.id === exerciseId);
            if (!exercise) return null;
            const keyLower = (k: string) => k.toLowerCase();
            if (exerciseId === 3) {
                return exampleVideos.find((v: { key: string }) => keyLower(v.key).includes("uplocker")) ?? exampleVideos[0];
            }
            const exerciseNameLower = exercise.name.toLowerCase();
            const searchTerms = [
                exerciseNameLower,
                `exercise ${exerciseId}`,
                `exercise${exerciseId}`,
                ...exerciseNameLower.split(/\s+/).filter((w) => w.length > 2),
            ];
            return (
                exampleVideos.find(
                    (v: { key: string; name: string }) =>
                        searchTerms.some((term) => v.name.toLowerCase().includes(term)) ||
                        keyLower(v.key).includes(`ex${exerciseId}`) ||
                        keyLower(v.key).includes(`exercise${exerciseId}`) ||
                        keyLower(v.key).includes(`exercise_${exerciseId}`)
                ) ?? exampleVideos[0]
            );
        },
        [exampleVideos]
    );

    const getCountingReadingVideos = useCallback(() => {
        const keyLower = (k: string) => k.toLowerCase();
        const counting = exampleVideos.find((v: { key: string }) => keyLower(v.key).includes("counting"));
        const reading = exampleVideos.find((v: { key: string }) => keyLower(v.key).includes("reading"));
        return { counting: counting ?? null, reading: reading ?? null };
    }, [exampleVideos]);

    useEffect(() => {
        const exerciseParam = searchParams.get("exercise");
        if (exerciseParam) {
            const id = parseInt(exerciseParam, 10);
            if (Number.isFinite(id) && exercises.some((e) => e.id === id) && !blockedExerciseIds.has(id)) {
                setSelectedExercise(id);
                setBodyPostureDialogOpen(true);
            }
        }
    }, [searchParams, blockedExerciseIds]);

    // Clear selection if the chosen exercise becomes blocked (e.g. after videos load)
    useEffect(() => {
        if (selectedExercise != null && blockedExerciseIds.has(selectedExercise)) {
            setSelectedExercise(undefined);
        }
    }, [blockedExerciseIds, selectedExercise]);

    // Trimming is temporarily disabled (kept in code for later review).
    // For now we capture a full clip and upload it as-is.
    const TRIMMING_ENABLED = false;

    // Recording length requirements
    // - dev: short clips for fast iteration (5–10s)
    // - prod: real requirement (30–40s)
    const stage = (process.env.NEXT_PUBLIC_STAGE || "dev").toLowerCase();
    const isDevStage = stage === "dev";
    const minDuration = isDevStage ? 30 : 30;
    const maxDuration = isDevStage ? 40 : 40;
    const segmentDuration = Number(process.env.NEXT_PUBLIC_SEGMENT_DURATION) || 3; // seconds, default to 3 seconds

    // Detect mobile device for additional optimizations
    const isMobile = () => {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            window.innerWidth <= 768;
    };

    const videoRef = useRef<HTMLVideoElement>(null);
    const [videoUrl, setVideoUrl] = useState<string>("");
    const [videoDuration, setVideoDuration] = useState<number>(0);
    const [segmentStart, setSegmentStart] = useState<number>(0);
    const [segmentEnd, setSegmentEnd] = useState<number>(segmentDuration);
    const [isVideoLoaded, setIsVideoLoaded] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    const [isDraggingSegment, setIsDraggingSegment] = useState(false);
    const [dragStartX, setDragStartX] = useState(0);
    const [dragStartSegmentStart, setDragStartSegmentStart] = useState(0);
    const [dragType, setDragType] = useState<'start' | 'end' | null>(null);

    // Current video time state for indicator
    const [currentTime, setCurrentTime] = useState<number>(0);

    // Refs for smooth dragging performance
    const lastSeekTimeRef = useRef(0);
    const segmentDurationRef = useRef(segmentDuration);

    // FFmpeg instance for video processing
    // FFmpeg is now created on-demand, no state needed

    const formatTime = (seconds: number): string => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
    };

    const stopCamera = useCallback(() => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
            try {
                recorder.stop();
            } catch {
                /* MediaRecorder already stopped */
            }
        }
        mediaRecorderRef.current = null;

        // Stop all MediaStream tracks
        const stream = activeStreamRef.current;
        if (stream) {
            stream.getTracks().forEach((track) => {
                track.stop();
            });
            activeStreamRef.current = null;
            setCameraActive(false);
        }

        // Clear video element
        if (videoRefRecord.current) {
            videoRefRecord.current.srcObject = null;
            videoRefRecord.current.load(); // Force video element to release resources
        }

        // Reset recording state
        setMediaRecorder(null);
        setRecordingTime(0);
        setPermissionState('granted');
        setIsRecording(false); // Clear recording state in context

        // Double-check that all tracks are stopped
        if (activeStreamRef.current) {
            const remainingTracks = activeStreamRef.current.getTracks();
            if (remainingTracks.length > 0) {

                remainingTracks.forEach(track => {
                    track.stop();
                });
                activeStreamRef.current = null;
            }
        }
    }, []);

    const getCameraStream = async (): Promise<MediaStream> => {
        try {
            // Desktop: 540p to reduce S3 storage cost. Mobile: 720p-ish with rear camera.
            const videoConstraints = isMobile()
                ? { width: { ideal: 1280, min: 854, max: 1920 }, height: { ideal: 720, min: 480, max: 1080 }, frameRate: { ideal: 24, min: 15, max: 30 }, aspectRatio: { ideal: 16 / 9, min: 4 / 3, max: 21 / 9 } }
                : { width: { ideal: 960, min: 640, max: 1280 }, height: { ideal: 540, min: 360, max: 720 }, frameRate: { ideal: 20, min: 15, max: 24 }, aspectRatio: { ideal: 16 / 9, min: 4 / 3, max: 21 / 9 } };
            return await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: isMobile() ? "environment" : "user", // Rear camera on mobile, front on desktop
                    ...videoConstraints
                },
                audio: {
                    sampleRate: { ideal: isMobile() ? 44100 : 16000, min: 16000, max: 44100 },
                    channelCount: { ideal: 1, min: 1, max: 2 }
                }
            });
        } catch (constraintError) {
            // HD constraints failed, trying 540p-ish fallback

            try {
                // Fallback to medium resolution with rear camera preference
                return await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: isMobile() ? "environment" : "user", // Rear camera on mobile, front on desktop
                        width: { ideal: 960, max: 1280 },
                        height: { ideal: 540, max: 720 },
                        frameRate: { ideal: 20, max: 30 }
                    },
                    audio: {
                        sampleRate: { ideal: 16000, max: 44100 },
                        channelCount: { ideal: 1, max: 2 }
                    }
                });
            } catch (fallbackError) {
                // Fallback constraints failed, trying mobile-optimized fallback

                if (isMobile()) {
                    try {
                        // Mobile-specific ultra-low resolution fallback with rear camera
                        return await navigator.mediaDevices.getUserMedia({
                            video: {
                                facingMode: "environment", // Force rear camera on mobile
                                width: { ideal: 480, max: 480 },
                                height: { ideal: 270, max: 270 },
                                frameRate: { ideal: 15, max: 15 }
                            },
                            audio: {
                                sampleRate: { ideal: 8000, max: 8000 },
                                channelCount: { exact: 1 }
                            }
                        });
                    } catch (mobileFallbackError) {
                        // Mobile fallback failed, trying basic constraints with rear camera

                        try {
                            // Final mobile attempt with just rear camera preference
                            return await navigator.mediaDevices.getUserMedia({
                                video: {
                                    facingMode: "environment" // Rear camera on mobile
                                },
                                audio: true
                            });
                        } catch (finalMobileError) {
                            // Final mobile attempt failed, using basic constraints
                        }
                    }
                }

                // Final attempt: basic constraints that should work on any device
                return await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
            }
        }
    };

    const retryPermissions = async () => {
        try {
            setPermissionState('prompt');
            // Request permissions again
            const stream = await getCameraStream();
            activeStreamRef.current = stream;

            if (videoRefRecord.current) {
                videoRefRecord.current.srcObject = stream;
                void videoRefRecord.current.play().catch(() => {
                    // Ignore autoplay/play() rejections
                });
                setCameraActive(true);
                setPermissionState('granted');
            }
        } catch (err) {
            console.error(err);
            // Check if it's a permission error
            if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
                setPermissionState('denied');
                toast.error("Camera access denied. Please enable camera permissions in your browser settings.", {
                    style: {
                        background: 'rgba(220, 38, 38, 0.1)',
                        color: 'red',
                        border: '1px solid rgba(220, 38, 38, 0.4)'
                    }
                });
            } else {
                setPermissionState('denied');
                toast.error("Could not access camera.", {
                    style: {
                        background: 'rgba(220, 38, 38, 0.1)',
                        color: 'red',
                        border: '1px solid rgba(220, 38, 38, 0.4)'
                    }
                });
            }
        }
    };

    const checkPermissions = async () => {
        try {
            // Try to get permissions to see current status
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            // If we get here, permissions are granted
            stream.getTracks().forEach(track => track.stop()); // Stop the test stream
            setPermissionState('granted');
            return true;
        } catch (err) {
            if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
                setPermissionState('denied');
                return false;
            }
            setPermissionState('denied');
            return false;
        }
    };

    const checkPermissionState = async () => {
        // Use Permissions API if available (more accurate than getUserMedia)
        if ('permissions' in navigator) {
            try {
                const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
                return permission.state;
            } catch (err) {
                console.log('Permissions API not supported, falling back to getUserMedia check');
            }
        }

        // Fallback to getUserMedia check
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            stream.getTracks().forEach(track => track.stop());
            return 'granted';
        } catch (err) {
            if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
                return 'denied';
            }
            return 'prompt';
        }
    };

    const revokePlaybackUrl = () => {
        if (playbackUrlRef.current) {
            URL.revokeObjectURL(playbackUrlRef.current);
            playbackUrlRef.current = null;
        }
    };

    const clearRecordingInterval = () => {
        if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
        }
    };

    const resetForNewCapture = useCallback(() => {
        // Stop camera + timers first to free resources
        clearRecordingInterval();
        stopCamera();

        // Clear video memory / playback URLs
        revokePlaybackUrl();
        setVideoUrl("");
        setIsVideoLoaded(false);
        setIsPlaying(false);
        setVideoDuration(0);
        setCurrentTime(0);

        // Reset trimming state
        setSegmentStart(0);
        setSegmentEnd(segmentDurationRef.current);
        setRange(null);

        // Reset recording/upload state
        setVideoBlob(null);
        setRecordingTime(0);
        setRecordingTooShort(false);
        setCanSendVideo(false);
        setIsSending(false);
        setMediaRecorder(null);

        // Return to initial screen
        setSelectedExercise(undefined);
        setPostUploadComplete(false);
        setPermissionState("granted");
        setIsRecording(false);
    }, [stopCamera]);

    useEffect(() => {
        setIsClient(true);
        // Initialize FFmpeg once when component mounts
        const initFFmpeg = async () => {
            try {
                const ffmpeg = new FFmpeg();
                await ffmpeg.load();
                ffmpegRef.current = ffmpeg;
                setFfmpegLoaded(true);
                // FFmpeg loaded successfully
            } catch (error) {
                console.error("Failed to load FFmpeg:", error);
                toast.error("Failed to load video processing tools", {
                    style: {
                        background: 'rgba(220, 38, 38, 0.1)',
                        color: 'red',
                        border: '1px solid rgba(220, 38, 38, 0.4)'
                    }
                });
            }
        };

        initFFmpeg();
    }, []);

    const initializeCamera = useCallback(async () => {
        // Prevent multiple simultaneous camera initializations
        if (cameraActive) {
            return;
        }

        try {
            stopCamera();
            const stream = await getCameraStream();

            activeStreamRef.current = stream;

            if (videoRefRecord.current) {
                videoRefRecord.current.srcObject = stream;
                void videoRefRecord.current.play().catch(() => {
                    // Ignore autoplay/play() rejections
                });
                setCameraActive(true);
                setPermissionState('granted');
            }
        } catch (err) {
            console.error(err);
            // Check if it's a permission error
            if (err instanceof Error && err.message === 'PERMISSION_DENIED') {
                setPermissionState('denied');
                toast.error("Camera access denied. Please enable camera permissions in your browser settings.", {
                    style: {
                        background: 'rgba(220, 38, 38, 0.1)',
                        color: 'red',
                        border: '1px solid rgba(220, 38, 38, 0.4)'
                    }
                });
            } else {
                setPermissionState('denied');
                toast.error("Could not access camera.", {
                    style: {
                        background: 'rgba(220, 38, 38, 0.1)',
                        color: 'red',
                        border: '1px solid rgba(220, 38, 38, 0.4)'
                    }
                });
            }
        }
    }, [cameraActive, stopCamera]);

    const hasMediaDialogOpen = bodyPostureDialogOpen || exampleVideoDialogOpen;

    useEffect(() => {
        if (!isClient) return;

        // Tab/app not active: never start camera, always stop if running
        if (typeof document !== "undefined" && (document.hidden || !document.hasFocus())) {
            if (cameraActive) stopCamera();
            return;
        }

        // Don't run camera when a dialog with images/videos is open - prevents app breakage on mobile.
        if (hasMediaDialogOpen) {
            if (cameraActive) stopCamera();
            return;
        }

        // After a successful upload, keep camera fully stopped until user taps "Capture new video".
        if (postUploadComplete) {
            if (cameraActive) stopCamera();
            return;
        }

        // Don't request camera permission until the user selects an exercise (the preview video
        // element is conditionally rendered and won't exist before that).
        if (!selectedExercise) {
            // If we have no exercise selected and we're not in a recorded/trimming state, stop the camera.
            if (!videoBlob && !mediaRecorder && cameraActive) {
                stopCamera();
            }
            return;
        }

        // Ensure camera is initialized once the preview is visible (only when tab+app active).
        if (!cameraActive) {
            initializeCamera();
            return;
        }

        // If the stream already exists but the video element was mounted later,
        // make sure it's attached to the preview element.
        const stream = activeStreamRef.current;
        if (stream && videoRefRecord.current && videoRefRecord.current.srcObject !== stream) {
            videoRefRecord.current.srcObject = stream;
            void videoRefRecord.current.play().catch(() => {
                // Ignore autoplay/play() rejections; user can still start recording.
            });
        }

        // Watchdog: while camera is active, stop if tab/app becomes inactive (handles events that don't fire)
        const watchdog = setInterval(() => {
            if (document.hidden || !document.hasFocus()) {
                if (activeStreamRef.current) stopCamera();
            }
        }, 200);
        return () => clearInterval(watchdog);
    }, [isClient, postUploadComplete, selectedExercise, cameraActive, initializeCamera, stopCamera, videoBlob, mediaRecorder, hasMediaDialogOpen]);

    // Check permissions on mount
    useEffect(() => {
        if (!isClient) return;

        const checkInitialPermissions = async () => {
            const permissionState = await checkPermissionState();
            setPermissionState(permissionState);
        };

        checkInitialPermissions();

        // Listen for permission changes if Permissions API is available
        if ('permissions' in navigator) {
            const handlePermissionChange = (event: Event) => {
                const target = event.target as PermissionStatus;
                setPermissionState(target.state);
            };

            // Set up permission change listeners
            const setupPermissionListeners = async () => {
                try {
                    const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
                    const microphonePermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });

                    cameraPermission.addEventListener('change', handlePermissionChange);
                    microphonePermission.addEventListener('change', handlePermissionChange);

                    // Cleanup function
                    return () => {
                        cameraPermission.removeEventListener('change', handlePermissionChange);
                        microphonePermission.removeEventListener('change', handlePermissionChange);
                    };
                } catch (err) {
                    console.log('Could not set up permission listeners');
                    return () => { };
                }
            };

            const cleanup = setupPermissionListeners();
            return () => {
                cleanup.then(cleanupFn => cleanupFn());
            };
        }
    }, [isClient]);

    // Stop camera when Trimmer is shown (only for successful recordings)
    useEffect(() => {
        if (videoBlob && !recordingTooShort && cameraActive) {
            stopCamera();
        }
    }, [videoBlob, recordingTooShort, cameraActive]);

    // Keep ref in sync so visibility handlers avoid stale closures
    useEffect(() => {
        mediaRecorderRef.current = mediaRecorder;
    }, [mediaRecorder]);

    // Stop CAMERA when tab or app is not active. Camera only runs when tab AND app are focused.
    useEffect(() => {
        const stopAll = () => {
            stopCamera();
            const recorder = mediaRecorderRef.current;
            if (recorder && recorder.state !== 'inactive') {
                try {
                    recorder.stop();
                    mediaRecorderRef.current = null;
                    setMediaRecorder(null);
                    setIsRecording(false);
                } catch { /* already stopped */ }
            }
        };

        const onHidden = () => { stopAll(); };

        const onVisibilityChange = () => { if (document.hidden) onHidden(); };
        const onResize = () => {
            if (window.outerWidth < 100 || window.outerHeight < 100 || !document.hasFocus()) onHidden();
        };

        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("blur", onHidden);
        document.addEventListener("blur", onHidden);
        window.addEventListener("pagehide", onHidden);
        window.addEventListener("resize", onResize);

        const poll = setInterval(() => {
            if (document.hidden || !document.hasFocus()) onHidden();
        }, 150);

        return () => {
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("blur", onHidden);
            document.removeEventListener("blur", onHidden);
            window.removeEventListener("pagehide", onHidden);
            window.removeEventListener("resize", onResize);
            clearInterval(poll);
        };
    }, [stopCamera]);

    // Restore camera only when tab AND app are active (visible + focused)
    useEffect(() => {
        const maybeRestore = () => {
            if (document.hidden || !document.hasFocus() || cameraActive || videoBlob || !selectedExercise || postUploadComplete || hasMediaDialogOpen) return;
            setTimeout(() => {
                if (document.hidden || !document.hasFocus() || cameraActive || videoBlob || !selectedExercise || postUploadComplete || hasMediaDialogOpen) return;
                initializeCamera();
            }, 150);
        };

        const onVisible = () => maybeRestore();
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("focus", onVisible);

        return () => {
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("focus", onVisible);
        };
    }, [cameraActive, videoBlob, selectedExercise, postUploadComplete, hasMediaDialogOpen, initializeCamera]);


    useEffect(() => {
        return () => {
            stopCamera();
            setIsRecording(false); // Clear recording state in context
            // Clean up FFmpeg instance
            if (ffmpegRef.current) {
                ffmpegRef.current.terminate();
                ffmpegRef.current = null;
            }
            // Revoke playback URL to prevent memory leaks
            revokePlaybackUrl();

            // Component unmount — stopping camera, cleaning up FFmpeg, and revoking URLs
        };
    }, []);

    const handleStartRecording = async () => {
        try {
            // Always ensure camera is active before recording
            if (!cameraActive || !activeStreamRef.current) {
                const stream = await getCameraStream();

                activeStreamRef.current = stream;
                if (videoRefRecord.current) {
                    videoRefRecord.current.srcObject = stream;
                    void videoRefRecord.current.play().catch(() => {
                        // Ignore autoplay/play() rejections
                    });
                }
                setCameraActive(true);
            }

            const stream = activeStreamRef.current;
            if (!stream) throw new Error("No camera stream available");

            // Get the actual constraints that were applied
            const videoTrack = stream.getVideoTracks()[0];
            const settings = videoTrack.getSettings();

            // Set the actual resolution and camera facing mode for display
            const width = settings.width || 0;
            const height = settings.height || 0;
            setActualResolution(`${width}x${height}`);
            setCameraFacingMode(settings.facingMode || 'unknown');

            // Configure MediaRecorder: lower bitrates on desktop to reduce S3 storage cost
            const recorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp8,opus', // VP8 is faster to process than VP9
                videoBitsPerSecond: 1200000,  // 1.2 Mbps for both (desktop reduced from 2.5 Mbps)
                audioBitsPerSecond: 64000     // 64 kbps for both (desktop reduced from 96 kbps)
            });


            const chunks: Blob[] = [];

            recorder.ondataavailable = (e) => chunks.push(e.data);
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: "video/webm" });
                setVideoBlob(blob);
                setMediaRecorder(null);
                setIsRecording(false); // Clear recording state in context
                setIsFinalizingRecording(false);

                const endTime = Date.now();
                const duration = recordingStartTimeRef.current ? (endTime - recordingStartTimeRef.current) / 1000 : 0;
                setRecordingTime(duration);
                setRange([0, duration]);

                // When trimming is disabled, make playback cover the full video.
                if (!TRIMMING_ENABLED) {
                    setSegmentStart(0);
                    setSegmentEnd(duration);
                }

                // Get file size for display
                const fileSizeMB = (blob.size / (1024 * 1024)).toFixed(2);

                // Set the recorded video as source for playback
                if (videoRefPlayback.current) {
                    // Revoke previous URL to prevent memory leaks
                    revokePlaybackUrl();

                    const videoUrl = URL.createObjectURL(blob);
                    playbackUrlRef.current = videoUrl;
                    videoRefPlayback.current.src = videoUrl;
                }

                if (duration < minDuration) {
                    setRecordingTooShort(true);
                    setCanSendVideo(false);
                    toast.error(`Recording too short. Please record at least ${minDuration} seconds.`, {
                        style: {
                            background: 'rgba(220, 38, 38, 0.1)',
                            color: 'red',
                            border: '1px solid rgba(220, 38, 38, 0.4)'
                        }
                    });
                } else {
                    setRecordingTooShort(false);
                    setCanSendVideo(true);
                }
            };

            // Reset all recording states when starting new recording
            recordingStartTimeRef.current = Date.now();
            setRecordingTime(0);
            setRange(null);
            setCanSendVideo(false);
            setVideoBlob(null);
            setRecordingTooShort(false);
            setPermissionState('granted');
            setIsFinalizingRecording(false);


            recorder.start();
            mediaRecorderRef.current = recorder;
            setMediaRecorder(recorder);
            setIsRecording(true); // Set recording state in context

            const interval = setInterval(() => {
                setRecordingTime((prev) => {
                    const next = prev + 1;
                    if (next >= maxDuration) {
                        setIsFinalizingRecording(true);
                        recorder.stop();
                        clearRecordingInterval();
                    }
                    return next;
                });
            }, 1000);

            recordingIntervalRef.current = interval;
        } catch (err) {
            console.error(err);
            toast.error("Could not start recording.", {
                style: {
                    background: 'rgba(220, 38, 38, 0.1)',
                    color: 'red',
                    border: '1px solid rgba(220, 38, 38, 0.4)'
                }
            });
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorder?.state === "recording") {
            setIsFinalizingRecording(true);
            mediaRecorder.stop();
            setIsRecording(false); // Clear recording state in context
        }
        clearRecordingInterval();
    };

    const handleUploadVideo = async () => {
        if (!videoBlob) {
            toast.error("Video missing", {
                style: {
                    background: 'rgba(220, 38, 38, 0.1)',
                    color: 'red',
                    border: '1px solid rgba(220, 38, 38, 0.4)'
                }
            });
            return;
        }

        if (!range || range[1] <= range[0]) {
            toast.error("Invalid video duration", {
                style: {
                    background: 'rgba(220, 38, 38, 0.1)',
                    color: 'red',
                    border: '1px solid rgba(220, 38, 38, 0.4)'
                }
            });
            return;
        }

        if (selectedExercise != null && blockedExerciseIds.has(selectedExercise)) {
            toast.error("You already have a reviewed video for this exercise type. Please select a different exercise.");
            return;
        }

        try {
            setIsSending(true);

            const start = 0;
            const end = range[1];

            const presignRes = await fetch("/api/videos/presign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ contentType: "video/webm" }),
            });

            if (!presignRes.ok) {
                const text = await presignRes.text().catch(() => "");
                throw new Error(`Failed to presign upload: ${presignRes.status} ${text}`);
            }

            const { uploadUrl, bucket, key, stage, id: recordingId, createdAt } = await presignRes.json();

            try {
                const putRes = await fetch(uploadUrl, {
                    method: "PUT",
                    headers: { "Content-Type": "video/webm" },
                    body: videoBlob,
                });
                if (!putRes.ok) {
                    const text = await putRes.text().catch(() => "");
                    throw new Error(`S3 upload failed: ${putRes.status} ${text}`);
                }
            } catch (e) {
                // Most common cause: S3 bucket CORS not allowing this origin for PUT.
                const origin =
                    typeof window !== "undefined" ? window.location.origin : "this origin";
                const msg = e instanceof Error ? e.message : String(e);
                if (msg.toLowerCase().includes("failed to fetch")) {
                    toast.error(
                        `Upload blocked by S3 CORS. Allow PUT from ${origin} on the bucket CORS config.`,
                        {
                            style: {
                                background: "rgba(220, 38, 38, 0.1)",
                                color: "red",
                                border: "1px solid rgba(220, 38, 38, 0.4)",
                            },
                        }
                    );
                }
                throw e;
            }

            // Store metadata in Postgres (server-side) after successful upload.
            let metadataOk = false;
            try {
                const metadataRes = await fetch("/api/videos/metadata", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        id: recordingId,
                        bucket,
                        key,
                        stage,
                        exerciseId: selectedExercise ?? null,
                        createdAt,
                        trimStartSeconds: start,
                        trimEndSeconds: end,
                        contentType: "video/webm",
                        sizeBytes: videoBlob.size,
                    }),
                });

                if (metadataRes.ok) {
                    metadataOk = true;
                } else {
                    const data = await metadataRes.json().catch(() => ({}));
                    const errMsg = data?.error ?? "Failed to save metadata";
                    if (errMsg.toLowerCase().includes("reviewed")) {
                        toast.error(errMsg);
                    } else {
                        toast.warning("Uploaded video, but failed to save metadata.", {
                            style: {
                                background: 'rgba(234, 179, 8, 0.1)',
                                color: '#a16207',
                                border: '1px solid rgba(234, 179, 8, 0.4)'
                            }
                        });
                    }
                }
            } catch (e) {
                console.warn("Failed to store video metadata:", e);
                toast.warning("Uploaded video, but failed to save metadata.", {
                    style: {
                        background: 'rgba(234, 179, 8, 0.1)',
                        color: '#a16207',
                        border: '1px solid rgba(234, 179, 8, 0.4)'
                    }
                });
            }

            if (!metadataOk) {
                setIsSending(false);
                return;
            }

            await mutateVideos();
            toast.success("Video uploaded successfully!", {
                style: {
                    background: 'rgba(0, 160, 154, 0.1)',
                    color: '#00a09a',
                    border: '1px solid rgba(0, 160, 154, 0.4)'
                }
            });

            // After successful upload, hide camera UI and aggressively free resources.
            clearRecordingInterval();
            stopCamera();
            revokePlaybackUrl();

            setCanSendVideo(false);
            setVideoBlob(null);
            setRecordingTime(0);
            setRange(null);
            setRecordingTooShort(false);

            setVideoUrl("");
            setIsVideoLoaded(false);
            setIsPlaying(false);
            setVideoDuration(0);
            setCurrentTime(0);
            setSegmentStart(0);
            setSegmentEnd(segmentDurationRef.current);

            setSelectedExercise(undefined);
            setPostUploadComplete(true);
        } catch (err) {
            console.error("Upload error details:", err);
            let errorMessage = "Upload failed.";
            if (err instanceof Error) {
                errorMessage += ` Error: ${err.message}`;
            }
            toast.error(errorMessage, {
                style: {
                    background: 'rgba(220, 38, 38, 0.1)',
                    color: 'red',
                    border: '1px solid rgba(220, 38, 38, 0.4)'
                }
            });
        } finally {
            setIsSending(false);
        }
    };

    // Trimming temporarily disabled. Kept for later review.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleTrimVideo = async () => {
        if (!TRIMMING_ENABLED) {
            toast.info("Trimming is temporarily disabled. Please upload the full recording.", {
                style: {
                    background: 'rgba(0, 160, 154, 0.1)',
                    color: '#00a09a',
                    border: '1px solid rgba(0, 160, 154, 0.4)'
                }
            });
            return;
        }
        if (!videoBlob) {
            toast.error("Video missing", {
                style: {
                    background: 'rgba(220, 38, 38, 0.1)',
                    color: 'red',
                    border: '1px solid rgba(220, 38, 38, 0.4)'
                }
            });
            return;
        }

        if (!range || range[1] <= range[0]) {
            toast.error("Invalid video duration", {
                style: {
                    background: 'rgba(220, 38, 38, 0.1)',
                    color: 'red',
                    border: '1px solid rgba(220, 38, 38, 0.4)'
                }
            });
            return;
        }

        if (!ffmpegLoaded || !ffmpegRef.current) {
            toast.error("Video processing tools not ready. Please wait...", {
                style: {
                    background: 'rgba(220, 38, 38, 0.1)',
                    color: 'red',
                    border: '1px solid rgba(220, 38, 38, 0.4)'
                }
            });
            return;
        }

        const [start, end] = [segmentStart, segmentEnd];

        if (!isFinite(start) || !isFinite(end)) {
            toast.error("Invalid trim range.", {
                style: {
                    background: 'rgba(220, 38, 38, 0.1)',
                    color: 'red',
                    border: '1px solid rgba(220, 38, 38, 0.4)'
                }
            });
            return;
        }

        // Validate segment boundaries
        if (start < 0 || end <= start || end > videoDuration) {
            toast.error(`Invalid segment: start=${start}, end=${end}, videoDuration=${videoDuration}`, {
                style: {
                    background: 'rgba(220, 38, 38, 0.1)',
                    color: 'red',
                    border: '1px solid rgba(220, 38, 38, 0.4)'
                }
            });
            return;
        }

        if (selectedExercise != null && blockedExerciseIds.has(selectedExercise)) {
            toast.error("You already have a reviewed video for this exercise type. Please select a different exercise.");
            return;
        }

        try {
            setIsTrimming(true);

            const ffmpeg = ffmpegRef.current;

            if (!ffmpeg) {
                throw new Error("FFmpeg instance not available");
            }

            if (!videoBlob || videoBlob.size === 0) {
                throw new Error("Video blob is invalid or empty");
            }


            const arrayBuffer = await videoBlob.arrayBuffer();
            await ffmpeg.writeFile("input.webm", new Uint8Array(arrayBuffer));

            // Use -to instead of -t for more accurate end time
            // This should give us the exact duration we want

            const ffmpegCommand = [
                "-ss", `${start}`,
                "-i", "input.webm",
                "-to", `${end}`,
                "-c", "copy", // Lossless copy - much faster
                "-avoid_negative_ts", "make_zero",
                "output.webm" // Keep same format for lossless copy
            ];



            try {
                await ffmpeg.exec(ffmpegCommand);
            } catch (execError) {
                console.error("FFmpeg exec error:", execError);
                throw new Error(`FFmpeg execution failed: ${execError}`);
            }

            const data = await ffmpeg.readFile("output.webm");

            // Convert FileData to Blob-compatible format
            // FileData can be Uint8Array or string, but for binary video data it's always Uint8Array
            // Create a new Uint8Array to ensure we have a proper ArrayBuffer
            const uint8Array = data instanceof Uint8Array ? new Uint8Array(data) : new TextEncoder().encode(data as string);
            const trimmedBlob = new Blob([uint8Array], { type: "video/webm" });

            // Replace the original video blob with the trimmed version
            setVideoBlob(trimmedBlob);

            toast.success("Video trimmed successfully! Uploading to S3...", {
                style: {
                    background: 'rgba(0, 160, 154, 0.1)',
                    color: '#00a09a',
                    border: '1px solid rgba(0, 160, 154, 0.4)'
                }
            });

            setIsSending(true);

            // Presigned upload: server returns short-lived PUT URL, client uploads directly to S3,
            // then we persist metadata in Postgres.
            const presignRes = await fetch("/api/videos/presign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ contentType: "video/webm" }),
            });

            if (!presignRes.ok) {
                const text = await presignRes.text().catch(() => "");
                throw new Error(`Failed to presign upload: ${presignRes.status} ${text}`);
            }

            const { uploadUrl, bucket, key, stage, id: recordingId, createdAt } = await presignRes.json();

            const putRes = await fetch(uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": "video/webm" },
                body: trimmedBlob,
            });
            if (!putRes.ok) {
                const text = await putRes.text().catch(() => "");
                throw new Error(`S3 upload failed: ${putRes.status} ${text}`);
            }

            // Store metadata in Postgres (server-side) after successful upload.
            let metadataOk = false;
            try {
                const metadataRes = await fetch("/api/videos/metadata", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        id: recordingId,
                        bucket,
                        key,
                        stage,
                        exerciseId: selectedExercise ?? null,
                        createdAt,
                        trimStartSeconds: start,
                        trimEndSeconds: end,
                        contentType: "video/webm",
                        sizeBytes: trimmedBlob.size,
                    }),
                });

                if (metadataRes.ok) {
                    metadataOk = true;
                } else {
                    const data = await metadataRes.json().catch(() => ({}));
                    const errMsg = data?.error ?? "Failed to save metadata";
                    if (errMsg.toLowerCase().includes("reviewed")) {
                        toast.error(errMsg);
                    } else {
                        toast.warning("Uploaded video, but failed to save metadata.", {
                            style: {
                                background: 'rgba(234, 179, 8, 0.1)',
                                color: '#a16207',
                                border: '1px solid rgba(234, 179, 8, 0.4)'
                            }
                        });
                    }
                }
            } catch (e) {
                console.warn("Failed to store video metadata:", e);
                toast.warning("Uploaded video, but failed to save metadata.", {
                    style: {
                        background: 'rgba(234, 179, 8, 0.1)',
                        color: '#a16207',
                        border: '1px solid rgba(234, 179, 8, 0.4)'
                    }
                });
            }

            setIsSending(false);
            if (!metadataOk) return;

            await mutateVideos();
            toast.success("Video uploaded successfully!", {
                style: {
                    background: 'rgba(0, 160, 154, 0.1)',
                    color: '#00a09a',
                    border: '1px solid rgba(0, 160, 154, 0.4)'
                }
            });

            // After successful upload, hide camera UI and aggressively free resources.
            clearRecordingInterval();
            stopCamera();
            revokePlaybackUrl();

            setCanSendVideo(false);
            setVideoBlob(null);
            setRecordingTime(0);
            setRange(null);
            setRecordingTooShort(false);

            setVideoUrl("");
            setIsVideoLoaded(false);
            setIsPlaying(false);
            setVideoDuration(0);
            setCurrentTime(0);
            setSegmentStart(0);
            setSegmentEnd(segmentDurationRef.current);

            setSelectedExercise(undefined);
            setPostUploadComplete(true);

            // Clean up files
            await ffmpeg.deleteFile("input.webm");
            await ffmpeg.deleteFile("output.webm");

        } catch (err) {
            console.error("FFmpeg error details:", err);

            let errorMessage = "Trim/upload failed.";
            if (err instanceof Error) {
                console.error("Error name:", err.name);
                console.error("Error message:", err.message);
                console.error("Error stack:", err.stack);
                errorMessage += ` Error: ${err.message}`;
            }

            toast.error(errorMessage, {
                style: {
                    background: 'rgba(220, 38, 38, 0.1)',
                    color: 'red',
                    border: '1px solid rgba(220, 38, 38, 0.4)'
                }
            });
        } finally {
            setIsTrimming(false);
            setIsSending(false);
        }
    };



    useEffect(() => {
        const video = videoRefPlayback.current;
        if (!video) return;
        const onTimeUpdate = () => {
            const time = video.currentTime;
            if (range && time >= range[1]) video.pause();
        };
        video.addEventListener("timeupdate", onTimeUpdate);
        return () => video.removeEventListener("timeupdate", onTimeUpdate);
    }, [range]);
    useEffect(() => {
        segmentDurationRef.current = segmentDuration;
    }, [segmentDuration]);

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
        if (recordingTime > 0) {
            setVideoDuration(recordingTime);
            setSegmentStart(0);

            // When trimming is disabled, treat the whole clip as the "segment"
            setSegmentEnd(TRIMMING_ENABLED ? Math.min(segmentDuration, recordingTime) : recordingTime);

            setIsVideoLoaded(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recordingTime]);



    // Listen for loadedmetadata to get duration if recordingDuration not provided
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onLoadedMetadata = () => {
            if (recordingTime <= 0 || !isFinite(recordingTime)) {
                const dur = video.duration;
                if (isFinite(dur) && dur > 0) {
                    setVideoDuration(dur);
                    setSegmentStart(0);
                    setSegmentEnd(TRIMMING_ENABLED ? Math.min(segmentDuration, dur) : dur);

                    setIsVideoLoaded(true);
                }
            }
        };

        video.addEventListener("loadedmetadata", onLoadedMetadata);
        return () => video.removeEventListener("loadedmetadata", onLoadedMetadata);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoUrl, recordingTime]);



    // Play segment
    const playSegment = () => {
        if (!videoRef.current) return;

        if (videoRef.current.paused) {
            // If video is at or past the segment end, restart from segment start
            if (videoRef.current.currentTime >= segmentEnd) {
                videoRef.current.currentTime = segmentStart;
            }
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

    // Listen for video pause event to sync play button state
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onPause = () => {
            setIsPlaying(false);
        };

        const onPlay = () => {
            setIsPlaying(true);
        };

        video.addEventListener("pause", onPause);
        video.addEventListener("play", onPlay);

        return () => {
            video.removeEventListener("pause", onPause);
            video.removeEventListener("play", onPlay);
        };
    }, [videoUrl]);

    // Handle segment slider mouse down
    const handleSegmentSliderMouseDown = useCallback((e: React.MouseEvent) => {
        if (!isVideoLoaded) return;

        // Immediately stop video and show play button
        if (videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
            setIsPlaying(false);
        }

        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickPercent = clickX / rect.width;
        const clickTime = clickPercent * videoDuration;

        // Calculate new segment start, allowing selection of the last segment
        const maxStart = Math.max(0, videoDuration - segmentDuration);
        const newStart = Math.max(0, Math.min(clickTime, maxStart));

        // Ensure exact segment duration
        setSegmentStart(newStart);
        setSegmentEnd(newStart + segmentDuration);



        // Update video position to match
        if (videoRef.current) {
            videoRef.current.currentTime = newStart;
        }

        // Start dragging
        setIsDraggingSegment(true);
        setDragStartX(e.clientX);
        setDragStartSegmentStart(newStart);
    }, [isVideoLoaded, videoDuration, segmentDuration]);

    // Handle segment slider touch start
    const handleSegmentSliderTouchStart = useCallback((e: React.TouchEvent) => {
        if (!isVideoLoaded) return;

        // Immediately stop video and show play button
        if (videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
            setIsPlaying(false);
        }

        const touch = e.touches[0];
        const rect = e.currentTarget.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const touchPercent = touchX / rect.width;
        const touchTime = touchPercent * videoDuration;

        // Calculate new segment start, allowing selection of the last segment
        const maxStart = Math.max(0, videoDuration - segmentDuration);
        const newStart = Math.max(0, Math.min(touchTime, maxStart));

        // Ensure exact segment duration
        setSegmentStart(newStart);
        setSegmentEnd(newStart + segmentDuration);



        // Update video position to match
        if (videoRef.current) {
            videoRef.current.currentTime = newStart;
        }

        // Start dragging
        setIsDraggingSegment(true);
        setDragStartX(touch.clientX);
        setDragStartSegmentStart(newStart);
    }, [isVideoLoaded, videoDuration, segmentDuration]);

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

        // Immediately stop video and show play button
        if (videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
            setIsPlaying(false);
        }

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

        // Immediately stop video and show play button
        if (videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
            setIsPlaying(false);
        }

        const touch = e.touches[0];

        // Start dragging
        setIsDraggingSegment(true);
        setDragType(handleType);
        setDragStartX(touch.clientX);
        setDragStartSegmentStart(segmentStart);
    };

    // Global mouse and touch event handlers - defined outside useEffect to prevent recreation
    const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
        if (!isDraggingSegment || !isVideoLoaded) return;

        const deltaX = e.clientX - dragStartX;
        const sliderElement = document.querySelector('[data-segment-slider]');
        if (!sliderElement) return;

        const rect = sliderElement.getBoundingClientRect();
        const deltaPercent = deltaX / rect.width;
        const deltaTime = deltaPercent * videoDuration;
        const currentSegmentDuration = segmentDurationRef.current;

        if (dragType === 'start') {
            // Moving start handle - end handle follows to maintain segment duration gap
            const newStart = Math.max(0, Math.min(dragStartSegmentStart + deltaTime, videoDuration - currentSegmentDuration));

            // Update state immediately for smooth UI
            setSegmentStart(newStart);
            setSegmentEnd(newStart + currentSegmentDuration);

            // Throttled video seeking for smooth performance
            seekVideo(newStart);
        } else if (dragType === 'end') {
            // Moving end handle - start handle follows to maintain segment duration gap
            const newEnd = Math.min(videoDuration, Math.max(dragStartSegmentStart + currentSegmentDuration + deltaTime, currentSegmentDuration));

            // Update state immediately for smooth UI
            setSegmentEnd(newEnd);
            setSegmentStart(newEnd - currentSegmentDuration);

            // Throttled video seeking for smooth performance
            seekVideo(newEnd - currentSegmentDuration);
        } else {
            // Moving entire segment - allow going to the end of the video
            const newStart = Math.max(0, Math.min(dragStartSegmentStart + deltaTime, videoDuration - currentSegmentDuration));

            // Ensure we can select the last segment
            const maxStart = Math.max(0, videoDuration - currentSegmentDuration);
            const finalStart = Math.min(newStart, maxStart);

            // Update state immediately for smooth UI
            setSegmentStart(finalStart);
            setSegmentEnd(finalStart + currentSegmentDuration);

            // Throttled video seeking for smooth performance
            seekVideo(finalStart);
        }
    }, [isDraggingSegment, isVideoLoaded, dragStartX, videoDuration, dragType, dragStartSegmentStart]);

    const handleGlobalTouchMove = useCallback((e: TouchEvent) => {
        if (!isDraggingSegment || !isVideoLoaded) return;

        const touch = e.touches[0];
        const deltaX = touch.clientX - dragStartX;
        const sliderElement = document.querySelector('[data-segment-slider]');
        if (!sliderElement) return;

        const rect = sliderElement.getBoundingClientRect();
        const deltaPercent = deltaX / rect.width;
        const deltaTime = deltaPercent * videoDuration;
        const currentSegmentDuration = segmentDurationRef.current;

        if (dragType === 'start') {
            // Moving start handle - end handle follows to maintain segment duration gap
            const newStart = Math.max(0, Math.min(dragStartSegmentStart + deltaTime, videoDuration - currentSegmentDuration));
            const newEnd = newStart + currentSegmentDuration;

            // Ensure segment duration is exactly maintained
            setSegmentStart(newStart);
            setSegmentEnd(newEnd);

            // Throttled video seeking for smooth performance
            seekVideo(newStart);
        } else if (dragType === 'end') {
            // Moving end handle - start handle follows to maintain segment duration gap
            const newEnd = Math.min(videoDuration, Math.max(dragStartSegmentStart + currentSegmentDuration + deltaTime, currentSegmentDuration));
            const newStart = newEnd - currentSegmentDuration;

            // Ensure segment duration is exactly maintained
            setSegmentStart(newStart);
            setSegmentEnd(newEnd);

            // Throttled video seeking for smooth performance
            seekVideo(newStart);
        } else {
            // Moving entire segment - allow going to the end of the video
            const newStart = Math.max(0, Math.min(dragStartSegmentStart + deltaTime, videoDuration - currentSegmentDuration));

            // Ensure we can select the last segment
            const maxStart = Math.max(0, videoDuration - currentSegmentDuration);
            const finalStart = Math.min(newStart, maxStart);

            // Ensure segment duration is exactly maintained
            setSegmentStart(finalStart);
            setSegmentEnd(finalStart + currentSegmentDuration);

            // Throttled video seeking for smooth performance
            seekVideo(finalStart);
        }
    }, [isDraggingSegment, isVideoLoaded, dragStartX, videoDuration, dragType, dragStartSegmentStart]);

    const handleGlobalMouseUp = useCallback(() => {
        setIsDraggingSegment(false);
        setDragType(null);
        setDragStartX(0);
        setDragStartSegmentStart(0);

        // Validate segment duration after dragging ends
        setTimeout(() => {
            if (isVideoLoaded) {
                const currentDuration = segmentEnd - segmentStart;
                const targetDuration = segmentDuration;

                // If duration is off by more than 0.05 seconds, correct it
                if (Math.abs(currentDuration - targetDuration) > 0.05) {
                    console.log(`Correcting segment duration: ${currentDuration.toFixed(2)}s -> ${targetDuration}s`);
                    setSegmentEnd(segmentStart + targetDuration);
                }
            }
        }, 50);
    }, [isVideoLoaded, segmentStart, segmentEnd, segmentDuration]);

    const handleGlobalTouchEnd = useCallback(() => {
        setIsDraggingSegment(false);
        setDragType(null);
        setDragStartX(0);
        setDragStartSegmentStart(0);

        // Validate segment duration after dragging ends
        setTimeout(() => {
            if (isVideoLoaded) {
                const currentDuration = segmentEnd - segmentStart;
                const targetDuration = segmentDuration;

                // If duration is off by more than 0.05 seconds, correct it
                if (Math.abs(currentDuration - targetDuration) > 0.05) {
                    console.log(`Correcting segment duration: ${currentDuration.toFixed(2)}s -> ${targetDuration}s`);
                    setSegmentEnd(segmentStart + targetDuration);
                }
            }
        }, 50);
    }, [isVideoLoaded, segmentStart, segmentEnd, segmentDuration]);

    // Global mouse and touch event listeners for segment dragging
    useEffect(() => {

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDraggingSegment, dragType, isVideoLoaded, videoDuration, dragStartX, dragStartSegmentStart]);

    // Additional validation to ensure segment duration is always correct
    useEffect(() => {
        if (isVideoLoaded && !isDraggingSegment) {
            const currentDuration = segmentEnd - segmentStart;
            const targetDuration = segmentDuration;

            // If duration is significantly off, force correct it
            if (Math.abs(currentDuration - targetDuration) > 0.05) {
                setSegmentEnd(segmentStart + targetDuration);
            }
        }
    }, [segmentStart, segmentEnd, isVideoLoaded, isDraggingSegment, segmentDuration]);

    // Keep video position synchronized with segment start
    useEffect(() => {
        if (videoRef.current && isVideoLoaded && !isDraggingSegment) {
            // Only update if not currently dragging to avoid conflicts
            videoRef.current.currentTime = segmentStart;
        }
    }, [segmentStart, isVideoLoaded, isDraggingSegment]);





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




    if (!isClient) {
        return (
            <div className="p-6 max-w-xl mx-auto h-full space-y-6">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="aspect-video w-full rounded-lg" />
                <div className="flex gap-4">
                    <Skeleton className="h-10 flex-1 rounded-lg" />
                    <Skeleton className="h-10 flex-1 rounded-lg" />
                </div>
                <Skeleton className="h-32 w-full rounded-lg" />
            </div>
        );
    }

    if (showExpiredMembershipView) {
        return (
            <div className="min-h-screen p-6 flex flex-col items-center justify-center gap-4">
                <p className="text-lg text-muted-foreground text-center">
                    Your 90-day membership has expired. You cannot upload new videos.
                </p>
                <p className="text-sm text-muted-foreground text-center">Contact your clinician to renew.</p>
                <Button variant="outline" asChild>
                    <a href="/platform">Back to platform</a>
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full mx-auto justify-start px-4 pb-8 pt-4">
            <Breadcrumb className="mb-6 hidden md:block">
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/platform"><Home className="w-4 h-4" /></BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Record Video</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            {postUploadComplete ? (
                <div className="flex flex-1 items-center justify-center py-12">
                    <Button
                        onClick={resetForNewCapture}
                        className="w-full max-w-xs px-6 py-6 text-base bg-main text-white hover:bg-main/90"
                    >
                        Capture new video
                    </Button>
                </div>
            ) : (
                <>
                    {/* Exercise Type Select */}
                    {permissionState !== 'denied' && (
                        <div className="flex flex-col items-center justify-center mb-4 w-full max-w-md mx-auto">
                            <label htmlFor="exercise-select" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                Exercise Type
                            </label>
                            <Select
                                value={selectedExercise?.toString()}
                                onValueChange={(value) => {
                                    setSelectedExercise(Number(value));
                                    setBodyPostureDialogOpen(true);
                                }}
                            >
                                <div className="flex w-full flex-row items-center justify-center gap-2 relative">
                                    <SelectTrigger id="exercise-select" className="w-[250px] bg-white">
                                        <SelectValue placeholder="Select an exercise" />
                                    </SelectTrigger>
                                    {selectedExercise && (() => {
                                        const exercise = exercises.find(e => e.id === selectedExercise);
                                        return (
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-accent hover:text-accent/80 hover:bg-transparent"
                                                    >
                                                        <CircleQuestionMark />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent
                                                    className="w-[320px] sm:w-[400px] max-w-[90vw] max-h-[60vh] overflow-y-auto"
                                                    align="end"
                                                >
                                                    <h3 className="font-semibold text-lg mb-2 text-neutral-900 dark:text-neutral-50">
                                                        {exercise?.name || "Exercise Description"}
                                                    </h3>
                                                    <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-line mb-3">
                                                        {exercise?.description || "No description available."}
                                                    </p>
                                                    {selectedExercise === 2 ? (
                                                        (() => {
                                                            const { counting, reading } = getCountingReadingVideos();
                                                            return (counting || reading) ? (
                                                                <div className="flex flex-col gap-2">
                                                                    {counting && (
                                                                        <Button
                                                                            size="sm"
                                                                            className="w-full gap-2 bg-accent text-white hover:bg-accent/90"
                                                                            onClick={() => {
                                                                                setSelectedExampleVideo(counting);
                                                                                setExampleVideoDialogOpen(true);
                                                                            }}
                                                                        >
                                                                            <Video className="h-4 w-4" />
                                                                            Counting.mp4
                                                                        </Button>
                                                                    )}
                                                                    {reading && (
                                                                        <Button
                                                                            size="sm"
                                                                            className="w-full gap-2 bg-accent text-white hover:bg-accent/90"
                                                                            onClick={() => {
                                                                                setSelectedExampleVideo(reading);
                                                                                setExampleVideoDialogOpen(true);
                                                                            }}
                                                                        >
                                                                            <Video className="h-4 w-4" />
                                                                            Reading.mp4
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            ) : null;
                                                        })()
                                                    ) : (
                                                        selectedExercise && getExampleVideoForExercise(selectedExercise) && (
                                                            <Button
                                                                size="sm"
                                                                className="w-full gap-2 bg-accent text-white hover:bg-accent/90"
                                                                onClick={() => {
                                                                    setSelectedExampleVideo(getExampleVideoForExercise(selectedExercise)!);
                                                                    setExampleVideoDialogOpen(true);
                                                                }}
                                                            >
                                                                <Video className="h-4 w-4" />
                                                                See example video
                                                            </Button>
                                                        )
                                                    )}
                                                </PopoverContent>
                                            </Popover>
                                        );
                                    })()}
                                </div>
                                <SelectContent>
                                    {exercises.map((exercise) => {
                                        const isBlocked = blockedExerciseIds.has(exercise.id);
                                        return (
                                            <SelectItem
                                                key={exercise.id}
                                                value={exercise.id.toString()}
                                                disabled={isBlocked}
                                            >
                                                {exercise.name}{isBlocked ? " (Already reviewed)" : ""}
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <Dialog
                        open={exampleVideoDialogOpen}
                        onOpenChange={(open) => {
                            setExampleVideoDialogOpen(open);
                            if (!open) setSelectedExampleVideo(null);
                        }}
                    >
                        <DialogContent className="sm:max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>
                                    Example: {selectedExampleVideo?.name ?? (selectedExercise && exercises.find((e) => e.id === selectedExercise)?.name)}
                                </DialogTitle>
                            </DialogHeader>
                            {selectedExampleVideo ? (
                                <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                                    <ProxyVideo
                                        key={selectedExampleVideo.key}
                                        src={`/api/videos/proxy?key=${encodeURIComponent(
                                            selectedExampleVideo.key
                                        )}&bucket=${encodeURIComponent("gopex-examples")}`}
                                        controls
                                        className="w-full h-full object-contain"
                                        preload="metadata"
                                    />
                                </div>
                            ) : null}
                        </DialogContent>
                    </Dialog>

                    <Dialog open={bodyPostureDialogOpen} onOpenChange={setBodyPostureDialogOpen}>
                        <DialogContent className="sm:max-w-2xl top-[30px] translate-y-0 sm:top-[50%] sm:translate-y-[-50%] max-h-[calc(100vh-30px-120px)] sm:max-h-[calc(100vh-120px)] flex flex-col overflow-hidden">
                            <DialogHeader className="shrink-0">
                                <DialogTitle>Tips before you start recording!</DialogTitle>
                            </DialogHeader>
                            <div className="flex flex-col sm:flex-row gap-4 min-h-0 flex-1 overflow-y-auto">
                                <Image
                                    src="/images/body_posture.png"
                                    alt="Body posture reference"
                                    width={320}
                                    height={320}
                                    className="w-full sm:w-56 shrink-0 h-auto rounded-md object-cover"
                                />
                                <ul className="text-sm text-neutral-700 dark:text-neutral-300 space-y-2 list-none pl-0">
                                    {[
                                        ["Head", "As if pulled by balloon"],
                                        ["Lips", "Lightly closed"],
                                        ["Chin", "Parallel to the ground. Don't lift up or down"],
                                        ["Neck", "Lined up with back"],
                                        ["Shoulders", "Relaxed slightly behind neck (11 o'clock)"],
                                        ["Back", "Straight"],
                                        ["Hips", 'Your "tail" should never be tucked under'],
                                        ["Hands", "Resting on your lap"],
                                        ["Knees", "90 degrees if chair fits you properly"],
                                        ["Feet", "Solid on the ground. Split the same distance as your shoulders"],
                                    ].map(([label, text]) => (
                                        <li key={label} className="flex items-start gap-2">
                                            <Check className="w-4 h-4 shrink-0 mt-0.5 text-main" strokeWidth={2.5} />
                                            <span><strong>{label}:</strong> {text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {selectedExercise ? (
                        permissionState === 'denied' ? (
                            <div className="flex flex-col mt-3">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="w-full max-w-[90vw] sm:max-w-[60vh] mx-auto bg-white rounded-md flex flex-col items-center justify-center p-6 text-center"
                                >
                                    <div className="text-red-500 mb-4">
                                        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                        Camera Access Blocked
                                    </h3>
                                    <p className="text-gray-600 mb-4">
                                        Camera and microphone permissions have been blocked. You&apos;ll need to enable them manually in your browser settings.
                                    </p>
                                    <div className="space-y-3 w-full max-w-sm">
                                        <div className="text-left text-sm text-gray-500 bg-gray-50 p-3 rounded">
                                            <p className="font-medium mb-2">How to enable:</p>
                                            <p>
                                                <strong>Chrome/Edge/Firefox:</strong> Tap the three dots or icon next to the address bar → Site settings → Allow Camera
                                            </p>
                                            <p>
                                                <strong>Safari:</strong> Go to your device Settings → Scroll down to Safari → Settings for This Website → Camera
                                            </p>
                                            <p className="mt-2">
                                                <strong>Note:</strong> On some mobile devices, camera permission must be granted <strong>directly from device settings</strong>.
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-left text-sm font-medium text-gray-700">Video guides:</p>
                                            <div className="rounded border bg-gray-50 p-2">
                                                <p className="text-left text-xs text-gray-600 mb-2"><strong>Chrome / Edge</strong></p>
                                                <video
                                                    src="/videos/chrome.mp4"
                                                    controls
                                                    playsInline
                                                    preload="metadata"
                                                    className="w-full rounded"
                                                />
                                            </div>
                                            <div className="rounded border bg-gray-50 p-2">
                                                <p className="text-left text-xs text-gray-600 mb-2"><strong>Firefox</strong></p>
                                                <video
                                                    src="/videos/firefox.mp4"
                                                    controls
                                                    playsInline
                                                    preload="metadata"
                                                    className="w-full rounded"
                                                />
                                            </div>
                                            <div className="rounded border bg-gray-50 p-2">
                                                <p className="text-left text-xs text-gray-600 mb-2"><strong>Firefox Mobile</strong></p>
                                                <video
                                                    src="/videos/firefox_mobile.mp4"
                                                    controls
                                                    playsInline
                                                    preload="metadata"
                                                    className="w-full rounded"
                                                />
                                            </div>
                                        </div>
                                        <p className="text-left text-sm text-gray-600">
                                            Final step: reload this page and tap <strong>Allow</strong> when the browser asks for camera/microphone permissions.
                                        </p>
                                        <Button
                                            onClick={() => window.location.reload()}
                                            variant="outline"
                                            className="w-full"
                                        >
                                            Reload and Grant Permissions
                                        </Button>
                                    </div>
                                </motion.div>
                            </div>
                        ) : (
                            <div className="flex flex-col mt-3">
                                <div className="flex items-start justify-center relative w-full mb-0">

                                    {hasMediaDialogOpen ? (
                                        <div className="max-h-[30vh] sm:max-h-[60vh] max-w-[90vw] sm:max-w-[60vh] mx-auto aspect-[9/8] sm:aspect-[4/3] rounded-md bg-muted flex items-center justify-center">
                                            <p className="text-sm text-muted-foreground p-4 text-center">Preview paused while dialog is open</p>
                                        </div>
                                    ) : videoBlob && !recordingTooShort ? (
                                        <motion.div
                                            key="trimmer"
                                            initial={{ opacity: 0, scale: 0.98, y: 15, rotateX: -5 }}
                                            animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
                                            transition={{
                                                duration: 0.6,
                                                ease: [0.25, 0.46, 0.45, 0.94],
                                                opacity: { duration: 0.4, delay: 0.1 },
                                                scale: { duration: 0.5, delay: 0.05 },
                                                y: { duration: 0.6, ease: "easeOut" },
                                                rotateX: { duration: 0.5, delay: 0.1 }
                                            }}
                                            className="max-h-[30vh] sm:max-h-[60vh] max-w-[90vw] sm:max-w-[60vh] mx-auto mb-0"
                                        >
                                            <div className="relative w-fit max-w-full mx-auto flex items-center justify-center" style={{ margin: 0, padding: 0 }}>
                                                {videoUrl && (
                                                    <video
                                                        ref={videoRef}
                                                        src={videoUrl}
                                                        onTimeUpdate={onTimeUpdate}
                                                        className="w-full h-full rounded-md object-cover aspect-[9/8] sm:aspect-[4/3] max-h-[30vh] sm:max-h-[60vh] max-w-[90vw] sm:max-w-[60vh]"
                                                        style={{
                                                            objectPosition: 'center center',
                                                            margin: 0,
                                                            padding: 0
                                                        }}
                                                        preload="metadata"
                                                    />
                                                )}

                                                {/* Custom Video Controls */}
                                                <div className="absolute w-full bottom-0 left-1/2 transform -translate-x-1/2 bg-gradient-to-t from-black/70 to-transparent p-2 sm:p-3 rounded-b-md flex flex-col items-center" >


                                                    {/* Control Buttons */}
                                                    <div className="flex flex-col items-center space-y-2">
                                                        <Button
                                                            onClick={playSegment}
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-white hover:text-main/80 hover:bg-white/10 h-8 w-8 sm:h-10 sm:w-10"
                                                            disabled={!isVideoLoaded}
                                                        >
                                                            {isPlaying ? (
                                                                <Pause className="w-4 h-4 sm:w-6 sm:h-6" />
                                                            ) : (
                                                                <Play className="w-4 h-4 sm:w-6 sm:h-6" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.98 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ duration: 0.3 }}
                                            className="max-h-[30vh] sm:max-h-[60vh] max-w-[90vw] sm:max-w-[60vh] mx-auto mb-0"
                                        >
                                            <div className="relative w-fit max-w-full mx-auto flex items-center justify-center" style={{ margin: 0, padding: 0 }}>
                                                <video
                                                    ref={videoRefRecord}
                                                    autoPlay
                                                    muted
                                                    playsInline
                                                    controls={false}
                                                    className="w-full h-full rounded-md object-cover aspect-[9/8] sm:aspect-[4/3] max-h-[30vh] sm:max-h-[60vh] max-w-[90vw] sm:max-w-[60vh]"
                                                    style={{
                                                        objectPosition: 'center center',
                                                        margin: 0,
                                                        padding: 0
                                                    }}
                                                />

                                                {/* Permission Prompt Overlay */}
                                                {permissionState === 'prompt' && (
                                                    <motion.div
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        className="absolute inset-0 bg-black/50 rounded-md flex flex-col items-center justify-center p-4 text-center"
                                                    >
                                                        <div className="bg-white rounded-lg p-6 max-w-sm mx-auto">
                                                            <div className="text-blue-500 mb-4">
                                                                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                                </svg>
                                                            </div>
                                                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                                                Camera Access Required
                                                            </h3>
                                                            <p className="text-gray-600 mb-4">
                                                                This app needs camera and microphone access to record videos. Please allow permissions when prompted.
                                                            </p>
                                                            <Button
                                                                onClick={retryPermissions}
                                                                className="w-full bg-main text-white hover:bg-main/90"
                                                            >
                                                                Allow Camera & Microphone
                                                            </Button>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </div>

                                {/* Segment Slider - Moved below video component */}
                                {/* Trimming UI temporarily disabled (kept for later review) */}
                                {TRIMMING_ENABLED && videoBlob && !recordingTooShort && (
                                    <div className="mt-6  w-full max-w-[90vw] sm:max-w-[60vh] mx-auto px-2 sm:px-4">
                                        {/* <div className="mb-2 text-center">
                            <p className="text-sm text-gray-600 mb-2">Select 3-second segment to trim</p>
                        </div> */}
                                        {/* Unified Segment Slider with Video Progress */}
                                        <div className="w-full">
                                            <div className="flex flex-col items-center">
                                                <div
                                                    className={`relative bg-gray-600 rounded-full h-3 w-full ${!isVideoLoaded ? 'opacity-50 cursor-not-allowed' : isDraggingSegment ? 'cursor-grabbing' : 'cursor-grab'}`}
                                                    onMouseDown={handleSegmentSliderMouseDown}
                                                    onMouseUp={handleSegmentSliderMouseUp}
                                                    onMouseLeave={handleSegmentSliderMouseUp}
                                                    onTouchStart={handleSegmentSliderTouchStart}
                                                    onTouchEnd={handleSegmentSliderTouchEnd}
                                                    data-segment-slider
                                                >
                                                    {/* Video progress indicator (darker blue) - shows progress only within segment boundaries */}
                                                    <div
                                                        className="absolute bg-main h-3"
                                                        style={{
                                                            left: `${(segmentStart / videoDuration) * 100}%`,
                                                            width: `${((Math.min(segmentStart + segmentDuration, currentTime) - segmentStart) / videoDuration) * 100}%`
                                                        }}
                                                    ></div>

                                                    {/* Segment range indicator (brighter blue) */}
                                                    <div
                                                        className="absolute bg-main h-3"
                                                        style={{
                                                            left: `${(Math.max(0, segmentStart - 0.1) / videoDuration) * 100}%`,
                                                            width: `${((segmentDuration + 0.2) / videoDuration) * 100}%`
                                                        }}
                                                    ></div>

                                                    {/* Current video position indicator (thin red line) - constrained to segment boundaries, avoiding handles */}
                                                    {!isDraggingSegment && (
                                                        <div
                                                            className="absolute w-2 h-2 bg-white shadow-sm z-10 rounded-full"
                                                            style={{
                                                                left: `${(() => {
                                                                    const constrainedTime = Math.max(segmentStart + 0.05, Math.min(segmentStart + segmentDuration - 0.05, currentTime));
                                                                    return (constrainedTime / videoDuration) * 100;
                                                                })()}%`,
                                                                top: '50%',
                                                                transform: 'translate(-50%, -50%)'
                                                            }}
                                                        ></div>
                                                    )}

                                                    {/* Start handle */}
                                                    <div
                                                        className={`absolute w-2 h-6 bg-main border-1 border-main shadow-md ${isVideoLoaded ? 'cursor-ew-resize' : 'cursor-not-allowed'}`}
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
                                                        className={`absolute w-2 h-6 bg-main border-1 border-main shadow-md ${isVideoLoaded ? 'cursor-ew-resize' : 'cursor-not-allowed'}`}
                                                        style={{
                                                            left: `${(segmentStart + segmentDuration + 0.1) / videoDuration * 100}%`,
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
                                    </div>
                                )}

                                <AnimatePresence mode="wait">
                                    {(!videoBlob || recordingTooShort) && (
                                        <motion.div
                                            key="timer"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            transition={{ duration: 0.2, ease: "easeOut" }}
                                            className="mt-3 text-center"
                                        >
                                            <p className="text-2xl text-gray-500 font-extralight">
                                                {formatTime(recordingTime)}
                                            </p>
                                            {/* {actualResolution && (
                                <p className="text-sm text-gray-400 mt-1">
                                    Recording at {actualResolution} • {isMobile() ? 'Mobile optimized • Rear camera' : 'Optimized for mobile'}
                                    {cameraFacingMode && cameraFacingMode !== 'unknown' && (
                                        <span> • {cameraFacingMode === 'environment' ? 'Rear' : 'Front'} camera</span>
                                    )}
                                </p>
                            )} */}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="flex flex-col items-center justify-center gap-1 mt-2 text-gray-500">
                                    <AnimatePresence mode="wait">
                                        {!videoBlob || recordingTooShort ? (
                                            <motion.div
                                                key="recording-controls"
                                                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -30, scale: 0.9 }}
                                                transition={{ duration: 0.4, ease: "easeOut" }}
                                                className="flex flex-col items-center justify-center w-full"
                                            >
                                                <motion.p
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.3, delay: 0.1 }}
                                                    className="text-lg font-extralight"
                                                >
                                                    {mediaRecorder ? (
                                                        <span className="flex items-baseline justify-center">
                                                            Recording
                                                            <span className="ml-1 flex">
                                                                <motion.span
                                                                    initial={{ opacity: 0 }}
                                                                    animate={{ opacity: [0, 1, 0] }}
                                                                    transition={{ duration: 0.9, repeat: Infinity, delay: 0 }}
                                                                    className=" w-0.5 h-0.5 bg-current rounded-full mx-1"
                                                                />
                                                                <motion.span
                                                                    initial={{ opacity: 0 }}
                                                                    animate={{ opacity: [0, 1, 0] }}
                                                                    transition={{ duration: 0.9, repeat: Infinity, delay: 0.2 }}
                                                                    className="w-0.5 h-0.5 bg-current rounded-full mx-1"
                                                                />
                                                                <motion.span
                                                                    initial={{ opacity: 0 }}
                                                                    animate={{ opacity: [0, 1, 0] }}
                                                                    transition={{ duration: 0.9, repeat: Infinity, delay: 0.4 }}
                                                                    className=" w-0.5 h-0.5 bg-current rounded-full mx-1"
                                                                />
                                                            </span>
                                                        </span>
                                                    ) : (
                                                        "Start recording"
                                                    )}
                                                </motion.p>
                                                <motion.p
                                                    initial={{ opacity: 0, y: 8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.25, delay: 0.05 }}
                                                    className="text-xs sm:text-sm text-gray-400 mt-2 text-center px-2"
                                                >
                                                    {mediaRecorder
                                                        ? `Keep recording until at least ${minDuration}s (max ${maxDuration}s).`
                                                        : `Record a full video between ${minDuration}s and ${maxDuration}s.`}
                                                </motion.p>
                                                {/* <motion.p
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: 0.15 }}
                                className="text-sm text-gray-400 mt-1"
                            >
                                {isMobile() ? 'Mobile optimized - smaller files • Rear camera' : 'Optimized for mobile devices'}
                            </motion.p> */}
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ duration: 0.3, delay: 0.2, type: "spring", stiffness: 300 }}
                                                    className="mt-2"
                                                >
                                                    {mediaRecorder ? (
                                                        <Button
                                                            variant="destructive"
                                                            className="flex items-center justify-center h-14 w-14 rounded-full"
                                                            onClick={handleStopRecording}
                                                            disabled={isFinalizingRecording}
                                                        >
                                                            <div className="h-4 w-4 rounded-sm bg-white"></div>
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="destructive"
                                                            className="flex items-center justify-center h-14 w-14 rounded-full"
                                                            onClick={handleStartRecording}
                                                        >
                                                            <div className="h-4 w-4 rounded-full bg-white"></div>
                                                        </Button>
                                                    )}
                                                </motion.div>

                                                {isFinalizingRecording && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ duration: 0.2 }}
                                                        className="mt-4 w-full flex justify-center"
                                                    >
                                                        <Button
                                                            variant="outline"
                                                            className="w-full sm:w-48 px-4 sm:px-6 py-3 border-2 border-main bg-main text-white hover:bg-main hover:text-white transition-colors"
                                                            disabled
                                                        >
                                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                            Submit
                                                        </Button>
                                                    </motion.div>
                                                )}
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="trim-controls"
                                                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -30, scale: 0.9 }}
                                                transition={{ duration: 0.4, ease: "easeOut" }}
                                                className="text-center"
                                            >
                                                <motion.p
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.3, delay: 0.1 }}
                                                    className="text-sm md:text-lg font-extralight mb-2 text-wrap px-2"
                                                >
                                                    Video recorded! Upload when ready.
                                                </motion.p>
                                                {videoBlob && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 5 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ duration: 0.3, delay: 0.2 }}
                                                        className="text-sm text-gray-500 mb-4"
                                                    >
                                                        {/* <p>File size: {(videoBlob.size / (1024 * 1024)).toFixed(2)} MB • Resolution: {actualResolution} • Segment: {segmentDuration}s</p> */}
                                                        <p className="mt-1 text-xs sm:text-sm text-gray-400 px-2">
                                                            Duration: {range ? `${range[1].toFixed(1)}s` : ""}
                                                        </p>
                                                    </motion.div>
                                                )}
                                                <motion.div
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.3, delay: 0.2 }}
                                                    className="flex flex-col sm:flex-row gap-3 justify-center px-2"
                                                >
                                                    <motion.div
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        transition={{ duration: 0.1 }}
                                                    >
                                                        <Button
                                                            onClick={handleUploadVideo}
                                                            variant="outline"
                                                            className="w-full sm:w-48 px-4 sm:px-6 py-3 border-2 border-main bg-main text-white hover:bg-main hover:text-white transition-colors"
                                                            disabled={!canSendVideo || isSending}
                                                        >
                                                            {isSending ? (
                                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                            ) : (
                                                                <Video className="h-4 w-4 mr-2" />
                                                            )}
                                                            {isSending ? "Uploading..." : "Upload"}
                                                        </Button>
                                                    </motion.div>

                                                    <motion.div
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        transition={{ duration: 0.1 }}
                                                    >
                                                        <Button
                                                            onClick={() => {
                                                                // Revoke current playback URL to prevent memory leaks
                                                                revokePlaybackUrl();

                                                                setVideoBlob(null);
                                                                setRecordingTooShort(false);
                                                                setRecordingTime(0);
                                                                setMediaRecorder(null);
                                                                setPermissionState('granted');
                                                                if (!cameraActive) {
                                                                    initializeCamera();
                                                                }
                                                            }}
                                                            variant="outline"
                                                            className="w-full sm:w-48 px-4 sm:px-6 py-3 border-2 border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                                                        >
                                                            <Video className="h-4 w-4 mr-2" />
                                                            Record New Video
                                                        </Button>
                                                    </motion.div>
                                                </motion.div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )
                    ) : null}
                </>
            )}
        </div>
    );
};

export default PatientVideoComponent;