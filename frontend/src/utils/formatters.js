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

  const cols = headers || Object.keys(data[0]);

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

  const headers = Object.keys(data[0]);

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
 * Exports table to PDF using browser print dialog
 * Creates a styled HTML table and opens print dialog for PDF export
 * @param {Array} data - Array of objects to export
 * @param {string} filename - Name of the file (used in title)
 * @param {string} title - Title for the PDF
 * @param {Object} options - Additional options
 * @param {Array} options.columns - Custom column definitions [{key, header, width}]
 * @param {string} options.subtitle - Subtitle to display
 */
export function exportToPDF(data, filename = "export.pdf", title = "Reporte", options = {}) {
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return;
  }

  const { columns, subtitle } = options;
  const headers = columns
    ? columns.map(c => c.header || c.key)
    : Object.keys(data[0]);
  const keys = columns
    ? columns.map(c => c.key)
    : Object.keys(data[0]);

  // Create print window
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor permite ventanas emergentes para exportar a PDF');
    return;
  }

  // Generate table HTML
  const tableRows = data.map(row => {
    const cells = keys.map(key => {
      const val = row[key];
      return `<td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${val ?? ''}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const headerCells = headers.map(h =>
    `<th style="border: 1px solid #ddd; padding: 8px; background: #4a90d9; color: white; text-align: left;">${h}</th>`
  ).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        @media print {
          @page { margin: 1cm; size: landscape; }
        }
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          color: #333;
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid #4a90d9;
        }
        .header h1 {
          margin: 0;
          color: #2c5282;
          font-size: 24px;
        }
        .header .subtitle {
          color: #666;
          font-size: 14px;
          margin-top: 5px;
        }
        .header .date {
          color: #888;
          font-size: 12px;
          margin-top: 5px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          font-size: 11px;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 6px 8px;
          text-align: left;
        }
        th {
          background: #4a90d9;
          color: white;
          font-weight: bold;
        }
        tr:nth-child(even) { background: #f9f9f9; }
        tr:hover { background: #f0f7ff; }
        .footer {
          margin-top: 20px;
          text-align: center;
          font-size: 10px;
          color: #888;
        }
        .stats {
          margin-top: 10px;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${title}</h1>
        ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
        <div class="date">Generado: ${new Date().toLocaleString('es-ES')}</div>
      </div>
      <div class="stats">Total de registros: ${data.length}</div>
      <table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      <div class="footer">
        SPM System - ${new Date().getFullYear()}
      </div>
      <script>
        window.onload = function() {
          window.print();
          setTimeout(() => window.close(), 500);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
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
