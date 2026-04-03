/**
 * Job execution guard — prevents indefinite retries on persistent failures.
 *
 * Tracks consecutive failures per job. After MAX_CONSECUTIVE_FAILURES,
 * the job skips execution until a cooldown period passes.
 *
 * Usage:
 *   const guard = jobGuard("my-job")
 *   if (guard.shouldSkip()) return
 *   try { ... guard.success() } catch { guard.failure(err) }
 */

const MAX_CONSECUTIVE_FAILURES = 3
const COOLDOWN_MS = 30 * 60 * 1000 // 30 minutes

const jobState = new Map<string, {
  failures: number
  lastFailure: number
  lastError: string
}>()

export function jobGuard(jobName: string) {
  const state = jobState.get(jobName) ?? { failures: 0, lastFailure: 0, lastError: "" }

  return {
    shouldSkip(): boolean {
      if (state.failures >= MAX_CONSECUTIVE_FAILURES) {
        const elapsed = Date.now() - state.lastFailure
        if (elapsed < COOLDOWN_MS) {
          return true // Still in cooldown
        }
        // Cooldown passed — reset and allow retry
        state.failures = 0
        jobState.set(jobName, state)
      }
      return false
    },

    success() {
      state.failures = 0
      state.lastError = ""
      jobState.set(jobName, state)
    },

    failure(err: unknown) {
      state.failures++
      state.lastFailure = Date.now()
      state.lastError = err instanceof Error ? err.message : String(err)
      jobState.set(jobName, state)

      if (state.failures >= MAX_CONSECUTIVE_FAILURES) {
        console.warn(
          `[job-guard] ${jobName}: ${state.failures} consecutive failures — pausing for ${COOLDOWN_MS / 60000}min. Last error: ${state.lastError}`
        )
      }
    },

    get consecutiveFailures() { return state.failures },
  }
}
