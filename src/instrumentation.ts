/**
 * Cloudflare Workers + unenv ship a minimal `process` where `process.report.getReport`
 * throws "[unenv] process.report.getReport is not implemented yet!". Next/Payload may
 * call it indirectly. Stub it before the rest of the server bundle runs.
 *
 * @see https://developers.cloudflare.com/workers/configuration/compatibility-flags/#enable-process-v2-implementation
 */
export async function register(): Promise<void> {
  const proc = (
    globalThis as {
      process?: { report?: { getReport?: () => unknown } }
    }
  ).process

  if (!proc?.report) return

  proc.report.getReport = () =>
    ({
      header: { reportVersion: 1 },
      javascriptStack: '',
    }) as Record<string, unknown>
}
