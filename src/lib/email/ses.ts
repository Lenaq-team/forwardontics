import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const sesClient = new SESClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

export async function sendEmail({
    to,
    subject,
    html,
    text,
}: {
    to: string;
    subject: string;
    html: string;
    text: string;
}): Promise<void> {
    const from = process.env.SES_FROM_EMAIL;
    if (!from) {
        console.warn("sendEmail: SES_FROM_EMAIL is not configured, skipping email send");
        return;
    }

    await sesClient.send(
        new SendEmailCommand({
            Source: from,
            Destination: { ToAddresses: [to] },
            Message: {
                Subject: { Data: subject, Charset: "UTF-8" },
                Body: {
                    Html: { Data: html, Charset: "UTF-8" },
                    Text: { Data: text, Charset: "UTF-8" },
                },
            },
        })
    );
}
