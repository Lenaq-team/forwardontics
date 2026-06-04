This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Sentry setup

### Automatic configuration (recommended)

From the project root, you can let the wizard create/update config (opens a browser for login):

```bash
npx @sentry/wizard@latest -i nextjs --saas --org gopex-zi --project javascript-nextjs
```

After it finishes, keep your DSN in `.env.local` / Vercel env vars and verify below.

### Manual steps

1. Create a Sentry project (platform: Next.js), or use org `gopex-zi` / project `javascript-nextjs`.
2. Copy `.env.example` values into your local `.env.local`.
3. Set at least:
   - `NEXT_PUBLIC_SENTRY_DSN`
   - `SENTRY_DSN` (can be the same DSN)
4. In Vercel, add the same environment variables for Production/Preview.
5. Optional (recommended for readable stack traces): set
   - `SENTRY_ORG`
   - `SENTRY_PROJECT`
   - `SENTRY_AUTH_TOKEN`
6. Optional local build token file: `.env.sentry-build-plugin` with:
   - `SENTRY_AUTH_TOKEN=...`

The app now reports:
- Client-side runtime errors
- Server-side runtime errors
- Edge runtime errors
- App Router global render crashes via `src/app/global-error.tsx`

Sentry options enabled in this project:
- Tracing (dev: 100%, prod: 10%)
- Session Replay (10% sessions, 100% on errors)
- Logs (`enableLogs: true`)
- Request error capture via `onRequestError`
- Tunnel route at `/monitoring`

### Verify

With `NEXT_PUBLIC_SENTRY_DSN` set, trigger a client error during development (or use a preview deploy) and confirm events in [Sentry Issues](https://sentry.io/issues/).
