/**
 * What Sentry may send with a crash report. Members log in with phone numbers and PINs and pay
 * through QRIS, so nothing about the person or the request leaves: no user fields, cookies,
 * headers, bodies, query strings, query results or local variables. The stack trace is enough.
 */
export const sentryDataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  stackFrameVariables: false,
};
