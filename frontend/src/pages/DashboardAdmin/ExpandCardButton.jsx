import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';

/**
 * ExpandCardButton - Button to expand a KPI card into a modal
 */
export default function ExpandCardButton({ onClick, size = 'small' }) {
  return (
    <Tooltip title="Ampliar">
      <IconButton
        size={size}
        onClick={onClick}
        aria-label="Ampliar tarjeta"
        sx={{
          color: 'text.secondary',
          '&:hover': {
            color: 'primary.main',
            bgcolor: 'primary.lighter',
          },
        }}
      >
        <OpenInFullIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
