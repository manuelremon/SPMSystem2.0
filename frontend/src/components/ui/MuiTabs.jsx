/**
 * MuiTabs - Sistema de Tabs basado en MUI
 * Reemplaza el componente Tabs custom con estilo Material UI
 *
 * Uso:
 * <MuiTabs
 *   value={activeTab}
 *   onChange={(e, newValue) => setActiveTab(newValue)}
 *   tabs={[
 *     { value: 'tab1', label: 'Tab 1', icon: <Icon /> },
 *     { value: 'tab2', label: 'Tab 2', count: 5 },
 *   ]}
 * />
 * <MuiTabPanel value={activeTab} index="tab1">Content 1</MuiTabPanel>
 * <MuiTabPanel value={activeTab} index="tab2">Content 2</MuiTabPanel>
 */

import * as React from 'react';
import MuiTabsBase from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';

/**
 * TabPanel - Panel de contenido para cada tab
 */
export function MuiTabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

/**
 * Genera props de accesibilidad para tabs
 */
function a11yProps(index) {
  return {
    id: `tab-${index}`,
    'aria-controls': `tabpanel-${index}`,
  };
}

/**
 * MuiTabs - Componente principal de tabs
 *
 * @param {Object} props
 * @param {string|number} props.value - Valor de la tab activa
 * @param {function} props.onChange - Handler (event, newValue) => void
 * @param {Array} props.tabs - Array de tabs: { value, label, icon?, count?, disabled? }
 * @param {string} props.variant - 'standard' | 'scrollable' | 'fullWidth'
 * @param {boolean} props.centered - Centrar tabs
 * @param {Object} props.sx - Estilos adicionales
 */
export function MuiTabs({
  value,
  onChange,
  tabs = [],
  variant = 'standard',
  centered = false,
  scrollButtons = 'auto',
  sx = {},
  tabsSx = {},
  ...props
}) {
  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', ...sx }}>
      <MuiTabsBase
        value={value}
        onChange={onChange}
        variant={variant}
        centered={centered}
        scrollButtons={scrollButtons}
        allowScrollButtonsMobile
        aria-label="tabs"
        sx={tabsSx}
        {...props}
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.value}
            value={tab.value}
            label={
              tab.count !== undefined ? (
                <Badge
                  badgeContent={tab.count}
                  color="primary"
                  max={99}
                  sx={{
                    '& .MuiBadge-badge': {
                      right: -12,
                      top: 2,
                      fontSize: '0.65rem',
                      minWidth: 18,
                      height: 18,
                    },
                  }}
                >
                  <span style={{ paddingRight: tab.count > 0 ? 8 : 0 }}>{tab.label}</span>
                </Badge>
              ) : (
                tab.label
              )
            }
            disabled={tab.disabled}
            {...a11yProps(tab.value)}
          />
        ))}
      </MuiTabsBase>
    </Box>
  );
}

/**
 * Hook para manejar estado de tabs
 */
export function useTabs(defaultValue) {
  const [value, setValue] = React.useState(defaultValue);

  const handleChange = React.useCallback((event, newValue) => {
    setValue(newValue);
  }, []);

  return {
    value,
    onChange: handleChange,
    setValue,
  };
}

export default MuiTabs;
