import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "./ui/Button";

/**
 * ErrorBoundary - Catches JavaScript errors in child components
 * Prevents the entire app from crashing and shows a fallback UI
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });

    // Log error to console in development
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Here you could also send to an error tracking service
    // e.g., Sentry, LogRocket, etc.
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/dashboard";
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 text-center space-y-6">
            {/* Icon */}
            <div className="mx-auto w-16 h-16 rounded-full bg-[var(--danger-muted)]/20 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-[var(--danger)]" />
            </div>

            {/* Title */}
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-[var(--fg)]">
                Algo salió mal
              </h1>
              <p className="text-sm text-[var(--fg-muted)]">
                Ha ocurrido un error inesperado. Por favor intenta recargar la página.
              </p>
            </div>

            {/* Error details (development only) */}
            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="text-left p-4 bg-[var(--bg-soft)] rounded-lg border border-[var(--border)] overflow-auto max-h-48">
                <p className="text-xs font-mono text-[var(--danger)] break-all">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <pre className="text-xs font-mono text-[var(--fg-muted)] mt-2 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="secondary"
                onClick={this.handleGoHome}
                className="flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                Ir al inicio
              </Button>
              <Button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Recargar página
              </Button>
            </div>

            {/* Retry button */}
            <button
              onClick={this.handleRetry}
              className="text-sm text-[var(--primary)] hover:underline"
            >
              Intentar de nuevo sin recargar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
