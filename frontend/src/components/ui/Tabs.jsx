/**
 * Tabs Component - SPM Design System
 * Usa MUI Tabs internamente para consistencia con Material Design
 */

import React, { createContext, useContext, useState } from "react";
import PropTypes from "prop-types";
import MuiTabsBase from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Badge from "@mui/material/Badge";

// Context for Tabs state
const TabsContext = createContext(null);

/**
 * Tabs Component - Wrapper principal
 */
export function Tabs({
  children,
  defaultValue,
  value,
  onValueChange,
  variant = "default",
  className,
  ...props
}) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeValue = value !== undefined ? value : internalValue;

  const handleChange = (newValue) => {
    if (value === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ activeValue, onValueChange: handleChange, variant }}>
      <Box className={className} sx={{ width: '100%' }} {...props}>
        {children}
      </Box>
    </TabsContext.Provider>
  );
}

/**
 * TabsList - Container for tab triggers usando MUI Tabs
 */
export function TabsList({ children, className, ...props }) {
  const { activeValue, onValueChange } = useContext(TabsContext);

  // Extraer valores de los children (TabsTrigger)
  const tabs = React.Children.toArray(children).filter(
    (child) => React.isValidElement(child) && child.type === TabsTrigger
  );

  const handleChange = (event, newValue) => {
    onValueChange(newValue);
  };

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider' }} className={className} {...props}>
      <MuiTabsBase
        value={activeValue}
        onChange={handleChange}
        variant="standard"
        aria-label="tabs"
      >
        {tabs.map((child) => {
          const { value, children: label, disabled, className: tabClassName, tooltip, count, icon, sx: tabSx } = child.props;

          // Build label with optional badge and icon
          let tabLabel = label;
          if (count !== undefined) {
            tabLabel = (
              <Badge
                badgeContent={count}
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
                <span style={{ paddingRight: count > 0 ? 8 : 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {icon}
                  {label}
                </span>
              </Badge>
            );
          } else if (icon) {
            tabLabel = (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {icon}
                {label}
              </span>
            );
          }

          const tabElement = (
            <Tab
              key={value}
              value={value}
              label={tabLabel}
              disabled={disabled}
              className={tabClassName}
              sx={tabSx}
              id={`tab-${value}`}
              aria-controls={`tabpanel-${value}`}
            />
          );
          return tooltip ? (
            <Tooltip key={value} title={tooltip} arrow placement="top">
              <span>{tabElement}</span>
            </Tooltip>
          ) : tabElement;
        })}
      </MuiTabsBase>
    </Box>
  );
}

/**
 * TabsTrigger - Tab button (usado para definir tabs, renderizado por TabsList)
 *
 * @param {string} value - Unique value for this tab
 * @param {ReactNode} children - Tab label
 * @param {boolean} disabled - Whether tab is disabled
 * @param {string} tooltip - Optional tooltip text
 * @param {number} count - Optional badge count
 * @param {ReactNode} icon - Optional icon to display before label
 */
export function TabsTrigger({ children, value, className, disabled = false, tooltip = null, count, icon, ...props }) {
  // Este componente solo se usa para definir la estructura
  // El renderizado real lo hace TabsList con MUI Tab
  return null;
}

/**
 * TabsContent - Tab content panel
 */
export function TabsContent({ children, value, className, ...props }) {
  const { activeValue } = useContext(TabsContext);

  if (activeValue !== value) return null;

  return (
    <Box
      role="tabpanel"
      id={`tabpanel-${value}`}
      aria-labelledby={`tab-${value}`}
      tabIndex={0}
      sx={{ pt: 3 }}
      className={className}
      {...props}
    >
      {children}
    </Box>
  );
}

Tabs.propTypes = {
  children: PropTypes.node,
  defaultValue: PropTypes.string,
  value: PropTypes.string,
  onValueChange: PropTypes.func,
  variant: PropTypes.oneOf(["default", "pills", "underline"]),
  className: PropTypes.string,
};

TabsList.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

TabsTrigger.propTypes = {
  children: PropTypes.node,
  value: PropTypes.string.isRequired,
  className: PropTypes.string,
  disabled: PropTypes.bool,
  tooltip: PropTypes.string,
  count: PropTypes.number,
  icon: PropTypes.node,
};

TabsContent.propTypes = {
  children: PropTypes.node,
  value: PropTypes.string.isRequired,
  className: PropTypes.string,
};
