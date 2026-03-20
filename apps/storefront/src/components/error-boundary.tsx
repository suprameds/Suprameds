import ErrorFallback from "@/components/error-fallback"
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

  private reset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  public render() {
    if (this.state.hasError && this.state.error) {
      console.error("[ErrorBoundary]", {
        message: this.state.error.message,
        stack: this.state.error.stack,
        name: this.state.error.name,
      })

      if (this.props.fallback) {
        return this.props.fallback
      }

      return <ErrorFallback error={this.state.error} reset={this.reset} />
    }

    return this.props.children
  }
}

export default ErrorBoundary
