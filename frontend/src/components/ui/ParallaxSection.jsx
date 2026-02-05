import { useParallax, parallaxPresets } from '../../hooks/useParallax';

/**
 * Componente wrapper para aplicar efectos de parallax
 * Respeta prefers-reduced-motion y desactiva en mobile
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Contenido a renderizar
 * @param {number} props.offset - Velocidad del parallax (0-1, default: 0.5)
 * @param {'x' | 'y'} props.direction - Direccion del movimiento (default: 'y')
 * @param {boolean} props.disabled - Desactivar el efecto (default: false)
 * @param {string} props.className - Clases CSS adicionales
 * @param {React.ElementType} props.as - Elemento HTML a renderizar (default: 'div')
 */
export function ParallaxSection({
  children,
  offset = 0.5,
  direction = 'y',
  disabled = false,
  className = '',
  as: Component = 'div',
  ...props
}) {
  const { ref, style, isDisabled } = useParallax({ offset, direction, disabled });

  return (
    <Component
      ref={ref}
      className={`parallax-element ${className}`}
      style={isDisabled ? {} : style}
      {...props}
    >
      {children}
    </Component>
  );
}

// Presets para uso rapido - componentes con configuracion predefinida

/**
 * Parallax muy sutil - ideal para sidebar, navegacion
 * offset: 0.2
 */
ParallaxSection.Subtle = function SubtleParallax(props) {
  return <ParallaxSection offset={parallaxPresets.subtle.offset} {...props} />;
};

/**
 * Parallax ligero - ideal para headers, titulos
 * offset: 0.35
 */
ParallaxSection.Light = function LightParallax(props) {
  return <ParallaxSection offset={parallaxPresets.light.offset} {...props} />;
};

/**
 * Parallax moderado - ideal para cards, secciones
 * offset: 0.5
 */
ParallaxSection.Moderate = function ModerateParallax(props) {
  return <ParallaxSection offset={parallaxPresets.moderate.offset} {...props} />;
};

/**
 * Parallax fuerte - ideal para hero sections, Login
 * offset: 0.7
 */
ParallaxSection.Strong = function StrongParallax(props) {
  return <ParallaxSection offset={parallaxPresets.strong.offset} {...props} />;
};

export default ParallaxSection;
