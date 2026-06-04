// Define the Review type
import useSWR from "swr";
import { fetcher } from "@/lib/swr";

export interface Review {
    id: string;
    patientId?: string;
    patientName: string;
    patientEmail: string;
    videoUrl?: string;
    videoS3Key?: string;
    bucket?: string;
    submittedDate: string;
    reviewDate?: string;
    rating: number | null;
    comments: string;
    status: 'pending' | 'completed';
    reviewerName?: string;
    exerciseType?: number; // Exercise ID from exercises array
}

// Hook for reviews data
export const useReviews = (
    type: 'pending' | 'completed'
): {
    reviews: Review[];
    isLoading: boolean;
    isError: boolean;
    mutate: (data?: unknown, options?: { revalidate?: boolean }) => void;
} => {
    const url =
        type === "pending"
            ? "/api/reviewers/pending-reviews"
            : "/api/reviewers/completed-reviews";
    const { data, error, mutate, isLoading } = useSWR(url, fetcher);

    return {
        reviews: data?.reviews ?? [],
        isLoading: Boolean(isLoading),
        isError: Boolean(error),
        mutate,
    };
};

// Hook for videos data (patient's my videos). Pass false to skip fetch (e.g. when user is reviewer).
export const useVideos = (enabled = true) => {
    const { data, error, mutate, isLoading } = useSWR(enabled ? "/api/videos/my" : null, fetcher);

    return {
        videos: data?.videos ?? [],
        isLoading: Boolean(isLoading),
        isError: Boolean(error),
        mutate,
    };
};

// Hook for patient profile (patients/me). Pass false to skip fetch (e.g. when user is reviewer).
export const usePatientMe = (enabled = true) => {
    const { data, error, mutate, isLoading } = useSWR(enabled ? "/api/patients/me" : null, fetcher);
    return {
        data: data ?? null,
        isLoading: Boolean(isLoading),
        isError: Boolean(error),
        mutate,
    };
};

// Hook for reviewer profile and stats (reviewers/me). Pass false to skip fetch (e.g. when user is patient).
export const useReviewerMe = (enabled = true) => {
    const { data, error, mutate, isLoading } = useSWR(enabled ? "/api/reviewers/me" : null, fetcher);
    return {
        data: data ?? null,
        isLoading: Boolean(isLoading),
        isError: Boolean(error),
        mutate,
    };
};

export interface AdminReviewerPatient {
    id: string;
    cognitoSub: string;
    email: string;
    fullName: string;
    phone: string;
    status: string;
    membershipExpiresAt: string | null;
    membershipDaysRemaining: number | null;
    totalUploads: number;
    pendingReviews: number;
    completedReviews: number;
}

export interface AdminReviewer {
    id: string;
    cognitoSub: string;
    fullname: string;
    email: string;
    phone: string;
    maxPatientCapacity: number;
    totalPatientCapacity: number;
    membershipExpiresAt: string | null;
    patientCount: number;
    pendingReviews: number;
    completedReviews: number;
}

// Hook for admin: list all reviewers (with patient count). Admin only.
export function useAdminReviewers(enabled = true) {
    const { data, error, mutate, isLoading } = useSWR(
        enabled ? "/api/admin/reviewers" : null,
        fetcher
    );
    return {
        reviewers: data?.reviewers ?? [],
        isLoading: Boolean(isLoading),
        isError: Boolean(error),
        mutate,
    };
}

// Hook for admin: patients assigned to a reviewer. Admin only. Pass null to skip fetch.
export function useAdminReviewerPatients(reviewerId: string | null) {
    const { data, error, mutate, isLoading } = useSWR<{ patients: AdminReviewerPatient[] }>(
        reviewerId ? `/api/admin/reviewers/${reviewerId}/patients` : null,
        fetcher
    );
    return {
        patients: data?.patients ?? [],
        isLoading: Boolean(isLoading),
        isError: Boolean(error),
        mutate,
    };
}

// Hook for admin stats (total reviewers, total patients). Admin only.
export const useAdminStats = (enabled = true) => {
    const { data, error, mutate, isLoading } = useSWR(
        enabled ? "/api/admin/stats" : null,
        fetcher
    );
    return {
        totalReviewers: data?.totalReviewers ?? 0,
        totalPatients: data?.totalPatients ?? 0,
        isLoading: Boolean(isLoading),
        isError: Boolean(error),
        mutate,
    };
};

// Hook for today's exercise status (videos/today-status)
export const useTodayStatus = (timezone: string) => {
    const tz = encodeURIComponent(timezone || "UTC");
    const { data, error, mutate, isLoading } = useSWR(
        timezone ? `/api/videos/today-status?timezone=${tz}` : null,
        fetcher
    );
    return {
        data: data ?? null,
        isLoading: Boolean(isLoading),
        isError: Boolean(error),
        mutate,
    };
};

export interface AssignedPatient {
    id: string;
    cognitoSub: string;
    email: string;
    fullName: string;
    phone: string;
    status: string;
    currentStreakDays: number;
    longestStreakDays: number;
    membershipExpiresAt: string | null;
    membershipDaysRemaining: number | null;
}

// Hook for assigned patients (reviewers only)
export const useAssignedPatients = () => {
    const { data, error, mutate, isLoading } = useSWR<{
        patients: AssignedPatient[];
        maxPatientCapacity: number;
        isMembershipActive?: boolean;
    }>(
        "/api/reviewers/patients",
        fetcher
    );
    return {
        patients: data?.patients ?? [],
        maxPatientCapacity: data?.maxPatientCapacity ?? 20,
        // FUTURE: Reviewer membership not enforced. Kept for potential patient 90-day enrollment.
        isMembershipActive: data?.isMembershipActive ?? true,
        isLoading: Boolean(isLoading),
        isError: Boolean(error),
        mutate,
    };
};

// Hook for a specific patient's videos (reviewers only)
export const usePatientVideos = (patientId: string | null) => {
    const { data, error, mutate, isLoading } = useSWR(
        patientId ? `/api/reviewers/patients/${patientId}/videos` : null,
        fetcher
    );
    return {
        videos: data?.videos ?? [],
        patient: data?.patient ?? null,
        isLoading: Boolean(isLoading),
        isError: Boolean(error),
        mutate,
    };
};

// Hook for example videos
export const useExamples = () => {
    const { data, error, mutate, isLoading } = useSWR("/api/examples", fetcher);
    return {
        videos: data?.videos ?? [],
        isLoading: Boolean(isLoading),
        isError: Boolean(error),
        mutate,
    };
};

// Hook for users data (admin only)
export const useUsers = () => {
    // For now, just return mock data without making API calls
    const users = getMockUsers();

    return {
        users,
        isLoading: false,
        isError: false,
        mutate: () => {}, // Mock SWR mutate function signature
    };
};

// getMockReviews removed (pending and completed now DB-backed via /api/reviewers/*)

function getMockUsers() {
    return [
        {
            username: 'user1',
            email: 'user1@example.com',
            role: 'User',
            attributes: {},
            userStatus: 'CONFIRMED',
            enabled: true,
            userCreateDate: '2024-01-01',
            lastModifiedDate: '2024-01-01',
            sub: '123',
            birthdate: '1990-01-01',
            picture: '',
            emailVerified: true,
            name: 'User One',
            family_name: 'One',
        },
        // Add more mock data as needed
    ];
}
