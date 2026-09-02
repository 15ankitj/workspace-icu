import * as Sentry from "@sentry/nextjs";
import { sharedSentryOptions } from "@/lib/sentry";

Sentry.init({
  ...sharedSentryOptions,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
