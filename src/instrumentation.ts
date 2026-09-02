import * as Sentry from "@sentry/nextjs";
import { sharedSentryOptions } from "@/lib/sentry";

export function register() {
  Sentry.init(sharedSentryOptions);
}

export const onRequestError = Sentry.captureRequestError;
