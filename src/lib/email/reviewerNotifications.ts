import { sendEmail } from "@/lib/email/ses";
import { getBaseUrl } from "@/lib/utils/environment";

export async function sendVideoUploadNotification({
    reviewerEmail,
    reviewerName,
    patientName,
    exerciseName,
}: {
    reviewerEmail: string;
    reviewerName: string | null;
    patientName: string | null;
    exerciseName: string | null;
}): Promise<void> {
    const greetedReviewer = reviewerName || "there";
    const displayPatientName = patientName || "A patient";
    const displayExercise = exerciseName ? ` (${exerciseName})` : "";
    const reviewUrl = `${getBaseUrl()}/platform/pendingreviews`;

    const subject = `${displayPatientName} uploaded a new video for review`;

    const text = `Hi ${greetedReviewer},

${displayPatientName} just uploaded a new exercise video${displayExercise} and it's waiting for your review.

Review it here: ${reviewUrl}
`;

    const html = `
        <p>Hi ${greetedReviewer},</p>
        <p><strong>${displayPatientName}</strong> just uploaded a new exercise video${displayExercise} and it's waiting for your review.</p>
        <p><a href="${reviewUrl}">Review it here</a></p>
    `;

    await sendEmail({ to: reviewerEmail, subject, html, text });
}
