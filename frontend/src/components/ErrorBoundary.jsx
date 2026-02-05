import React from "react";
import * as Sentry from "@sentry/react";
import { Box, Paper, Typography, Button, Stack } from "@mui/material";
import {
  Warning as AlertTriangleIcon,
  Refresh as RefreshCwIcon,
  Home as HomeIcon,
} from "@mui/icons-material";

/**
 * ErrorBoundary - Catches JavaScript errors in child components
 * Prevents the entire app from crashing and shows a fallback UI
 * Integrates with Sentry for production error tracking
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
    if (process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    // Send to Sentry in production
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo?.componentStack,
      },
    });
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
              borderRadius: 4,
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
                Algo salió mal
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ha ocurrido un error inesperado. Por favor intenta recargar la página.
              </Typography>
            </Stack>

            {/* Error details (development only) */}
            {process.env.NODE_ENV === "development" && this.state.error && (
              <Paper
                elevation={0}
                sx={{
                  textAlign: "left",
                  p: 2,
                  bgcolor: "action.hover",
                  borderRadius: 2,
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
                Ir al inicio
              </Button>
              <Button
                variant="contained"
                onClick={this.handleReload}
                startIcon={<RefreshCwIcon />}
              >
                Recargar página
              </Button>
            </Stack>

            {/* Retry button */}
            <Button
              variant="text"
              size="small"
              onClick={this.handleRetry}
              sx={{ color: "primary.main" }}
            >
              Intentar de nuevo sin recargar
            </Button>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
