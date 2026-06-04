import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  // Empty string disables outbound calls — use undefined when missing so behavior is explicit.
  dsn: dsn && dsn.length > 0 ? dsn : undefined,
  debug: process.env.NEXT_PUBLIC_SENTRY_DEBUG === "true",
  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true,
  integrations: [Sentry.replayIntegration()],
});

if (typeof window !== "undefined" && !dsn) {
  console.warn(
    "[Sentry] No NEXT_PUBLIC_SENTRY_DSN — el navegador no enviará eventos (solo vale SENTRY_DSN en el servidor). Añade NEXT_PUBLIC_SENTRY_DSN en .env.local y reinicia `next dev`."
  );
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
