/**
 * Utility functions for formatting values across the application
 */

/**
 * Converts a value to a number safely
 * @param {any} val - Value to convert
 * @returns {number} - The numeric value or 0 if invalid
 */
export function toNumber(val) {
  const num = Number(val);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Formats a number as currency in the format: USD 300.090,00
 * Uses period as thousands separator and comma as decimal separator
 * Examples: USD 300.090,00 | USD 10.010.120,14 | USD 2.146.210,87
 * @param {number|string} val - The value to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} - Formatted currency string
 */
export function formatCurrency(val, decimals = 2) {
  const num = toNumber(val);

  // Format with Spanish locale (period for thousands, comma for decimals)
  const formatted = num.toLocaleString("es-ES", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return `USD ${formatted}`;
}

/**
 * Formats a number with thousands separators (Spanish format)
 * @param {number|string} val - The value to format
 * @returns {string} - Formatted number string
 */
export function formatNumber(val) {
  const num = toNumber(val);
  return num.toLocaleString("es-ES");
}

/**
 * Formats a date in DD/MM/YY format
 * @param {string|Date} val - The date value
 * @returns {string} - Formatted date string or "N/D" if invalid
 */
export function formatDate(val) {
  if (!val) return "N/D";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "N/D";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

/**
 * Formats a date in full format DD/MM/YYYY
 * @param {string|Date} val - The date value
 * @returns {string} - Formatted date string or "N/D" if invalid
 */
export function formatDateFull(val) {
  if (!val) return "N/D";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "N/D";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Formats a date with time in DD/MM/YY HH:MM format
 * @param {string|Date} val - The date value
 * @returns {string} - Formatted datetime string or "N/D" if invalid
 */
export function formatDateTime(val) {
  if (!val) return "N/D";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "N/D";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${min}`;
}

/**
 * Exports data to CSV format (for Excel)
 * @param {Array} data - Array of objects to export
 * @param {string} filename - Name of the file to download
 * @param {Array} headers - Optional array of column headers
 */
export function exportToCSV(data, filename = "export.csv", headers = null) {
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return;
  }

  // Get headers from first object if not provided
  const cols = headers || Object.keys(data[0]);

  // Build CSV content
  let csv = cols.join(",") + "\n";

  data.forEach(row => {
    const values = cols.map(col => {
      const val = row[col];
      // Escape commas and quotes
      const escaped = String(val ?? "").replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csv += values.join(",") + "\n";
  });

  // Create blob and download
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exports data to Excel format (XLS)
 * Creates a proper XLS file compatible with Excel with aligned columns
 * @param {Array} data - Array of objects to export
 * @param {string} filename - Name of the file to download
 */
export function exportToExcel(data, filename = "export.xls") {
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);

  // Create worksheet data
  const wsData = [
    headers, // Header row
    ...data.map(row => headers.map(header => String(row[header] ?? "")))
  ];

  // Calculate max width for each column
  const columnWidths = headers.map((header, idx) => {
    const maxContentWidth = Math.max(
      ...wsData.map(row => String(row[idx] ?? "").length)
    );
    return Math.max(maxContentWidth, String(header).length);
  });

  // Create aligned rows with padding
  const alignedRows = wsData.map(row => {
    return row.map((cell, idx) => {
      const cellValue = String(cell ?? "");
      const width = columnWidths[idx];
      // Pad with spaces to align columns
      return cellValue.padEnd(width, " ");
    }).join("    "); // 4 spaces between columns
  });

  const xls = alignedRows.join("\n");

  // Create blob with Excel 97-2003 MIME type
  const blob = new Blob(["\ufeff" + xls], {
    type: "application/vnd.ms-excel;charset=utf-8;"
  });

  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports table to PDF
 * Note: Requires jsPDF library. For now, provides basic implementation
 * @param {Array} data - Array of objects to export
 * @param {string} filename - Name of the file to download
 * @param {string} title - Title for the PDF
 */
export function exportToPDF(data, filename = "export.pdf", title = "Reporte") {
  // Basic implementation - prints a formatted version
  // TODO: Implement proper PDF generation with jsPDF
  console.log("PDF export not yet implemented. Use CSV export instead.");
  exportToCSV(data, filename.replace(".pdf", ".csv"));
}

/**
 * Mapeo estático de IDs de sector a nombres
 */
const SECTOR_MAP = {
  "1": "Almacenes",
  "2": "Compras",
  "3": "Mantenimiento",
  "4": "Planificación",
  "5": "Operaciones",
  "6": "Logística",
  "7": "Producción",
  "8": "Calidad",
};

/**
 * Formatea un código de almacén a 4 dígitos con ceros a la izquierda
 * Ejemplos: 1 -> "0001", 100 -> "0100", 9999 -> "9999"
 * @param {string|number} almacen - Código del almacén
 * @returns {string} - Código formateado a 4 dígitos
 */
export function formatAlmacen(almacen) {
  if (almacen === null || almacen === undefined || almacen === '') return '-';
  const num = String(almacen).replace(/\D/g, ''); // Remove non-digits
  if (!num) return '-';
  return num.padStart(4, '0');
}

/**
 * Obtiene el nombre del sector a partir de su ID o nombre
 * @param {string|number} sectorId - ID o nombre del sector
 * @param {Array} sectoresFromBackend - Lista opcional de sectores del backend
 * @returns {string} - Nombre del sector o el valor original si no se encuentra
 */
export function getSectorNombre(sectorId, sectoresFromBackend = []) {
  if (!sectorId) return "-";

  const sectorStr = String(sectorId);

  // Si ya es un nombre (más de 2 caracteres), retornarlo
  if (sectorStr.length > 2) return sectorId;

  // Buscar en sectores del backend si se proporcionan
  if (sectoresFromBackend.length > 0) {
    const sector = sectoresFromBackend.find(
      (s) => String(s.id) === sectorStr || s.nombre === sectorId
    );
    if (sector) return sector.nombre;
  }

  // Fallback al mapeo estático
  return SECTOR_MAP[sectorStr] || sectorId;
}
