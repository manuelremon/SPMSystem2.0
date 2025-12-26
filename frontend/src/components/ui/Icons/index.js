/**
 * Icons - Punto central de exportacion
 *
 * Este archivo proporciona una API compatible con lucide-react
 * usando SVGs locales del paquete SF Symbols.
 *
 * Uso:
 * import { Check, X, AlertCircle } from "@/components/ui/Icons";
 * <Check className="w-4 h-4 text-emerald-600" />
 *
 * Con wrapper:
 * import { Icon, Check } from "@/components/ui/Icons";
 * <Icon icon={Check} size="md" color="success" />
 */

// Exportar componente wrapper, presets, helpers y constantes
export {
  Icon,
  SuccessIcon,
  ErrorIcon,
  WarningIcon,
  InfoIcon,
  LoadingIcon,
  ICON_COLORS,
  getIconColorClass,
  getIconSemanticColor,
} from './Icon';

// Exportar todos los iconos mapeados (compatibles con lucide-react)
export * from './iconMap';
