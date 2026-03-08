/**
 * Maps backend English error messages to i18n keys.
 * Used by the API interceptor to translate error responses.
 */
const ERROR_MAP = {
  // Auth errors
  'Missing token': 'error_missing_token',
  'Token is missing': 'error_missing_token',
  'Invalid token': 'error_invalid_token',
  'Token has expired': 'error_invalid_token',
  'Invalid or expired token': 'error_invalid_token',
  'Invalid credentials': 'error_invalid_credentials',
  'Authentication required': 'error_auth_required',
  'Admin access required': 'error_admin_required',
  'Unauthorized': 'error_auth_required',

  // Rate limiting
  'Too many requests': 'error_too_many_requests',
  'Rate limit exceeded': 'error_too_many_requests',

  // Validation
  'Invalid JSON': 'error_invalid_json',
  'Invalid JSON body': 'error_invalid_json',

  // Server errors
  'Internal server error': 'error_internal',
  'Internal Server Error': 'error_internal',

  // Access
  'Access denied': 'error_access_denied',
  'Forbidden': 'error_access_denied',
  'Permission denied': 'error_access_denied',
};

/**
 * Translates a backend error message using the i18n system.
 * Works outside of React components via getTranslation (reads lang from localStorage).
 *
 * @param {string} message - The error message from the backend
 * @param {Function} [t] - Optional i18n translation function. Falls back to getTranslation.
 * @returns {string} The translated message, or the original if no mapping exists
 */
export function translateError(message, t) {
  if (!message || typeof message !== 'string') return message;

  // Use provided t function or fall back to non-React getTranslation
  const translate = t || _getTranslateFn();
  if (!translate) return message;

  // Try exact match first
  const key = ERROR_MAP[message];
  if (key) {
    return translate(key, message);
  }

  // Try partial match (case-insensitive)
  const lowerMessage = message.toLowerCase();
  for (const [pattern, errorKey] of Object.entries(ERROR_MAP)) {
    if (lowerMessage.includes(pattern.toLowerCase())) {
      return translate(errorKey, message);
    }
  }

  return message;
}

/**
 * Lazily imports getTranslation to avoid circular dependencies.
 * Returns null if not available.
 */
function _getTranslateFn() {
  try {
    // getTranslation reads lang from localStorage, no React needed
    // We use a dynamic require pattern via the module cache
    return _cachedGetTranslation;
  } catch {
    return null;
  }
}

// Cache the getTranslation import
let _cachedGetTranslation = null;

/**
 * Initialize the error translation module with the getTranslation function.
 * Called once at app startup to avoid circular imports.
 *
 * @param {Function} getTranslationFn - The getTranslation function from i18n.jsx
 */
export function initErrorTranslation(getTranslationFn) {
  _cachedGetTranslation = getTranslationFn;
}

export { ERROR_MAP };
