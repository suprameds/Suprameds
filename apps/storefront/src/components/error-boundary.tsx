import ErrorFallback from "@/components/error-fallback"
import * as Sentry from "@sentry/react"
import { Component, ReactNode } from "react"

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } })
  }

  private reset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  public render() {
    if (this.state.hasError && this.state.error) {
      if (import.meta.env.DEV) {
        console.error("[ErrorBoundary]", {
          message: this.state.error.message,
          stack: this.state.error.stack,
          name: this.state.error.name,
        })
      }

      if (this.props.fallback) {
        return this.props.fallback
      }

      return <ErrorFallback error={this.state.error} reset={this.reset} />
    }

    return this.props.children
  }
}

export default ErrorBoundary
