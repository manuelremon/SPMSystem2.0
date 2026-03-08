import { memo } from "react";
// MUI Components
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import OutlinedInput from '@mui/material/OutlinedInput';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import ListItemText from '@mui/material/ListItemText';
import Select from '@mui/material/Select';
import Checkbox from '@mui/material/Checkbox';
import Slider from '@mui/material/Slider';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import { FONT_SIZES } from '../../components/ui/SPMChartJS';

// MenuProps para los multiselect
const ITEM_HEIGHT = 32;
const ITEM_PADDING_TOP = 4;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 6 + ITEM_PADDING_TOP,
      width: 160,
    },
  },
};

/**
 * FiltersBar - Filter controls bar (date range, centro, almacen, sector, solicitante)
 */
function FiltersBar({
  t,
  rangoFechasLocal,
  setRangoFechasLocal,
  sliderAFecha,
  centrosSeleccionados,
  setCentrosSeleccionados,
  almacenesSeleccionados,
  setAlmacenesSeleccionados,
  sectoresSeleccionados,
  setSectoresSeleccionados,
  solicitantesSeleccionados,
  setSolicitantesSeleccionados,
  filtrosOpciones,
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: 'var(--surface)',
        border: '1px solid',
        borderColor: 'divider',
        transition: 'box-shadow 0.2s ease-in-out',
        '&:hover': {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        },
      }}
    >
      <Box sx={{ py: 1, px: 3, height: 73, maxWidth: 1850 }}>
        <Stack direction="row" alignItems="center" gap={3} sx={{ height: '100%' }}>
          {/* Slider de rango de fechas - con debounce */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 320, ml: '180px' }}>
            <Typography variant="caption" sx={{ fontWeight: 500, color: 'grey.600', mt: 1 }}>
              {t('common_desde', 'Desde')} <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>{sliderAFecha(rangoFechasLocal[0])}</Box> {t('common_hasta', 'hasta')} <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>{sliderAFecha(rangoFechasLocal[1])}</Box>
            </Typography>
            <Slider
              size="small"
              value={rangoFechasLocal}
              onChange={(_, value) => setRangoFechasLocal(value)}
              min={0}
              max={365}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => sliderAFecha(value)}
              getAriaLabel={() => t('dash_rango_fechas', 'Rango de fechas')}
              sx={{
                color: 'var(--primary)',
                '& .MuiSlider-thumb': {
                  width: 14,
                  height: 14,
                },
                '& .MuiSlider-valueLabel': {
                  fontSize: 10,
                },
              }}
            />
            <Stack direction="row" justifyContent="space-between" sx={{ mt: -0.5 }}>
              <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, color: 'grey.400' }}>{t('dash_hace_1_ano', 'Hace 1 año')}</Typography>
              <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, color: 'grey.400' }}>{t('dash_hoy', 'Hoy')}</Typography>
            </Stack>
          </Box>

          {/* Separador vertical */}
          <Divider orientation="vertical" flexItem sx={{ height: 64 }} />

          {/* Centro Multiselect */}
          <FormControl size="small" sx={{ minWidth: 160, ml: '40px' }}>
            <InputLabel id="centro-label" sx={{ fontSize: FONT_SIZES.md }}>{t('common_centro', 'Centro')}</InputLabel>
            <Select
              labelId="centro-label"
              multiple
              value={centrosSeleccionados}
              onChange={(e) => {
                const value = e.target.value;
                if (value.includes('__todos__')) {
                  if (centrosSeleccionados.length === filtrosOpciones.centros.length) {
                    setCentrosSeleccionados([]);
                  } else {
                    setCentrosSeleccionados([...filtrosOpciones.centros]);
                  }
                } else {
                  setCentrosSeleccionados(typeof value === 'string' ? value.split(',') : value);
                }
              }}
              input={<OutlinedInput label={t('common_centro', 'Centro')} />}
              renderValue={(selected) => selected.length > 1 ? `${selected.length} seleccionados` : selected.join(', ')}
              MenuProps={MenuProps}
              sx={{ fontSize: FONT_SIZES.md }}
            >
              <MenuItem value="__todos__">
                <Checkbox checked={centrosSeleccionados.length === filtrosOpciones.centros.length && filtrosOpciones.centros.length > 0} size="small" />
                <ListItemText primary={t('common_seleccionar_todos', 'Seleccionar todos')} primaryTypographyProps={{ fontSize: FONT_SIZES.md, fontWeight: 600 }} />
              </MenuItem>
              {filtrosOpciones.centros.map((centro) => (
                <MenuItem key={centro} value={centro}>
                  <Checkbox checked={centrosSeleccionados.includes(centro)} size="small" />
                  <ListItemText primary={centro} primaryTypographyProps={{ fontSize: FONT_SIZES.md }} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Almacen Multiselect */}
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="almacen-label" sx={{ fontSize: FONT_SIZES.md }}>{t('common_almacen', 'Almacén')}</InputLabel>
            <Select
              labelId="almacen-label"
              multiple
              value={almacenesSeleccionados}
              onChange={(e) => {
                const value = e.target.value;
                if (value.includes('__todos__')) {
                  if (almacenesSeleccionados.length === filtrosOpciones.almacenes.length) {
                    setAlmacenesSeleccionados([]);
                  } else {
                    setAlmacenesSeleccionados([...filtrosOpciones.almacenes]);
                  }
                } else {
                  setAlmacenesSeleccionados(typeof value === 'string' ? value.split(',') : value);
                }
              }}
              input={<OutlinedInput label={t('common_almacen', 'Almacén')} />}
              renderValue={(selected) => selected.length > 1 ? `${selected.length} seleccionados` : selected.join(', ')}
              MenuProps={MenuProps}
              sx={{ fontSize: FONT_SIZES.md }}
            >
              <MenuItem value="__todos__">
                <Checkbox checked={almacenesSeleccionados.length === filtrosOpciones.almacenes.length && filtrosOpciones.almacenes.length > 0} size="small" />
                <ListItemText primary={t('common_seleccionar_todos', 'Seleccionar todos')} primaryTypographyProps={{ fontSize: FONT_SIZES.md, fontWeight: 600 }} />
              </MenuItem>
              {filtrosOpciones.almacenes.map((almacen) => (
                <MenuItem key={almacen} value={almacen}>
                  <Checkbox checked={almacenesSeleccionados.includes(almacen)} size="small" />
                  <ListItemText primary={almacen} primaryTypographyProps={{ fontSize: FONT_SIZES.md }} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Sector Multiselect */}
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="sector-label" sx={{ fontSize: FONT_SIZES.md }}>{t('common_sector', 'Sector')}</InputLabel>
            <Select
              labelId="sector-label"
              multiple
              value={sectoresSeleccionados}
              onChange={(e) => {
                const value = e.target.value;
                if (value.includes('__todos__')) {
                  if (sectoresSeleccionados.length === filtrosOpciones.sectores.length) {
                    setSectoresSeleccionados([]);
                  } else {
                    setSectoresSeleccionados([...filtrosOpciones.sectores]);
                  }
                } else {
                  setSectoresSeleccionados(typeof value === 'string' ? value.split(',') : value);
                }
              }}
              input={<OutlinedInput label={t('common_sector', 'Sector')} />}
              renderValue={(selected) => selected.length > 1 ? `${selected.length} seleccionados` : selected.join(', ')}
              MenuProps={MenuProps}
              sx={{ fontSize: FONT_SIZES.md }}
            >
              <MenuItem value="__todos__">
                <Checkbox checked={sectoresSeleccionados.length === filtrosOpciones.sectores.length && filtrosOpciones.sectores.length > 0} size="small" />
                <ListItemText primary={t('common_seleccionar_todos', 'Seleccionar todos')} primaryTypographyProps={{ fontSize: FONT_SIZES.md, fontWeight: 600 }} />
              </MenuItem>
              {filtrosOpciones.sectores.map((sector) => (
                <MenuItem key={sector} value={sector}>
                  <Checkbox checked={sectoresSeleccionados.includes(sector)} size="small" />
                  <ListItemText primary={sector} primaryTypographyProps={{ fontSize: FONT_SIZES.md }} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Solicitante Multiselect */}
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="solicitante-label" sx={{ fontSize: FONT_SIZES.md }}>{t('common_solicitante', 'Solicitante')}</InputLabel>
            <Select
              labelId="solicitante-label"
              multiple
              value={solicitantesSeleccionados}
              onChange={(e) => {
                const value = e.target.value;
                if (value.includes('__todos__')) {
                  if (solicitantesSeleccionados.length === filtrosOpciones.solicitantes.length) {
                    setSolicitantesSeleccionados([]);
                  } else {
                    setSolicitantesSeleccionados([...filtrosOpciones.solicitantes]);
                  }
                } else {
                  setSolicitantesSeleccionados(typeof value === 'string' ? value.split(',') : value);
                }
              }}
              input={<OutlinedInput label={t('common_solicitante', 'Solicitante')} />}
              renderValue={(selected) => selected.length > 1 ? `${selected.length} seleccionados` : selected.join(', ')}
              MenuProps={MenuProps}
              sx={{ fontSize: FONT_SIZES.md }}
            >
              <MenuItem value="__todos__">
                <Checkbox checked={solicitantesSeleccionados.length === filtrosOpciones.solicitantes.length && filtrosOpciones.solicitantes.length > 0} size="small" />
                <ListItemText primary={t('common_seleccionar_todos', 'Seleccionar todos')} primaryTypographyProps={{ fontSize: FONT_SIZES.md, fontWeight: 600 }} />
              </MenuItem>
              {filtrosOpciones.solicitantes.map((solicitante) => (
                <MenuItem key={solicitante} value={solicitante}>
                  <Checkbox checked={solicitantesSeleccionados.includes(solicitante)} size="small" />
                  <ListItemText primary={solicitante} primaryTypographyProps={{ fontSize: FONT_SIZES.md }} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Boton limpiar filtros (deseleccionar todos) */}
          <Button
            variant="outlined"
            size="small"
            aria-label={t('dash_clear_filters', 'Limpiar todos los filtros')}
            onClick={() => {
              setRangoFechasLocal([0, 365]); // Un ano completo
              setCentrosSeleccionados([]);
              setAlmacenesSeleccionados([]);
              setSectoresSeleccionados([]);
              setSolicitantesSeleccionados([]);
            }}
            sx={{
              px: 1.5,
              py: 0.75,
              fontSize: FONT_SIZES.md,
              fontWeight: 500,
              color: 'grey.600',
              borderColor: 'grey.200',
              '&:hover': {
                color: 'primary.main',
                borderColor: 'primary.light',
              },
              textTransform: 'none',
            }}
          >
            {t('dash_limpiar_filtros', 'Limpiar Filtros')}
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}

export default memo(FiltersBar);
