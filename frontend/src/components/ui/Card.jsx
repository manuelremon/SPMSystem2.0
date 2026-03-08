/**
 * Card Component - MUI Card/Paper
 * Tarjetas profesionales con estilo MUI
 */

import React from "react";
import PropTypes from "prop-types";
import MuiCard from "@mui/material/Card";
import MuiCardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

/**
 * Card - Tarjeta contenedora con MUI Card
 *
 * @param {string} className - Clases adicionales (compatibilidad)
 * @param {React.ReactNode} children - Contenido de la tarjeta
 * @param {boolean} hover - Efecto hover
 * @param {boolean} interactive - Alias de hover (compatibilidad)
 * @param {number} elevation - Elevación de sombra (0-24)
 * @param {string} variant - Variante MUI: 'elevation' | 'outlined'
 * @param {object} sx - Estilos MUI adicionales
 */
export function Card({
  className,
  children,
  hover = false,
  interactive,
  elevation = 1,
  variant = "outlined",
  sx,
  ...props
}) {
  const shouldHover = interactive !== undefined ? interactive : hover;

  return (
    <MuiCard
      className={className}
      elevation={variant === 'outlined' ? 0 : elevation}
      variant={variant}
      sx={{
        transition: shouldHover ? 'all 0.2s ease-in-out' : undefined,
        '&:hover': shouldHover ? {
          boxShadow: 4,
          borderColor: 'primary.main',
        } : undefined,
        ...sx,
      }}
      {...props}
    >
      {children}
    </MuiCard>
  );
}

/**
 * CardHeader - Encabezado de tarjeta
 */
export function CardHeader({
  className,
  children,
  title,
  subheader,
  action,
  avatar,
  sx,
  ...props
}) {
  // Si hay children, renderizar directamente
  if (children && !title) {
    return (
      <Box
        className={className}
        sx={{
          px: { xs: 2, sm: 3 },
          pt: { xs: 2, sm: 2.5 },
          pb: { xs: 1.5, sm: 2 },
          ...sx,
        }}
        {...props}
      >
        {children}
      </Box>
    );
  }

  return (
    <MuiCardHeader
      className={className}
      title={title}
      subheader={subheader}
      action={action}
      avatar={avatar}
      sx={{
        px: { xs: 2, sm: 3 },
        pt: { xs: 2, sm: 2.5 },
        pb: { xs: 1.5, sm: 2 },
        ...sx,
      }}
      {...props}
    >
      {children}
    </MuiCardHeader>
  );
}

/**
 * CardTitle - Título de tarjeta
 */
export function CardTitle({ className, children, sx, ...props }) {
  return (
    <Typography
      variant="subtitle1"
      component="h3"
      className={className}
      sx={{
        fontWeight: 600,
        color: 'text.primary',
        ...sx,
      }}
      {...props}
    >
      {children}
    </Typography>
  );
}

/**
 * CardDescription - Descripción de tarjeta
 */
export function CardDescription({ className, children, sx, ...props }) {
  return (
    <Typography
      variant="body2"
      className={className}
      sx={{
        color: 'text.secondary',
        mt: 0.5,
        ...sx,
      }}
      {...props}
    >
      {children}
    </Typography>
  );
}

/**
 * CardContent - Contenido de tarjeta (re-exportación con estilos)
 */
export { CardContent };

/**
 * CardFooter - Pie de tarjeta
 */
export function CardFooter({ className, children, sx, ...props }) {
  return (
    <CardActions
      className={className}
      sx={{
        px: { xs: 2, sm: 3 },
        py: 2,
        borderTop: 1,
        borderColor: 'divider',
        ...sx,
      }}
      {...props}
    >
      {children}
    </CardActions>
  );
}

// PropTypes
Card.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  hover: PropTypes.bool,
  interactive: PropTypes.bool,
  elevation: PropTypes.number,
  variant: PropTypes.oneOf(["elevation", "outlined"]),
  sx: PropTypes.object,
};

CardHeader.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  title: PropTypes.node,
  subheader: PropTypes.node,
  action: PropTypes.node,
  avatar: PropTypes.node,
  sx: PropTypes.object,
};

CardTitle.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  sx: PropTypes.object,
};

CardDescription.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  sx: PropTypes.object,
};

CardFooter.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  sx: PropTypes.object,
};

export default Card;
