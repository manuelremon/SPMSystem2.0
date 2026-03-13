import { memo } from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';

/**
 * CategoryHeader - Visual section divider for dashboard categories.
 * Renders icon + title + optional subtitle + optional badge count + decorative line.
 */
function CategoryHeader({ icon, title, subtitle, count, color = 'primary.main', id }) {
  return (
    <Box id={id} sx={{ mt: 1 }}>
      <Stack direction="row" alignItems="center" gap={1.5}>
        {/* Decorative left accent */}
        <Box
          sx={{
            width: 4,
            height: 28,
            bgcolor: color,
            flexShrink: 0,
          }}
        />

        {/* Icon */}
        {icon && (
          <Box sx={{ color, display: 'flex', alignItems: 'center' }}>
            {icon}
          </Box>
        )}

        {/* Title + subtitle */}
        <Stack spacing={0}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                fontSize: '0.78rem',
                color: 'text.primary',
              }}
            >
              {title}
            </Typography>
            {count != null && count > 0 && (
              <Chip
                size="small"
                label={count}
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  bgcolor: color,
                  color: 'common.white',
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            )}
          </Stack>
          {subtitle && (
            <Typography
              variant="caption"
              sx={{
                color: 'text.disabled',
                fontSize: '0.68rem',
                letterSpacing: '0.3px',
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Stack>

        {/* Decorative line extending to the right */}
        <Box
          sx={{
            flex: 1,
            height: '1px',
            background: (theme) =>
              `linear-gradient(to right, ${theme.palette.divider}, transparent)`,
            ml: 1,
          }}
        />
      </Stack>
    </Box>
  );
}

export default memo(CategoryHeader);
