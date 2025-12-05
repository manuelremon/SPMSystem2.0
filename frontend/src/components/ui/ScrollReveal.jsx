import { clsx } from 'clsx';
import { useScrollReveal } from '../../hooks/useScrollReveal';

/**
 * Componente wrapper que anima sus children cuando entran en el viewport
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Elementos a animar
 * @param {number} props.delay - Delay en ms antes de la animación (para stagger)
 * @param {string} props.className - Clases CSS adicionales
 * @param {'up'|'down'|'left'|'right'} props.direction - Dirección del slide
 * @param {boolean} props.once - Si solo anima una vez (default: true)
 */
export function ScrollReveal({
  children,
  delay = 0,
  className = '',
  direction = 'up',
  once = true,
  ...props
}) {
  const { ref, isRevealed } = useScrollReveal({ once });

  const directionClasses = {
    up: 'translate-y-8',
    down: '-translate-y-8',
    left: 'translate-x-8',
    right: '-translate-x-8'
  };

  return (
    <div
      ref={ref}
      className={clsx(
        'transition-all duration-600 ease-out',
        isRevealed
          ? 'opacity-100 translate-y-0 translate-x-0'
          : `opacity-0 ${directionClasses[direction]}`,
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
      {...props}
    >
      {children}
    </div>
  );
}

export default ScrollReveal;
