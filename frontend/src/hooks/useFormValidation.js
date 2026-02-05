/**
 * useFormValidation Hook
 *
 * Hook para manejo de estado y validacion de formularios.
 * Proporciona validacion en tiempo real, touched state, y submit handling.
 *
 * @example
 * const { values, errors, touched, handleChange, handleBlur, handleSubmit, isValid } =
 *   useFormValidation(
 *     { email: "", password: "" },
 *     {
 *       email: [required(), email()],
 *       password: [required(), minLength(8)]
 *     }
 *   );
 */

import { useState, useCallback, useMemo } from "react";
import { validateField, createSchema } from "../utils/validators";

/**
 * @param {Object} initialValues - Valores iniciales del formulario
 * @param {Object} validationSchema - Schema de validacion { field: [validators] }
 * @param {Object} options - Opciones adicionales
 * @param {boolean} options.validateOnChange - Validar al cambiar valor (default: true)
 * @param {boolean} options.validateOnBlur - Validar al perder focus (default: true)
 * @param {Function} options.onSubmit - Callback al submit exitoso
 */
export function useFormValidation(
  initialValues = {},
  validationSchema = {},
  options = {}
) {
  const {
    validateOnChange = true,
    validateOnBlur = true,
    onSubmit: onSubmitCallback,
  } = options;

  // Estado del formulario
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);

  // Crear validador completo del schema
  const validateAll = useMemo(
    () => createSchema(validationSchema),
    [validationSchema]
  );

  /**
   * Validar un campo individual
   */
  const validateSingleField = useCallback(
    (fieldName, value) => {
      return validateField(fieldName, value, validationSchema, values);
    },
    [validationSchema, values]
  );

  /**
   * Manejar cambio de valor en un campo
   */
  const handleChange = useCallback(
    (e) => {
      const { name, value, type, checked } = e.target;
      const newValue = type === "checkbox" ? checked : value;

      setValues((prev) => ({ ...prev, [name]: newValue }));

      // Validar si esta habilitado
      if (validateOnChange) {
        const error = validateField(name, newValue, validationSchema, {
          ...values,
          [name]: newValue,
        });
        setErrors((prev) => ({
          ...prev,
          [name]: error,
        }));
      }
    },
    [validateOnChange, validationSchema, values]
  );

  /**
   * Manejar blur (perder focus) en un campo
   */
  const handleBlur = useCallback(
    (e) => {
      const { name, value } = e.target;

      // Marcar como touched
      setTouched((prev) => ({ ...prev, [name]: true }));

      // Validar si esta habilitado
      if (validateOnBlur) {
        const error = validateSingleField(name, value);
        setErrors((prev) => ({
          ...prev,
          [name]: error,
        }));
      }
    },
    [validateOnBlur, validateSingleField]
  );

  /**
   * Establecer valor de un campo programaticamente
   */
  const setValue = useCallback(
    (name, value, shouldValidate = true) => {
      setValues((prev) => ({ ...prev, [name]: value }));

      if (shouldValidate) {
        const error = validateField(name, value, validationSchema, {
          ...values,
          [name]: value,
        });
        setErrors((prev) => ({ ...prev, [name]: error }));
      }
    },
    [validationSchema, values]
  );

  /**
   * Establecer multiples valores a la vez
   */
  const setMultipleValues = useCallback(
    (newValues, shouldValidate = true) => {
      setValues((prev) => ({ ...prev, ...newValues }));

      if (shouldValidate) {
        const newErrors = {};
        const allValues = { ...values, ...newValues };
        for (const [name, value] of Object.entries(newValues)) {
          const error = validateField(name, value, validationSchema, allValues);
          if (error) newErrors[name] = error;
        }
        setErrors((prev) => ({ ...prev, ...newErrors }));
      }
    },
    [validationSchema, values]
  );

  /**
   * Establecer error de un campo manualmente
   */
  const setError = useCallback((name, error) => {
    setErrors((prev) => ({ ...prev, [name]: error }));
  }, []);

  /**
   * Limpiar error de un campo
   */
  const clearError = useCallback((name) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[name];
      return newErrors;
    });
  }, []);

  /**
   * Marcar campo como touched
   */
  const setTouchedField = useCallback((name, isTouched = true) => {
    setTouched((prev) => ({ ...prev, [name]: isTouched }));
  }, []);

  /**
   * Validar todos los campos
   */
  const validate = useCallback(() => {
    const validationErrors = validateAll(values);
    setErrors(validationErrors);
    // Marcar todos como touched
    const allTouched = Object.keys(validationSchema).reduce(
      (acc, key) => ({ ...acc, [key]: true }),
      {}
    );
    setTouched(allTouched);
    return Object.keys(validationErrors).length === 0;
  }, [validateAll, values, validationSchema]);

  /**
   * Manejar submit del formulario
   */
  const handleSubmit = useCallback(
    async (e, submitHandler) => {
      if (e) e.preventDefault();

      setSubmitCount((prev) => prev + 1);
      setIsSubmitting(true);

      // Validar todos los campos
      const validationErrors = validateAll(values);
      setErrors(validationErrors);

      // Marcar todos como touched
      const allTouched = Object.keys(validationSchema).reduce(
        (acc, key) => ({ ...acc, [key]: true }),
        {}
      );
      setTouched(allTouched);

      const isValid = Object.keys(validationErrors).length === 0;

      if (isValid) {
        try {
          const handler = submitHandler || onSubmitCallback;
          if (handler) {
            await handler(values);
          }
        } catch (error) {
          console.error("Form submission error:", error);
        }
      }

      setIsSubmitting(false);
      return isValid;
    },
    [validateAll, values, validationSchema, onSubmitCallback]
  );

  /**
   * Resetear formulario a valores iniciales
   */
  const reset = useCallback(
    (newValues = initialValues) => {
      setValues(newValues);
      setErrors({});
      setTouched({});
      setIsSubmitting(false);
    },
    [initialValues]
  );

  /**
   * Verificar si el formulario es valido (sin errores)
   */
  const isValid = useMemo(() => {
    const currentErrors = validateAll(values);
    return Object.keys(currentErrors).length === 0;
  }, [validateAll, values]);

  /**
   * Verificar si el formulario ha sido modificado
   */
  const isDirty = useMemo(() => {
    return JSON.stringify(values) !== JSON.stringify(initialValues);
  }, [values, initialValues]);

  /**
   * Helper para obtener props de un campo Input
   * Devuelve un objeto con todas las props necesarias para conectar un Input
   */
  const getFieldProps = useCallback(
    (name) => ({
      name,
      value: values[name] || "",
      onChange: handleChange,
      onBlur: handleBlur,
      error: touched[name] && errors[name] ? true : false,
      errorMessage: touched[name] ? errors[name] : null,
    }),
    [values, errors, touched, handleChange, handleBlur]
  );

  /**
   * Helper para verificar si un campo tiene error visible
   */
  const hasError = useCallback(
    (name) => {
      return touched[name] && !!errors[name];
    },
    [touched, errors]
  );

  /**
   * Obtener mensaje de error de un campo
   */
  const getError = useCallback(
    (name) => {
      return touched[name] ? errors[name] : null;
    },
    [touched, errors]
  );

  return {
    // Estado
    values,
    errors,
    touched,
    isSubmitting,
    submitCount,
    isValid,
    isDirty,

    // Handlers
    handleChange,
    handleBlur,
    handleSubmit,

    // Setters
    setValue,
    setMultipleValues,
    setError,
    clearError,
    setTouchedField,

    // Utilities
    validate,
    reset,
    getFieldProps,
    hasError,
    getError,
  };
}

export default useFormValidation;
