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

// Exportar componente wrapper y presets
export {
  Icon,
  SuccessIcon,
  ErrorIcon,
  WarningIcon,
  InfoIcon,
  LoadingIcon,
} from './Icon';

// Exportar todos los iconos mapeados (compatibles con lucide-react)
export * from './iconMap';
