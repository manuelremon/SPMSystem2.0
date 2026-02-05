/**
 * Icons - Punto central de exportacion
 *
 * Este archivo proporciona una API compatible usando Material UI Icons.
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
  WarningIconPreset as WarningIcon,
  InfoIcon,
  LoadingIcon,
  ICON_COLORS,
  getIconColorClass,
  getIconSemanticColor,
} from './Icon';

// Exportar todos los iconos mapeados
export * from './iconMap';
