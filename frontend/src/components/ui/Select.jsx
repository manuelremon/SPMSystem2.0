/**
 * Select Component - MUI Outlined Style
 * Wrapper around MUI Select with outlined variant
 *
 * @deprecated Use SelectField with variant="mui" instead
 * This file is maintained for backwards compatibility
 *
 * Migration:
 *   Before: import { Select } from './Select'
 *   After:  import { SelectField } from './SelectField'
 *           <SelectField variant="mui" ... />
 */

import React from "react";
import PropTypes from "prop-types";
import { SelectField } from "./SelectField";

export const Select = React.forwardRef((props, ref) => {
  return (
    <SelectField
      ref={ref}
      variant="mui"
      {...props}
    />
  );
});

Select.displayName = "Select";

Select.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
      disabled: PropTypes.bool,
    })
  ),
  error: PropTypes.bool,
  helperText: PropTypes.string,
  disabled: PropTypes.bool,
  fullWidth: PropTypes.bool,
  size: PropTypes.oneOf(["small", "medium"]),
  placeholder: PropTypes.string,
  children: PropTypes.node,
  className: PropTypes.string,
  id: PropTypes.string,
  name: PropTypes.string,
  required: PropTypes.bool,
};

Select.defaultProps = {
  options: [],
  error: false,
  disabled: false,
  fullWidth: true,
  size: "medium",
  className: "",
  required: false,
};

export default Select;
