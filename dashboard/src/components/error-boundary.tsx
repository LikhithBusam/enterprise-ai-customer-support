import { Component, type ErrorInfo, type ReactNode } from "react"

interface ErrorBoundaryProps {
  children: ReactNode
  fallback: (reset: () => void) => ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/** React 18 has no functional-component equivalent — a class component is the only way to
 * implement getDerivedStateFromError/componentDidCatch. Two instances of this wrap the app (see
 * main.tsx and app-shell.tsx): an outer one catches provider/shell-level failures with a minimal,
 * dependency-free fallback, an inner one wraps just the routed page content so a crash in one
 * page leaves the sidebar/topbar navigable and offers a real "try again" recovery instead of only
 * a hard reload. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console -- last-resort visibility; this is the one place in the
    // app an error has nowhere else to go. Swap for a real error-reporting call (Sentry, etc.)
    // when one is wired up — see the Production Readiness Audit's release checklist.
    console.error("Unhandled error caught by ErrorBoundary:", error, info.componentStack)
  }

  reset = (): void => {
    this.setState({ hasError: false })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback(this.reset)
    }
    return this.props.children
  }
}
