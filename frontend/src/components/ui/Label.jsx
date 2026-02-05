/**
 * Label Component - MUI Typography/InputLabel
 * Componente estandarizado para etiquetas de formulario
 */

import React from "react";
import PropTypes from "prop-types";
import InputLabel from "@mui/material/InputLabel";
import Typography from "@mui/material/Typography";

/**
 * Label - Etiqueta para formularios con estilo MUI
 *
 * @param {string} htmlFor - ID del input asociado
 * @param {boolean} required - Muestra asterisco si es requerido
 * @param {string} className - Clases adicionales (compatibilidad)
 * @param {object} sx - Estilos MUI adicionales
 * @param {React.ReactNode} children - Contenido del label
 */
export function Label({ htmlFor, required = false, className, sx, children }) {
  return (
    <InputLabel
      htmlFor={htmlFor}
      required={required}
      sx={{
        fontSize: '0.75rem',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'text.secondary',
        marginBottom: '6px',
        ...sx,
      }}
      className={className}
    >
      {children}
    </InputLabel>
  );
}

Label.propTypes = {
  htmlFor: PropTypes.string,
  required: PropTypes.bool,
  className: PropTypes.string,
  sx: PropTypes.object,
  children: PropTypes.node,
};

export default Label;
