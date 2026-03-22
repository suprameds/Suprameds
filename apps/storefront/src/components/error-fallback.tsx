import { Button } from "@/components/ui/button"
import { Link } from "@tanstack/react-router"
import { useState } from "react"

interface ErrorFallbackProps {
  error: Error;
  reset?: () => void;
}

const CONNECTION_PATTERNS = [
  "failed to fetch",
  "network error",
  "networkerror",
  "econnrefused",
  "err_connection",
  "load failed",
  "fetch failed",
  "network request failed",
  "aborted",
  "timeout",
  "502",
  "503",
  "504",
]

function isConnectionError(error: Error): boolean {
  const msg = (error.message || "").toLowerCase()
  const name = (error.name || "").toLowerCase()
  return (
    name === "typeerror" && msg.includes("fetch") ||
    CONNECTION_PATTERNS.some((p) => msg.includes(p))
  )
}

function isAuthError(error: Error): boolean {
  const msg = (error.message || "").toLowerCase()
  return msg.includes("401") || msg.includes("unauthorized")
}

const ErrorFallback = ({ error, reset }: ErrorFallbackProps) => {
  const isDev = import.meta.env.DEV
  const [showDetails, setShowDetails] = useState(false)

  const connectionDown = isConnectionError(error)
  const authIssue = isAuthError(error)

  return (
    <div className="content-container py-16">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white border shadow-sm p-8 rounded-xl" style={{ borderColor: "#EDE9E1" }}>

          {/* Connection error */}
          {connectionDown && (
            <>
              <div
                className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
                style={{ background: "#FEF3C7" }}
              >
                <svg className="w-8 h-8" fill="none" stroke="#D97706" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
                  <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
                  <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
                  <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                  <line x1="12" y1="20" x2="12.01" y2="20" />
                </svg>
              </div>
              <div className="text-center mb-8">
                <h2 className="text-xl font-bold mb-3" style={{ color: "#0D1B2A" }}>
                  Unable to connect
                </h2>
                <p className="text-base" style={{ color: "#666" }}>
                  We're having trouble reaching our servers. This could be a temporary issue — please check your internet connection and try again.
                </p>
              </div>
            </>
          )}

          {/* Auth error */}
          {!connectionDown && authIssue && (
            <>
              <div
                className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
                style={{ background: "#E0F2FE" }}
              >
                <svg className="w-8 h-8" fill="none" stroke="#0369A1" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div className="text-center mb-8">
                <h2 className="text-xl font-bold mb-3" style={{ color: "#0D1B2A" }}>
                  Session expired
                </h2>
                <p className="text-base" style={{ color: "#666" }}>
                  Your session has expired. Please sign in again to continue.
                </p>
              </div>
            </>
          )}

          {/* Generic error */}
          {!connectionDown && !authIssue && (
            <>
              <div
                className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
                style={{ background: "#FEE2E2" }}
              >
                <svg className="w-8 h-8" fill="none" stroke="#DC2626" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="text-center mb-8">
                <h2 className="text-xl font-bold mb-3" style={{ color: "#0D1B2A" }}>
                  Something went wrong
                </h2>
                <p className="text-base" style={{ color: "#666" }}>
                  We encountered an unexpected error. Our team has been notified.
                </p>
              </div>
            </>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            {reset && (
              <Button variant="secondary" onClick={reset} className="sm:w-auto">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Try again
              </Button>
            )}
            {authIssue && !connectionDown ? (
              <Link to="/$countryCode/account/login" params={{ countryCode: "in" }} search={{ redirectTo: undefined } as any}>
                <Button className="w-full sm:w-auto">Sign in</Button>
              </Link>
            ) : (
              <Link to="/">
                <Button className="w-full sm:w-auto">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Go home
                </Button>
              </Link>
            )}
          </div>

          {isDev && (
            <div className="border-t pt-6" style={{ borderColor: "#EDE9E1" }}>
              <Button
                onClick={() => setShowDetails(!showDetails)}
                variant="secondary"
              >
                <svg
                  className={`w-4 h-4 mr-2 transition-transform ${showDetails ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 5l7 7-7 7" />
                </svg>
                {showDetails ? "Hide" : "Show"} error details
              </Button>

              {showDetails && (
                <div className="mt-4 p-4 rounded-lg" style={{ background: "#F8F6F2" }}>
                  <div className="text-left space-y-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "#0D1B2A" }}>
                        Error
                      </p>
                      <code className="text-sm break-all" style={{ color: "#DC2626" }}>
                        {error.message}
                      </code>
                    </div>
                    {error.stack && (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "#0D1B2A" }}>
                          Stack Trace
                        </p>
                        <pre className="text-xs border p-3 overflow-auto max-h-40 rounded" style={{ color: "#666", background: "#fff", borderColor: "#EDE9E1" }}>
                          {error.stack}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ErrorFallback
