import React, { useCallback, useRef, useState } from "react";
import clsx from "clsx";
import {
  Upload,
  X,
  FileText,
  Image,
  File,
  FileSpreadsheet,
  FileCode,
  Film,
  Music,
  Archive,
} from "lucide-react";

/**
 * Obtiene el icono apropiado según el tipo MIME del archivo
 */
function getFileIcon(file) {
  const type = file.type || "";
  const name = file.name?.toLowerCase() || "";

  // Imágenes
  if (type.startsWith("image/")) {
    return <Image className="w-5 h-5 text-emerald-400" />;
  }

  // PDF
  if (type === "application/pdf" || name.endsWith(".pdf")) {
    return <FileText className="w-5 h-5 text-red-400" />;
  }

  // Excel
  if (
    type.includes("spreadsheet") ||
    type.includes("excel") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".csv")
  ) {
    return <FileSpreadsheet className="w-5 h-5 text-green-400" />;
  }

  // Word
  if (
    type.includes("word") ||
    type.includes("document") ||
    name.endsWith(".docx") ||
    name.endsWith(".doc")
  ) {
    return <FileText className="w-5 h-5 text-blue-400" />;
  }

  // Código
  if (
    type.includes("javascript") ||
    type.includes("json") ||
    type.includes("html") ||
    type.includes("css") ||
    name.endsWith(".js") ||
    name.endsWith(".ts") ||
    name.endsWith(".json")
  ) {
    return <FileCode className="w-5 h-5 text-yellow-400" />;
  }

  // Video
  if (type.startsWith("video/")) {
    return <Film className="w-5 h-5 text-purple-400" />;
  }

  // Audio
  if (type.startsWith("audio/")) {
    return <Music className="w-5 h-5 text-pink-400" />;
  }

  // Archivos comprimidos
  if (
    type.includes("zip") ||
    type.includes("rar") ||
    type.includes("7z") ||
    type.includes("tar") ||
    name.endsWith(".zip") ||
    name.endsWith(".rar")
  ) {
    return <Archive className="w-5 h-5 text-amber-400" />;
  }

  // Por defecto
  return <File className="w-5 h-5 text-[var(--fg-muted)]" />;
}

/**
 * Formatea el tamaño del archivo en unidades legibles
 */
function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * FileUploader - Componente de carga de archivos con drag & drop
 *
 * @param {Array} files - Array de archivos File
 * @param {function} onChange - Callback (files: File[]) => void
 * @param {number} maxFiles - Máximo de archivos permitidos (default: 5)
 * @param {number} maxSize - Tamaño máximo por archivo en bytes (default: 10MB)
 * @param {string} placeholder - Texto del área de drop
 * @param {boolean} disabled - Deshabilitar componente
 * @param {string} className - Clases adicionales
 */
export function FileUploader({
  files = [],
  onChange,
  maxFiles = 5,
  maxSize = 10 * 1024 * 1024, // 10MB default
  placeholder = "Arrastra archivos aquí o haz clic para seleccionar",
  disabled = false,
  className = "",
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const handleFiles = useCallback(
    (newFiles) => {
      setError("");

      // Convertir FileList a Array
      const fileArray = Array.from(newFiles);

      // Validar cantidad máxima
      if (files.length + fileArray.length > maxFiles) {
        setError(`Máximo ${maxFiles} archivos permitidos`);
        return;
      }

      // Validar tamaño de cada archivo
      const oversizedFiles = fileArray.filter((f) => f.size > maxSize);
      if (oversizedFiles.length > 0) {
        setError(
          `Algunos archivos exceden el límite de ${formatFileSize(maxSize)}`
        );
        return;
      }

      // Agregar archivos nuevos (evitar duplicados por nombre)
      const existingNames = new Set(files.map((f) => f.name));
      const uniqueNewFiles = fileArray.filter((f) => !existingNames.has(f.name));

      if (uniqueNewFiles.length > 0) {
        onChange?.([...files, ...uniqueNewFiles]);
      }
    },
    [files, onChange, maxFiles, maxSize]
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled) return;

      const droppedFiles = e.dataTransfer?.files;
      if (droppedFiles?.length > 0) {
        handleFiles(droppedFiles);
      }
    },
    [disabled, handleFiles]
  );

  const handleInputChange = useCallback(
    (e) => {
      const selectedFiles = e.target.files;
      if (selectedFiles?.length > 0) {
        handleFiles(selectedFiles);
      }
      // Reset input para permitir seleccionar el mismo archivo de nuevo
      e.target.value = "";
    },
    [handleFiles]
  );

  const handleRemoveFile = useCallback(
    (index) => {
      const newFiles = files.filter((_, i) => i !== index);
      onChange?.(newFiles);
      setError("");
    },
    [files, onChange]
  );

  const handleClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  const canAddMore = files.length < maxFiles;

  return (
    <div className={clsx("space-y-3", className)}>
      {/* Drop Zone */}
      {canAddMore && (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleClick();
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={clsx(
            "relative flex flex-col items-center justify-center",
            "px-6 py-8 rounded-xl",
            "border-2 border-dashed",
            "transition-all duration-200",
            "cursor-pointer",
            "focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 focus:ring-offset-[var(--bg)]",
            disabled && "opacity-50 cursor-not-allowed",
            isDragOver
              ? "border-[var(--primary)] bg-[var(--primary-muted)]"
              : "border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--primary-muted)]/50"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            onChange={handleInputChange}
            disabled={disabled}
            className="sr-only"
            aria-label="Seleccionar archivos"
          />

          <Upload
            className={clsx(
              "w-8 h-8 mb-3 transition-colors",
              isDragOver ? "text-[var(--primary)]" : "text-[var(--fg-muted)]"
            )}
          />

          <p
            className={clsx(
              "text-sm font-medium text-center transition-colors",
              isDragOver ? "text-[var(--primary)]" : "text-[var(--fg-muted)]"
            )}
          >
            {placeholder}
          </p>

          <p className="text-xs text-[var(--fg-subtle)] mt-1.5">
            Máximo {maxFiles} archivos · {formatFileSize(maxSize)} por archivo
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-sm text-[var(--danger)] flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--danger)]" />
          {error}
        </p>
      )}

      {/* File List */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className={clsx(
                "flex items-center gap-3 px-4 py-3",
                "bg-[var(--surface)] rounded-lg",
                "border border-[var(--border)]",
                "animate-scale-in"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Icon */}
              <span className="flex-shrink-0">{getFileIcon(file)}</span>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--fg)] truncate">
                  {file.name}
                </p>
                <p className="text-xs text-[var(--fg-subtle)]">
                  {formatFileSize(file.size)}
                </p>
              </div>

              {/* Remove Button */}
              <button
                type="button"
                onClick={() => handleRemoveFile(index)}
                disabled={disabled}
                className={clsx(
                  "flex-shrink-0 p-1.5 rounded-md",
                  "text-[var(--fg-muted)] hover:text-[var(--danger)]",
                  "hover:bg-[var(--danger)]/10",
                  "transition-colors duration-150",
                  "focus:outline-none focus:ring-2 focus:ring-[var(--danger)]/50",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
                aria-label={`Eliminar ${file.name}`}
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Max files reached message */}
      {!canAddMore && (
        <p className="text-xs text-[var(--fg-subtle)] text-center py-2">
          Has alcanzado el límite de {maxFiles} archivos
        </p>
      )}
    </div>
  );
}

FileUploader.displayName = "FileUploader";
export default FileUploader;
