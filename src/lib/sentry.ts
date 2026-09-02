import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

/**
 * Shared Sentry options (brief §12): errors and traces, never content.
 * Request bodies, cookies and headers are stripped before sending, console
 * breadcrumbs are dropped (they could echo page text), and PII defaults
 * are off. Enabled only when a DSN is configured.
 */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export const sharedSentryOptions = {
  dsn: SENTRY_DSN,
  enabled: Boolean(SENTRY_DSN),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  beforeSend(event: ErrorEvent): ErrorEvent {
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.headers;
      delete event.request.query_string;
    }
    if (event.user) event.user = { id: event.user.id };
    return event;
  },
  beforeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
    return breadcrumb.category === "console" ? null : breadcrumb;
  },
};
