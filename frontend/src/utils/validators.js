/**
 * Form Validation Utilities
 *
 * Funciones de validacion reutilizables para formularios.
 * Compatible con useFormValidation hook.
 */

// ============================================
// VALIDADORES BASICOS
// ============================================

/**
 * Valida que el campo no este vacio
 */
export const required = (message = "Este campo es requerido") => (value) => {
  if (value === null || value === undefined || value === "") {
    return message;
  }
  if (typeof value === "string" && value.trim() === "") {
    return message;
  }
  return null;
};

/**
 * Valida longitud minima
 */
export const minLength = (min, message) => (value) => {
  if (!value) return null; // Skip if empty (use required for that)
  const msg = message || `Minimo ${min} caracteres`;
  return value.length >= min ? null : msg;
};

/**
 * Valida longitud maxima
 */
export const maxLength = (max, message) => (value) => {
  if (!value) return null;
  const msg = message || `Maximo ${max} caracteres`;
  return value.length <= max ? null : msg;
};

/**
 * Valida que el valor este entre un rango de longitud
 */
export const lengthBetween = (min, max, message) => (value) => {
  if (!value) return null;
  const msg = message || `Debe tener entre ${min} y ${max} caracteres`;
  return value.length >= min && value.length <= max ? null : msg;
};

// ============================================
// VALIDADORES DE FORMATO
// ============================================

/**
 * Valida formato de email
 */
export const email = (message = "Email invalido") => (value) => {
  if (!value) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value) ? null : message;
};

/**
 * Valida formato de telefono (numeros, guiones, espacios, parentesis)
 */
export const phone = (message = "Telefono invalido") => (value) => {
  if (!value) return null;
  const phoneRegex = /^[\d\s\-+()]{7,20}$/;
  return phoneRegex.test(value) ? null : message;
};

/**
 * Valida que sea solo numeros
 */
export const numeric = (message = "Solo se permiten numeros") => (value) => {
  if (!value) return null;
  return /^\d+$/.test(value) ? null : message;
};

/**
 * Valida que sea alfanumerico
 */
export const alphanumeric = (message = "Solo se permiten letras y numeros") => (value) => {
  if (!value) return null;
  return /^[a-zA-Z0-9]+$/.test(value) ? null : message;
};

/**
 * Valida con expresion regular personalizada
 */
export const pattern = (regex, message = "Formato invalido") => (value) => {
  if (!value) return null;
  return regex.test(value) ? null : message;
};

// ============================================
// VALIDADORES DE CONTRASENA
// ============================================

/**
 * Valida fortaleza de contrasena
 * Retorna objeto con nivel y mensaje
 */
export const passwordStrength = (value) => {
  if (!value) return { level: 0, label: "", color: "" };

  let strength = 0;
  const checks = {
    length: value.length >= 8,
    lowercase: /[a-z]/.test(value),
    uppercase: /[A-Z]/.test(value),
    numbers: /\d/.test(value),
    symbols: /[!@#$%^&*(),.?":{}|<>]/.test(value),
    longLength: value.length >= 12,
  };

  if (checks.length) strength += 1;
  if (checks.lowercase) strength += 1;
  if (checks.uppercase) strength += 1;
  if (checks.numbers) strength += 1;
  if (checks.symbols) strength += 1;
  if (checks.longLength) strength += 1;

  const levels = [
    { level: 0, label: "", color: "" },
    { level: 1, label: "Muy debil", color: "red" },
    { level: 2, label: "Debil", color: "orange" },
    { level: 3, label: "Aceptable", color: "yellow" },
    { level: 4, label: "Buena", color: "lime" },
    { level: 5, label: "Fuerte", color: "green" },
    { level: 6, label: "Muy fuerte", color: "emerald" },
  ];

  return { ...levels[strength], checks };
};

/**
 * Valida contrasena con requisitos minimos
 */
export const password = (options = {}) => {
  const {
    minLength: min = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumbers = true,
    requireSymbols = false,
  } = options;

  return (value) => {
    if (!value) return null;

    const errors = [];

    if (value.length < min) {
      errors.push(`Minimo ${min} caracteres`);
    }
    if (requireUppercase && !/[A-Z]/.test(value)) {
      errors.push("Al menos una mayuscula");
    }
    if (requireLowercase && !/[a-z]/.test(value)) {
      errors.push("Al menos una minuscula");
    }
    if (requireNumbers && !/\d/.test(value)) {
      errors.push("Al menos un numero");
    }
    if (requireSymbols && !/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
      errors.push("Al menos un simbolo");
    }

    return errors.length > 0 ? errors.join(". ") : null;
  };
};

/**
 * Valida que dos campos coincidan (para confirmacion de contrasena)
 */
export const matches = (fieldName, message) => (value, allValues) => {
  const msg = message || `Debe coincidir con ${fieldName}`;
  return value === allValues[fieldName] ? null : msg;
};

// ============================================
// VALIDADORES NUMERICOS
// ============================================

/**
 * Valida valor minimo
 */
export const min = (minValue, message) => (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  const msg = message || `El valor minimo es ${minValue}`;
  return !isNaN(num) && num >= minValue ? null : msg;
};

/**
 * Valida valor maximo
 */
export const max = (maxValue, message) => (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  const msg = message || `El valor maximo es ${maxValue}`;
  return !isNaN(num) && num <= maxValue ? null : msg;
};

/**
 * Valida que sea un numero positivo
 */
export const positive = (message = "Debe ser un numero positivo") => (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return !isNaN(num) && num > 0 ? null : message;
};

/**
 * Valida que sea un numero entero
 */
export const integer = (message = "Debe ser un numero entero") => (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isInteger(num) ? null : message;
};

// ============================================
// VALIDADORES DE FECHA
// ============================================

/**
 * Valida que sea una fecha valida
 */
export const date = (message = "Fecha invalida") => (value) => {
  if (!value) return null;
  const dateObj = new Date(value);
  return !isNaN(dateObj.getTime()) ? null : message;
};

/**
 * Valida que la fecha sea futura
 */
export const futureDate = (message = "La fecha debe ser futura") => (value) => {
  if (!value) return null;
  const dateObj = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dateObj > today ? null : message;
};

/**
 * Valida que la fecha sea pasada
 */
export const pastDate = (message = "La fecha debe ser pasada") => (value) => {
  if (!value) return null;
  const dateObj = new Date(value);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return dateObj < today ? null : message;
};

// ============================================
// UTILIDADES DE VALIDACION
// ============================================

/**
 * Compone multiples validadores en uno solo
 * Ejecuta todos y retorna el primer error encontrado
 */
export const compose = (...validators) => (value, allValues) => {
  for (const validator of validators) {
    const error = validator(value, allValues);
    if (error) return error;
  }
  return null;
};

/**
 * Ejecuta validacion solo si el campo tiene valor
 * Util para campos opcionales con formato especifico
 */
export const optional = (validator) => (value, allValues) => {
  if (!value || (typeof value === "string" && value.trim() === "")) {
    return null;
  }
  return validator(value, allValues);
};

/**
 * Crea un schema de validacion a partir de un objeto
 * @example
 * const schema = createSchema({
 *   email: [required(), email()],
 *   password: [required(), minLength(8)]
 * });
 */
export const createSchema = (schema) => {
  return (values) => {
    const errors = {};

    for (const [field, validators] of Object.entries(schema)) {
      const fieldValidators = Array.isArray(validators) ? validators : [validators];
      const composedValidator = compose(...fieldValidators);
      const error = composedValidator(values[field], values);

      if (error) {
        errors[field] = error;
      }
    }

    return errors;
  };
};

/**
 * Validar un solo campo contra un schema
 */
export const validateField = (fieldName, value, schema, allValues = {}) => {
  const validators = schema[fieldName];
  if (!validators) return null;

  const fieldValidators = Array.isArray(validators) ? validators : [validators];
  const composedValidator = compose(...fieldValidators);
  return composedValidator(value, { ...allValues, [fieldName]: value });
};

export default {
  // Basic
  required,
  minLength,
  maxLength,
  lengthBetween,
  // Format
  email,
  phone,
  numeric,
  alphanumeric,
  pattern,
  // Password
  passwordStrength,
  password,
  matches,
  // Numeric
  min,
  max,
  positive,
  integer,
  // Date
  date,
  futureDate,
  pastDate,
  // Utils
  compose,
  optional,
  createSchema,
  validateField,
};
