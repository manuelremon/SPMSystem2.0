import React from "react";
import * as Sentry from "@sentry/react";
import { Box, Paper, Typography, Button, Stack } from "@mui/material";
import {
  Warning as AlertTriangleIcon,
  Refresh as RefreshCwIcon,
  Home as HomeIcon,
} from "@mui/icons-material";
import { useI18n } from "../context/i18n";

/**
 * ErrorBoundaryInner - Class component that catches JS errors
 * Receives `t` function via props from the functional wrapper
 */
class ErrorBoundaryInner extends React.Component {
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

    // Auto-reload on chunk load errors (stale deploy cache)
    if (this.isChunkLoadError(error)) {
      const lastReload = sessionStorage.getItem('chunk_error_reload');
      const now = Date.now();
      // Only auto-reload once per 30 seconds to prevent loops
      if (!lastReload || now - Number(lastReload) > 30000) {
        sessionStorage.setItem('chunk_error_reload', String(now));
        window.location.reload();
        return;
      }
    }

    // Send to Sentry in production
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo?.componentStack,
      },
    });
  }

  isChunkLoadError(error) {
    const msg = error?.message || '';
    return (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('ChunkLoadError') ||
      msg.includes('Loading chunk') ||
      msg.includes('Loading CSS chunk')
    );
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    const baseUrl = import.meta.env.BASE_URL || '/';
    window.location.href = `${baseUrl}dashboard`;
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    const { t } = this.props;

    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <Box
          sx={{
            minHeight: "100vh",
            bgcolor: "background.default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 2,
          }}
        >
          <Paper
            elevation={0}
            sx={{
              maxWidth: 400,
              width: "100%",
              border: 1,
              borderColor: "divider",
              borderRadius: 3,
              p: 4,
              textAlign: "center",
            }}
          >
            {/* Icon */}
            <Box
              sx={{
                mx: "auto",
                width: 64,
                height: 64,
                borderRadius: "50%",
                bgcolor: "error.lighter",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mb: 3,
              }}
            >
              <AlertTriangleIcon sx={{ width: 32, height: 32, color: "error.main" }} />
            </Box>

            {/* Title */}
            <Stack spacing={1} sx={{ mb: 3 }}>
              <Typography variant="h5" fontWeight="bold">
                {t('error_boundary_title', 'Algo salió mal')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('error_boundary_description', 'Ha ocurrido un error inesperado. Por favor intenta recargar la página.')}
              </Typography>
            </Stack>

            {/* Error details (development only) */}
            {import.meta.env.DEV && this.state.error && (
              <Paper
                elevation={0}
                sx={{
                  textAlign: "left",
                  p: 2,
                  bgcolor: "action.hover",
                  border: 1,
                  borderColor: "divider",
                  maxHeight: 192,
                  overflow: "auto",
                  mb: 3,
                }}
              >
                <Typography
                  variant="caption"
                  component="p"
                  sx={{
                    fontFamily: "monospace",
                    color: "error.main",
                    wordBreak: "break-all",
                  }}
                >
                  {this.state.error.toString()}
                </Typography>
                {this.state.errorInfo && (
                  <Typography
                    component="pre"
                    variant="caption"
                    sx={{
                      fontFamily: "monospace",
                      color: "text.secondary",
                      mt: 1,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {this.state.errorInfo.componentStack}
                  </Typography>
                )}
              </Paper>
            )}

            {/* Actions */}
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              justifyContent="center"
              sx={{ mb: 2 }}
            >
              <Button
                variant="outlined"
                onClick={this.handleGoHome}
                startIcon={<HomeIcon />}
              >
                {t('error_boundary_go_home', 'Ir al inicio')}
              </Button>
              <Button
                variant="contained"
                onClick={this.handleReload}
                startIcon={<RefreshCwIcon />}
              >
                {t('error_boundary_reload', 'Recargar página')}
              </Button>
            </Stack>

            {/* Retry button */}
            <Button
              variant="text"
              size="small"
              onClick={this.handleRetry}
              sx={{ color: "primary.main" }}
            >
              {t('error_boundary_retry', 'Intentar de nuevo sin recargar')}
            </Button>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

/**
 * ErrorBoundary - Functional wrapper that injects i18n `t` function
 * into the class-based ErrorBoundaryInner
 */
function ErrorBoundary({ children, fallback }) {
  const { t } = useI18n();
  return (
    <ErrorBoundaryInner t={t} fallback={fallback}>
      {children}
    </ErrorBoundaryInner>
  );
}

export default ErrorBoundary;
