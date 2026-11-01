import type { Instrumentation } from 'next';

// Next has already printed the error and its stack by the time this runs; this adds which request
// it came from.
export const onRequestError: Instrumentation.onRequestError = (
  _err,
  request,
  context
) => {
  console.error(
    `${request.method} ${request.path} failed in ${context.routePath}`
  );
};
