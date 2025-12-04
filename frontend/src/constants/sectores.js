/**
 * Constantes y utilidades para manejo de sectores
 * Centralizadas para evitar duplicación y mantener consistencia
 */

export const SECTORES_MAP = {
  "1": "Almacenes",
  "2": "Compras",
  "3": "Mantenimiento",
  "4": "Planificacion",
};

/**
 * Renderiza el nombre legible de un sector
 * @param {Object|string|number} sectorVal - Objeto solicitud o valor de sector
 * @returns {string} Nombre legible del sector o "N/D"
 */
export function renderSector(sectorVal) {
  // Si es un objeto (solicitud), extraer sector
  if (typeof sectorVal === "object" && sectorVal !== null) {
    const val = (sectorVal.sector_nombre || sectorVal.sector || "").toString().trim();
    return SECTORES_MAP[val] || val || "N/D";
  }

  // Si es string o número directo
  const val = (sectorVal || "").toString().trim();
  return SECTORES_MAP[val] || val || "N/D";
}

/**
 * Obtiene el código de sector a partir del nombre
 * @param {string} nombreSector - Nombre del sector
 * @returns {string|null} Código del sector o null si no se encuentra
 */
export function getSectorCode(nombreSector) {
  const entries = Object.entries(SECTORES_MAP);
  const found = entries.find(([_, nombre]) =>
    nombre.toLowerCase() === nombreSector.toLowerCase()
  );
  return found ? found[0] : null;
}

/**
 * Obtiene todos los sectores disponibles
 * @returns {Array<{codigo: string, nombre: string}>}
 */
export function getAllSectores() {
  return Object.entries(SECTORES_MAP).map(([codigo, nombre]) => ({
    codigo,
    nombre,
  }));
}
