/**
 * Icon Map - Mapeo de nombres lucide-react a SVGs locales
 *
 * Este archivo exporta iconos con nombres compatibles con lucide-react,
 * permitiendo una migracion transparente.
 *
 * Uso: import { Check, X, AlertCircle } from "@/components/ui/Icons";
 *
 * Estilo MIXTO aplicado:
 * - Estados activos/exitosos: Filled
 * - Estados error/criticos: Filled
 * - Acciones/botones: Outline
 * - Navegacion: Outline
 */

// ============================================================================
// ACCIONES PRINCIPALES
// ============================================================================
export { default as Check } from './svg/checkmark.svg?react';
export { default as X } from './svg/xmark.svg?react';
export { default as Plus } from './svg/plus.svg?react';
export { default as Minus } from './svg/minus.svg?react';
export { default as Search } from './svg/search.svg?react';
export { default as Edit2 } from './svg/pencil.svg?react';
export { default as Edit3 } from './svg/pencil.svg?react';
export { default as Trash2 } from './svg/trash.svg?react';
export { default as Save } from './svg/square_arrow_down.svg?react';
export { default as Download } from './svg/arrow_down_doc.svg?react';
export { default as Upload } from './svg/arrow_up_doc.svg?react';
export { default as Send } from './svg/paperplane.svg?react';
export { default as RefreshCw } from './svg/arrow_clockwise.svg?react';
export { default as RefreshCcw } from './svg/arrow_counterclockwise.svg?react';
export { default as ExternalLink } from './svg/arrow_up_right_square.svg?react';
export { default as Link } from './svg/link.svg?react';
export { default as Copy } from './svg/doc_on_doc.svg?react';
export { default as Paperclip } from './svg/paperclip.svg?react';

// ============================================================================
// ESTADOS Y ALERTAS (FILLED para estados activos segun decision)
// ============================================================================
export { default as CheckCircle } from './svg/checkmark_circle.svg?react';
export { default as CheckCircle2 } from './svg/checkmark_circle_fill.svg?react';  // Filled para activo
export { default as CheckCheck } from './svg/checkmark_2.svg?react';
export { default as XCircle } from './svg/xmark_circle_fill.svg?react';  // Filled para error
export { default as AlertCircle } from './svg/exclamationmark_circle.svg?react';
export { default as AlertTriangle } from './svg/exclamationmark_triangle_fill.svg?react';  // Filled para warning
export { default as AlertOctagon } from './svg/exclamationmark_octagon_fill.svg?react';  // Filled para critico
export { default as Info } from './svg/info_circle.svg?react';  // Outline para info
export { default as Circle } from './svg/circle.svg?react';
export { default as HelpCircle } from './svg/question_circle.svg?react';

// ============================================================================
// NAVEGACION
// ============================================================================
export { default as Home } from './svg/house.svg?react';
export { default as ChevronLeft } from './svg/chevron_left.svg?react';
export { default as ChevronRight } from './svg/chevron_right.svg?react';
export { default as ChevronUp } from './svg/chevron_up.svg?react';
export { default as ChevronDown } from './svg/chevron_down.svg?react';
export { default as ChevronsUpDown } from './svg/chevron_up_chevron_down.svg?react';
export { default as ArrowLeft } from './svg/arrow_left.svg?react';
export { default as ArrowRight } from './svg/arrow_right.svg?react';
export { default as ArrowUp } from './svg/arrow_up.svg?react';
export { default as ArrowDown } from './svg/arrow_down.svg?react';
export { default as ArrowUpCircle } from './svg/arrow_up_circle.svg?react';
export { default as ArrowDownCircle } from './svg/arrow_down_circle.svg?react';
export { default as ArrowLeftRight } from './svg/arrow_left_right.svg?react';
export { default as ArrowRightRight } from './svg/arrow_right.svg?react';  // Alternativa

// ============================================================================
// TIEMPO
// ============================================================================
export { default as Clock } from './svg/clock.svg?react';
export { default as Calendar } from './svg/calendar.svg?react';
export { default as Timer } from './svg/timer.svg?react';
export { default as History } from './svg/clock.svg?react';

// ============================================================================
// CARGA Y MEDIA
// ============================================================================
export { default as Loader2 } from './svg/arrow_2_circlepath.svg?react';
export { default as Play } from './svg/play.svg?react';
export { default as Pause } from './svg/pause.svg?react';
export { default as Archive } from './svg/archivebox.svg?react';

// ============================================================================
// DOCUMENTOS
// ============================================================================
export { default as FileText } from './svg/doc_text.svg?react';
export { default as File } from './svg/doc.svg?react';
export { default as FileX } from './svg/doc.svg?react';  // Alternativa (sin X disponible)
export { default as FileType } from './svg/doc_plaintext.svg?react';
export { default as FileSpreadsheet } from './svg/doc_chart.svg?react';
export { default as FileCode } from './svg/doc_text.svg?react';
export { default as FilePlus2 } from './svg/doc_append.svg?react';
export { default as ClipboardList } from './svg/doc_on_clipboard.svg?react';
export { default as BookOpen } from './svg/book.svg?react';
export { default as Book } from './svg/book.svg?react';
export { default as Folder } from './svg/folder.svg?react';

// ============================================================================
// COMUNICACION
// ============================================================================
export { default as MessageSquare } from './svg/bubble_left.svg?react';
export { default as MessageCircle } from './svg/bubble_left.svg?react';
export { default as Mail } from './svg/envelope.svg?react';
export { default as Phone } from './svg/phone.svg?react';
export { default as Reply } from './svg/arrow_turn_up_left.svg?react';
export { default as Contact } from './svg/person_crop_rectangle.svg?react';

// ============================================================================
// NOTIFICACIONES
// ============================================================================
export { default as Bell } from './svg/bell.svg?react';
export { default as BellOff } from './svg/bell_slash.svg?react';
export { default as BellRing } from './svg/bell_fill.svg?react';  // Filled para activo

// ============================================================================
// USUARIOS
// ============================================================================
export { default as User } from './svg/person.svg?react';
export { default as Users } from './svg/person_2.svg?react';
export { default as UserCheck } from './svg/person_crop_circle_badge_checkmark.svg?react';
export { default as UserPlus } from './svg/person_badge_plus.svg?react';
export { default as UserMinus } from './svg/person_badge_minus.svg?react';

// ============================================================================
// SEGURIDAD
// ============================================================================
export { default as Shield } from './svg/shield.svg?react';
export { default as Lock } from './svg/lock.svg?react';
export { default as Unlock } from './svg/lock_open.svg?react';
export { default as Eye } from './svg/eye.svg?react';
export { default as EyeOff } from './svg/eye_slash.svg?react';

// ============================================================================
// COMERCIO Y LOGISTICA
// ============================================================================
export { default as Package } from './svg/shippingbox.svg?react';
export { default as Boxes } from './svg/cube_box.svg?react';
export { default as ShoppingCart } from './svg/cart.svg?react';
export { default as Truck } from './svg/shippingbox.svg?react';  // Alternativa
export { default as Warehouse } from './svg/building.svg?react';  // Alternativa
export { default as DollarSign } from './svg/money_dollar_circle.svg?react';
export { default as Wallet } from './svg/wallet.svg?react';
export { default as Briefcase } from './svg/briefcase.svg?react';

// ============================================================================
// UBICACION Y EDIFICIOS
// ============================================================================
export { default as Building } from './svg/building.svg?react';
export { default as Building2 } from './svg/building_2.svg?react';
export { default as MapPin } from './svg/map_pin.svg?react';
export { default as Target } from './svg/scope.svg?react';

// ============================================================================
// GRAFICOS Y METRICAS
// ============================================================================
export { default as TrendingUp } from './svg/arrow_up_right.svg?react';
export { default as TrendingDown } from './svg/arrow_down_right.svg?react';
export { default as BarChart2 } from './svg/chart_bar_fill.svg?react';
export { default as BarChart3 } from './svg/chart_bar.svg?react';
export { default as LineChart } from './svg/chart_bar.svg?react';  // Alternativa para LineChart
export { default as PieChart } from './svg/chart_pie.svg?react';
export { default as Activity } from './svg/chart_bar.svg?react';  // Alternativa
export { default as Gauge } from './svg/gauge.svg?react';

// ============================================================================
// SISTEMA Y TECNOLOGIA
// ============================================================================
export { default as Settings } from './svg/gear.svg?react';
export { default as Workflow } from './svg/flowchart.svg?react';
export { default as Layers } from './svg/layers.svg?react';
export { default as Database } from './svg/rectangle_stack.svg?react';  // Alternativa
export { default as Server } from './svg/desktopcomputer.svg?react';  // Alternativa
export { default as HardDrive } from './svg/desktopcomputer.svg?react';  // Alternativa
export { default as Cpu } from './svg/desktopcomputer.svg?react';  // Alternativa
export { default as Wifi } from './svg/wifi.svg?react';
export { default as WifiOff } from './svg/wifi_slash.svg?react';
export { default as Power } from './svg/power.svg?react';
export { default as LogOut } from './svg/power.svg?react';

// ============================================================================
// ORGANIZACION
// ============================================================================
export { default as GitCompare } from './svg/arrow_right_arrow_left.svg?react';
export { default as Filter } from './svg/slider_horizontal_3.svg?react';
export { default as Inbox } from './svg/tray.svg?react';
export { default as List } from './svg/list_bullet.svg?react';
export { default as LayoutGrid } from './svg/square_grid_2x2.svg?react';
export { default as Hash } from './svg/number.svg?react';

// ============================================================================
// MATEMATICAS
// ============================================================================
export { default as PlusCircle } from './svg/plus_circle.svg?react';
export { default as MinusCircle } from './svg/minus_circle.svg?react';

// ============================================================================
// ESPECIALES E IA
// ============================================================================
export { default as Sparkles } from './svg/sparkles.svg?react';
export { default as Lightbulb } from './svg/lightbulb.svg?react';
export { default as Brain } from './svg/sparkles.svg?react';  // Alternativa para IA
export { default as Zap } from './svg/bolt.svg?react';

// ============================================================================
// TEMA
// ============================================================================
export { default as Sun } from './svg/sun_max.svg?react';
export { default as Moon } from './svg/moon.svg?react';
export { default as Monitor } from './svg/desktopcomputer.svg?react';

// ============================================================================
// FAVORITOS Y GAMIFICACION
// ============================================================================
export { default as Star } from './svg/star.svg?react';
export { default as StarFill } from './svg/star_fill.svg?react';
export { default as Heart } from './svg/heart.svg?react';
export { default as ThumbsUp } from './svg/hand_thumbsup.svg?react';
export { default as ThumbsDown } from './svg/hand_thumbsdown.svg?react';
export { default as Trophy } from './svg/star_fill.svg?react';  // Alternativa
export { default as Medal } from './svg/rosette.svg?react';  // Alternativa
export { default as Crown } from './svg/star.svg?react';  // Alternativa
export { default as Bookmark } from './svg/bookmark.svg?react';

// ============================================================================
// MULTIMEDIA
// ============================================================================
export { default as Image } from './svg/photo.svg?react';
export { default as Film } from './svg/film.svg?react';
export { default as Music } from './svg/music_note.svg?react';

// ============================================================================
// MAPEO DE COLORES POR DEFECTO PARA CADA ICONO
// ============================================================================
export const ICON_DEFAULT_COLORS = {
  // ACCIONES DESTRUCTIVAS (danger - rojo)
  Trash2: 'danger',
  X: 'danger',
  XCircle: 'danger',
  FileX: 'danger',
  UserMinus: 'danger',

  // ACCIONES EXITOSAS (success - verde)
  Check: 'success',
  CheckCircle: 'success',
  CheckCircle2: 'success',
  CheckCheck: 'success',
  UserCheck: 'success',

  // ALERTAS Y NOTIFICACIONES (notification - ámbar)
  AlertCircle: 'warning',
  AlertTriangle: 'warning',
  AlertOctagon: 'warning',
  Bell: 'notification',
  BellRing: 'notification',
  BellOff: 'muted',

  // INFORMACIÓN (info - azul)
  Info: 'info',
  HelpCircle: 'info',
  Eye: 'info',
  Search: 'info',
  FileText: 'info',

  // EDICIÓN (primary - azul oscuro)
  Edit2: 'primary',
  Edit3: 'primary',
  Save: 'primary',
  Plus: 'primary',
  PlusCircle: 'primary',
  FilePlus2: 'primary',
  UserPlus: 'primary',

  // NAVEGACIÓN (subtle - slate)
  Home: 'subtle',
  ChevronLeft: 'subtle',
  ChevronRight: 'subtle',
  ChevronUp: 'subtle',
  ChevronDown: 'subtle',
  ChevronsUpDown: 'subtle',
  ArrowLeft: 'subtle',
  ArrowRight: 'subtle',
  ArrowUp: 'subtle',
  ArrowDown: 'subtle',
  ExternalLink: 'subtle',

  // DINERO/FINANZAS (money - marrón/ámbar oscuro)
  Wallet: 'money',
  DollarSign: 'money',
  Briefcase: 'money',

  // LOGÍSTICA (logistics - índigo)
  Package: 'logistics',
  Boxes: 'logistics',
  Truck: 'logistics',
  Warehouse: 'logistics',
  ShoppingCart: 'logistics',

  // COMUNICACIÓN (communication - violeta)
  MessageSquare: 'communication',
  MessageCircle: 'communication',
  Mail: 'communication',
  Phone: 'communication',
  Reply: 'communication',

  // TIEMPO (time - cyan)
  Clock: 'time',
  Calendar: 'time',
  Timer: 'time',
  History: 'time',

  // USUARIOS (users - teal)
  User: 'users',
  Users: 'users',
  Contact: 'users',

  // CONFIGURACIÓN (secondary - slate oscuro)
  Settings: 'secondary',
  Workflow: 'secondary',
  Filter: 'secondary',
  Layers: 'secondary',

  // GRÁFICOS (charts - rosa)
  TrendingUp: 'success',
  TrendingDown: 'danger',
  BarChart2: 'charts',
  BarChart3: 'charts',
  LineChart: 'charts',
  PieChart: 'charts',
  Activity: 'charts',
  Gauge: 'charts',

  // SEGURIDAD (secondary - slate)
  Shield: 'secondary',
  Lock: 'secondary',
  Unlock: 'secondary',

  // FAVORITOS/GAMIFICACIÓN (favorites - amarillo)
  Star: 'favorites',
  StarFill: 'favorites',
  Heart: 'danger',
  Trophy: 'favorites',
  Medal: 'favorites',
  Crown: 'favorites',
  ThumbsUp: 'success',
  ThumbsDown: 'danger',

  // IA/ESPECIALES (ai - púrpura)
  Sparkles: 'ai',
  Lightbulb: 'favorites',
  Brain: 'ai',
  Zap: 'ai',

  // CARGA (muted)
  Loader2: 'muted',

  // DOCUMENTOS (info)
  File: 'info',
  FileType: 'info',
  FileSpreadsheet: 'success',
  FileCode: 'info',
  ClipboardList: 'info',
  BookOpen: 'info',
  Book: 'info',
  Folder: 'info',

  // SISTEMA (secondary)
  Database: 'secondary',
  Server: 'secondary',
  HardDrive: 'secondary',
  Cpu: 'secondary',
  Power: 'secondary',
  LogOut: 'secondary',

  // MULTIMEDIA
  Image: 'success',
  Film: 'ai',
  Music: 'charts',

  // OTROS
  Download: 'primary',
  Upload: 'primary',
  Send: 'primary',
  RefreshCw: 'info',
  RefreshCcw: 'info',
  Link: 'info',
  Copy: 'info',
  Paperclip: 'secondary',
  Archive: 'secondary',
  Play: 'success',
  Pause: 'warning',
  Circle: 'subtle',
  ArrowUpCircle: 'success',
  ArrowDownCircle: 'danger',
  ArrowLeftRight: 'info',
  ArrowRightRight: 'info',
  Building: 'secondary',
  Building2: 'secondary',
  MapPin: 'danger',
  Target: 'danger',
  GitCompare: 'info',
  Inbox: 'secondary',
  List: 'secondary',
  LayoutGrid: 'secondary',
  Hash: 'secondary',
  MinusCircle: 'danger',
  Minus: 'danger',
  Sun: 'favorites',
  Moon: 'ai',
  Monitor: 'secondary',
  Wifi: 'success',
  WifiOff: 'danger',
  EyeOff: 'muted',
  Bookmark: 'favorites',
};
