import { Button } from "@/components/ui/button"
import { Link, useLocation } from "@tanstack/react-router"

const NotFound = () => {
  const location = useLocation()

  return (
    <div className="content-container py-12">
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center">
        <div className="max-w-md space-y-6">
          {/* Large 404 */}
          <h1 className="text-8xl font-light text-[var(--text-primary)]">404</h1>

          {/* Main message */}
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              Page not found
            </h1>

            <p className="text-[var(--text-secondary)]">
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>

          {/* Current path */}
          <div className="px-4 py-2 bg-[var(--bg-tertiary)] font-mono text-sm text-[var(--text-secondary)]">
            {location.pathname}
          </div>

          {/* Action button */}
          <Link to="/">
            <Button className="px-6 py-3" variant="primary">
              Go home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default NotFound
