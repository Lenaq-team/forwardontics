"use client";

// Reviewer: MEMBERSHIP_ALERT_ENABLED = false (doctor limited by patient quota only).
// Patient: 90-day membership enforced – alert shows when expired.
const MEMBERSHIP_ALERT_ENABLED_REVIEWER = false;

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useUser } from "@/contexts";
import { usePatientMe, useReviewerMe } from "@/hooks";

export const MembershipAlert = () => {
  const { roles } = useUser();
  const isReviewer = roles.some((r) => r?.toLowerCase() === "reviewer") || roles.some((r) => r?.toLowerCase() === "admin");
  const isPatient = roles.some((r) => r?.toLowerCase() === "user") && !isReviewer;

  const { data: patientData } = usePatientMe(isPatient);
  const { data: reviewerData } = useReviewerMe(isReviewer);

  if (isPatient && patientData && !patientData.isMembershipActive) {
    return (
      <div
        role="alert"
        className="flex items-center justify-center gap-2 w-full bg-amber-500/90 text-amber-950 py-2 px-4 text-sm font-medium shrink-0"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Your 90-day membership has expired. You cannot upload new videos.</span>
        <span className="text-amber-900">Contact your clinician to renew.</span>
      </div>
    );
  }

  if (MEMBERSHIP_ALERT_ENABLED_REVIEWER && isReviewer && reviewerData && !reviewerData.isMembershipActive) {
    return (
      <div
        role="alert"
        className="flex items-center justify-center gap-2 w-full bg-amber-500/90 text-amber-950 py-2 px-4 text-sm font-medium shrink-0"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Your membership has expired. You cannot submit video reviews until renewed.</span>
        <Link href="/platform/settings" className="underline font-semibold hover:text-amber-900 ml-1">
          Go to Settings to request renovation
        </Link>
      </div>
    );
  }

  return null;
};
