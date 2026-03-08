/**
 * Materials Page - Add materials to a request
 * Material UI Implementation
 *
 * This page has been refactored into:
 * - useMaterials hook: State management and handlers
 * - MaterialDetailModal: Detail modal component
 * - MaterialsTable: Table of added items
 * - SearchDropdown: Search results dropdown
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useMaterials } from "../hooks/useMaterials";
import { formatCurrency } from "../utils/formatters";
import { useI18n } from "../context/i18n";
import { renderSector } from "../constants/sectores";

// MUI Components
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  TextField,
  Alert,
  Stack,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Divider,
  InputAdornment,
} from "@mui/material";

// MUI Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import VisibilityIcon from "@mui/icons-material/Visibility";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";

// Material-specific components
import { MaterialDetailModal, MaterialsTable, SearchDropdown, BarcodeScanner } from "../components/materials";
import { AssistantModal } from "../components/AssistantModal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";

// Skeleton for loading state
function TableSkeleton() {
  return (
    <Box sx={{ p: 3 }}>
      {[...Array(5)].map((_, i) => (
        <Box
          key={i}
          sx={{
            height: 48,
            bgcolor: "grey.100",
            mb: 1,
            animation: "pulse 1.5s ease-in-out infinite",
            "@keyframes pulse": {
              "0%, 100%": { opacity: 1 },
              "50%": { opacity: 0.5 },
            },
          }}
        />
      ))}
    </Box>
  );
}

export default function Materials() {
  const { t } = useI18n();

  // Get all state and handlers from custom hook
  const m = useMaterials();

  // Load favorites on mount
  useEffect(() => {
    m.loadFavoritos();
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ═══════════════════════════════════════════════════════════════════

  if (m.loading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'text.primary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {t("materials_title", "Agregar Materiales")}
          </Typography>
        </Box>
        <Paper variant="outlined" aria-busy="true" aria-label={t("materials_loading", "Cargando materiales")}>
          <Box sx={{ pt: 3 }}>
            <TableSkeleton />
          </Box>
        </Paper>
      </Box>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h5" component="h1" fontWeight={600} color="text.primary">
          {t("materials_title", "Agregar Materiales")}
        </Typography>
        <Button
          component={Link}
          to="/mis-solicitudes"
          variant="text"
          startIcon={<ArrowBackIcon />}
          sx={{ textTransform: "none" }}
          aria-label={t("common_volver_mis_solicitudes", "Volver a Mis Solicitudes")}
        >
          {t("common_volver", "Volver")}
        </Button>
      </Box>

      {/* Messages */}
      <Box aria-live="polite">
        {m.error && (
          <Alert severity="error" onClose={() => m.setError("")}>
            {m.error}
          </Alert>
        )}
        {m.actionMsg && (
          <Alert severity="success" onClose={() => m.setActionMsg("")}>
            {m.actionMsg}
          </Alert>
        )}
      </Box>

      {/* Favorites Section */}
      {m.favoritos && m.favoritos.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
            <StarIcon sx={{ color: "warning.main", fontSize: 20 }} />
            <Typography variant="subtitle2" fontWeight={600} color="text.primary">
              {t("favorites_section", "Acceso rápido")}
            </Typography>
            <Chip label={m.favoritos.length} size="small" sx={{ height: 20 }} />
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            {m.favoritos.slice(0, 10).map((fav) => (
              <Chip
                key={fav.codigo}
                label={`${fav.codigo} - ${fav.descripcion.substring(0, 30)}...`}
                onClick={() => {
                  m.setSearchCodigo(fav.codigo);
                  m.handleSelect(fav);
                }}
                onDelete={() => m.toggleFavorito(fav.codigo)}
                deleteIcon={<StarIcon sx={{ color: "warning.main" }} />}
                sx={{
                  bgcolor: "warning.50",
                  borderColor: "warning.light",
                  "&:hover": { bgcolor: "warning.100" },
                }}
              />
            ))}
          </Stack>
        </Paper>
      )}

      {/* Search and Context Section */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr 1fr" },
            gap: 3,
          }}
        >
          {/* Left: Search */}
          <SearchSection m={m} t={t} />

          {/* Center: Selected Material */}
          <SelectedMaterialSection m={m} t={t} />

          {/* Right: Context Info */}
          <ContextSection m={m} t={t} />
        </Box>
      </Paper>

      {/* Materials Summary Section */}
      <Paper variant="outlined">
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            px: 3,
            py: 2,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Typography variant="subtitle1" component="h2" fontWeight={600} color="text.primary">
            {t("materials_resumen", "Resumen de Materiales")}
          </Typography>
          {m.items.length > 0 && (
            <Chip
              label={`${m.items.length} ${m.items.length === 1 ? t("common_item", "item") : t("common_items", "items")}`}
              size="small"
              color="primary"
              sx={{ height: 24 }}
            />
          )}
        </Box>

        {/* Content */}
        <Box sx={{ p: 3 }}>
          <MaterialsTable
            items={m.itemsSorted}
            onQtyChange={m.handleQtyChange}
            onDelete={m.handleDelete}
            onOpenComment={m.handleOpenComment}
          />

          {/* Action Buttons */}
          <Divider sx={{ my: 3 }} />
          <Stack direction="row" spacing={2} justifyContent="flex-end" flexWrap="wrap">
            <Button
              variant="outlined"
              color="error"
              onClick={m.handleCancelar}
              disabled={m.submitting || m.savingDraft}
              sx={{ textTransform: "none" }}
            >
              {t("materials_cancelar_solicitud", "Cancelar Solicitud")}
            </Button>
            <Button
              variant="outlined"
              onClick={m.handleSaveDraft}
              disabled={m.items.length === 0 || m.savingDraft || m.submitting}
              sx={{ textTransform: "none" }}
            >
              {m.savingDraft
                ? t("materials_guardando", "Guardando...")
                : t("materials_guardar_borrador", "Guardar como borrador")}
            </Button>
            <Button
              variant="contained"
              onClick={m.handleFinalizar}
              disabled={m.items.length === 0 || m.submitting || m.savingDraft}
              sx={{ textTransform: "none" }}
            >
              {m.submitting
                ? t("materials_enviando", "Enviando...")
                : t("materials_enviar", "Enviar Solicitud")}
            </Button>
          </Stack>
        </Box>
      </Paper>

      {/* Material Detail Modal */}
      <MaterialDetailModal
        isOpen={m.showDetailModal}
        onClose={m.closeDetailModal}
        selectedMaterial={m.selectedMaterial}
        detail={m.detail}
        loadingDetail={m.loadingDetail}
        contextoCentro={m.contextoCentro}
        contextoAlmacen={m.contextoAlmacen}
        showStockFull={m.showStockFull}
        setShowStockFull={m.setShowStockFull}
      />

      {/* Cancel Confirmation Modal */}
      <ConfirmDialog
        open={m.showCancelModal}
        onClose={() => m.setShowCancelModal(false)}
        onConfirm={m.confirmCancelar}
        title={t("materials_cancelar_titulo", "Cancelar Solicitud")}
        description={t("materials_cancelar_confirm", "Se borraran todos los datos ingresados. Continuar?")}
        confirmText={t("common_confirmar", "Confirmar")}
        cancelText={t("common_cancelar", "Cancelar")}
        variant="warning"
      />

      {/* Submit Confirmation Modal */}
      <ConfirmDialog
        open={m.showSubmitModal}
        onClose={() => m.setShowSubmitModal(false)}
        onConfirm={m.confirmFinalizar}
        title={t("materials_enviar_titulo", "Enviar Solicitud")}
        description={t(
          "materials_enviar_confirm",
          `Confirmas el envio de la solicitud con ${m.items.length} material(es) por un total de ${formatCurrency(m.total)}?`
        )}
        confirmText={t("materials_enviar_btn", "Si, enviar solicitud")}
        cancelText={t("common_cancelar", "Cancelar")}
        variant="info"
        loading={m.submitting}
      />

      {/* Comment Modal */}
      <CommentDialog
        open={m.commentModal.open}
        onClose={m.closeCommentModal}
        codigo={m.commentModal.codigo}
        comment={m.commentModal.comment}
        onCommentChange={(value) => m.updateCommentText(value)}
        onSave={m.handleSaveComment}
        t={t}
      />

      {/* Search Dropdown */}
      <SearchDropdown
        dropdownRef={m.dropdownRef}
        dropdownOpen={m.dropdownOpen}
        dropdownPosition={m.dropdownPosition}
        results={m.results}
        loadingSearch={m.loadingSearch}
        selectedMaterial={m.selectedMaterial}
        highlightedIndex={m.highlightedIndex}
        debouncedCodigo={m.debouncedCodigo}
        debouncedDesc={m.debouncedDesc}
        onSelect={m.handleSelect}
        onClose={() => m.setDropdownOpen(false)}
        setHighlightedIndex={m.setHighlightedIndex}
        favoritos={m.favoritos}
        toggleFavorito={m.toggleFavorito}
      />

      {/* Assistant Modal for AI-powered material creation */}
      <AssistantModal
        isOpen={m.showAssistant}
        onClose={() => m.setShowAssistant(false)}
        onUseSuggestions={(suggestions) => {
          m.handleAddSuggestedItems(suggestions.items);
        }}
      />

      {/* Barcode Scanner */}
      <BarcodeScanner
        open={m.showScanner || false}
        onClose={() => m.setShowScanner && m.setShowScanner(false)}
        onScan={(code) => {
          m.setSearchCodigo(code);
          m.setShowScanner && m.setShowScanner(false);
        }}
      />
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function SearchSection({ m, t }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Typography
          variant="caption"
          fontWeight={600}
          color="text.secondary"
          sx={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
        >
          {t("materials_buscar", "Buscar material")}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<QrCodeScannerIcon sx={{ fontSize: 16 }} />}
          onClick={() => m.setShowScanner && m.setShowScanner(true)}
          sx={{
            textTransform: "none",
            fontSize: "0.75rem",
            py: 0.5,
            px: 1.5,
            borderColor: "info.light",
            color: "info.dark",
            bgcolor: "info.50",
            "&:hover": {
              borderColor: "info.main",
              bgcolor: "info.100",
            },
          }}
        >
          {t("scanner_scan", "Escanear")}
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AutoAwesomeIcon sx={{ fontSize: 16, color: "secondary.main" }} />}
          onClick={() => m.setShowAssistant && m.setShowAssistant(true)}
          sx={{
            textTransform: "none",
            fontSize: "0.75rem",
            py: 0.5,
            px: 1.5,
            borderColor: "warning.light",
            color: "warning.dark",
            bgcolor: "warning.50",
            "&:hover": {
              borderColor: "warning.main",
              bgcolor: "warning.100",
            },
          }}
        >
          {t("materials_asistente_ia", "Asistente IA")}
        </Button>
      </Box>

      {/* Search inputs container */}
      <Box
        ref={m.searchContainerRef}
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          gap: 1.5,
        }}
      >
        {/* Codigo SAP */}
        <TextField
          id="searchCodigo"
          value={m.searchCodigo}
          onChange={(e) => m.setSearchCodigo(e.target.value)}
          onKeyDown={m.handleSearchKeyDown}
          placeholder={t("materials_codigo_sap", "Código Material")}
          size="small"
          sx={{
            width: { xs: "100%", sm: 144 },
            flexShrink: 0,
            "& .MuiInputBase-input": { fontFamily: "monospace" },
          }}
          aria-label={t("materials_codigo_sap", "Código Material")}
        />

        {/* Descripcion */}
        <TextField
          id="searchDesc"
          value={m.searchDesc}
          onChange={(e) => m.setSearchDesc(e.target.value)}
          onKeyDown={m.handleSearchKeyDown}
          placeholder={t("materials_buscar_desc", "Buscar por descripcion...")}
          size="small"
          sx={{ flex: 1, maxWidth: { sm: 320 } }}
          aria-label={t("materials_descripcion", "Descripcion")}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Stack direction="row" spacing={0.5} alignItems="center">
                  {m.loadingSearch && <CircularProgress size={16} />}
                  {!m.loadingSearch && m.results.length > 0 && (
                    <Chip
                      label={m.results.length}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: "0.7rem",
                        bgcolor: "grey.100",
                        color: "text.secondary",
                      }}
                    />
                  )}
                  {(m.searchCodigo || m.searchDesc) && (
                    <IconButton
                      size="small"
                      onClick={m.handleClearSearch}
                      aria-label={t("materials_limpiar_busqueda", "Limpiar busqueda")}
                      sx={{ p: 0.25 }}
                    >
                      <CloseIcon sx={{ fontSize: 18, color: "error.main" }} />
                    </IconButton>
                  )}
                </Stack>
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Results indicator */}
      <Box aria-live="polite" role="status">
        {(m.searchCodigo || m.searchDesc) && !m.loadingSearch && m.results.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            {m.results.length} {m.results.length === 1 ? t("common_resultado", "resultado") : t("common_resultados", "resultados")}
            <Box component="span" sx={{ opacity: 0.6 }}>
              {" "}
              — {t("materials_selecciona_uno", "selecciona uno")}
            </Box>
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function SelectedMaterialSection({ m, t }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column" }}>
      <Typography
        variant="caption"
        fontWeight={600}
        color="text.secondary"
        sx={{ textTransform: "uppercase", letterSpacing: "0.05em", mb: 1.5 }}
      >
        {t("materials_selected", "Material seleccionado")}
      </Typography>

      {m.selectedMaterial ? (
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            borderColor: "primary.light",
            bgcolor: "primary.50",
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            {m.detailViewed && <CheckIcon sx={{ fontSize: 18, color: "success.main" }} />}
            <Typography
              variant="body2"
              sx={{
                fontFamily: "monospace",
                color: "primary.main",
                fontWeight: 500,
              }}
            >
              {m.selectedMaterial.codigo}
            </Typography>
          </Stack>

          <Typography
            variant="body2"
            fontWeight={500}
            color="text.primary"
            sx={{
              mb: 0.5,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {m.selectedMaterial.descripcion}
          </Typography>

          {m.selectedMaterial.precio_usd > 0 && (
            <Typography variant="body2" color="text.secondary">
              {t("materials_precio", "Precio")}:{" "}
              <Box component="span" sx={{ fontFamily: "monospace", fontWeight: 500, color: "text.primary" }}>
                {formatCurrency(m.selectedMaterial.precio_usd)}
              </Box>
            </Typography>
          )}

          {!m.detailViewed && (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1 }}>
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  bgcolor: "warning.main",
                }}
              />
              <Typography variant="caption" color="warning.dark">
                {t("materials_view_detail_first", "Ver detalles antes de agregar")}
              </Typography>
            </Stack>
          )}

          {/* Actions */}
          <Divider sx={{ my: 1.5 }} />
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={m.loadingDetail ? <CircularProgress size={14} /> : <VisibilityIcon sx={{ fontSize: 16 }} />}
              onClick={m.openDetailModal}
              disabled={m.loadingDetail}
              aria-label={`${t("materials_mas_detalles", "Ver detalles")} ${m.selectedMaterial?.codigo || ''}`}
              sx={{ flex: 1, textTransform: "none" }}
            >
              {t("materials_mas_detalles", "Ver detalles")}
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={m.handleAdd}
              disabled={!m.detailViewed}
              aria-label={`${t("materials_agregar", "Agregar")} ${m.selectedMaterial?.codigo || ''}`}
              sx={{ flex: 1, textTransform: "none" }}
            >
              {t("materials_agregar", "Agregar")}
            </Button>
          </Stack>
        </Paper>
      ) : (
        <Paper
          variant="outlined"
          sx={{
            p: 3,
            borderStyle: "dashed",
            borderColor: "grey.300",
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography variant="body2" color="text.secondary" textAlign="center">
            {t("materials_busca_selecciona", "Busca y selecciona un material")}
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

function ContextSection({ m, t }) {
  return (
    <Box>
      <Typography
        variant="caption"
        fontWeight={600}
        color="text.secondary"
        sx={{ textTransform: "uppercase", letterSpacing: "0.05em", mb: 1.5, display: "block" }}
      >
        {t("materials_contexto", "Contexto")}
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="caption" color="text.secondary">
            {t("common_solicitud", "Solicitud")}
          </Typography>
          <Typography variant="body2" fontWeight={600} color="text.primary">
            #{m.id}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {t("common_centro", "Centro")}
          </Typography>
          <Typography variant="body2" fontWeight={600} color="text.primary">
            {m.sol?.centro || "—"}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {t("common_sector", "Sector")}
          </Typography>
          <Typography variant="body2" fontWeight={600} color="text.primary">
            {renderSector(m.sol) || "—"}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {t("common_almacen", "Almacen")}
          </Typography>
          <Typography variant="body2" fontWeight={600} color="text.primary">
            {m.sol?.almacen_virtual || "—"}
          </Typography>
        </Box>

        {/* Total section */}
        <Box sx={{ gridColumn: "1 / -1", pt: 2, mt: 1, borderTop: 1, borderColor: "divider" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t("common_total", "Total")}
              </Typography>
              <Typography variant="h6" fontWeight={700} color="text.primary" sx={{ fontFamily: "monospace" }}>
                {formatCurrency(m.total)}
              </Typography>
            </Box>
            {m.presupuesto && (
              <Box sx={{ textAlign: "right" }}>
                <Typography variant="caption" color="text.secondary">
                  {t("materials_saldo_disponible", "Saldo disponible")}
                </Typography>
                <Typography
                  variant="body1"
                  fontWeight={600}
                  sx={{
                    fontFamily: "monospace",
                    color: m.presupuestoInsuf ? "error.main" : "success.main",
                  }}
                >
                  {formatCurrency(m.presupuesto.saldo_usd || 0)}
                </Typography>
              </Box>
            )}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DIALOG COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// ConfirmDialog imported from components/ui/ConfirmDialog

function CommentDialog({ open, onClose, codigo, comment, onCommentChange, onSave, t }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: {} }}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="subtitle1" component="span" fontWeight={600} color="text.primary">
          {t("materials_nota_titulo", "Nota para el material")}
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label={t("common_cerrar", "Cerrar")}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {codigo && (
            <Typography variant="body2" color="text.secondary">
              {t("materials_nota_para", "Material:")}{" "}
              <Box component="span" sx={{ fontFamily: "monospace", fontWeight: 600, color: "text.primary" }}>
                {codigo}
              </Box>
            </Typography>
          )}
          <Box>
            <Typography
              variant="caption"
              fontWeight={600}
              color="text.secondary"
              sx={{ textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.5, display: "block" }}
            >
              {t("materials_nota_label_input", "Comentario / Nota")}
            </Typography>
            <TextField
              id="commentInput"
              value={comment}
              onChange={(e) => onCommentChange(e.target.value)}
              multiline
              rows={4}
              fullWidth
              placeholder={t("materials_nota_placeholder", "Escribe una nota o comentario para este material...")}
              sx={{ "& .MuiInputBase-root": { resize: "none" } }}
            />
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, bgcolor: "grey.50" }}>
        <Button onClick={onClose} variant="outlined" size="small" sx={{ textTransform: "none" }}>
          {t("common_cancelar", "Cancelar")}
        </Button>
        <Button onClick={onSave} variant="contained" size="small" sx={{ textTransform: "none" }}>
          {t("materials_nota_guardar", "Guardar nota")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
