"""
Validador de Excel para importación de datos temporales MRP/Forecast.

Valida estructura, tipos de datos y consistencia del archivo Excel
antes de permitir la importación.
"""

import logging
from dataclasses import dataclass, field
from io import BytesIO
from typing import List, Optional, Tuple

import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """Resultado de validación del Excel."""

    valid: bool = True
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    # DataFrames parseados (si válido)
    stock_df: Optional[pd.DataFrame] = None
    consumo_df: Optional[pd.DataFrame] = None
    parametros_mrp_df: Optional[pd.DataFrame] = None

    # Resumen
    materiales_count: int = 0
    registros_stock: int = 0
    registros_consumo: int = 0

    def add_error(self, msg: str):
        """Agrega un error y marca como inválido."""
        self.errors.append(msg)
        self.valid = False

    def add_warning(self, msg: str):
        """Agrega una advertencia (no invalida)."""
        self.warnings.append(msg)

    def to_dict(self) -> dict:
        """Convierte a diccionario para respuesta API."""
        return {
            "valid": self.valid,
            "errors": self.errors,
            "warnings": self.warnings,
            "resumen": {
                "materiales": self.materiales_count,
                "registros_stock": self.registros_stock,
                "registros_consumo": self.registros_consumo
            }
        }


class ExcelValidator:
    """Validador de archivos Excel para importación MRP/Forecast."""

    # Configuración
    MAX_FILE_SIZE_MB = 50
    ALLOWED_EXTENSIONS = {".xlsx", ".xls"}

    # Hojas requeridas
    REQUIRED_SHEETS = ["stock", "consumo_historico"]
    OPTIONAL_SHEETS = ["parametros_mrp"]

    # Columnas requeridas por hoja
    STOCK_REQUIRED_COLS = ["material", "descripcion", "centro", "almacen", "stock", "um"]
    STOCK_OPTIONAL_COLS = ["precio_usd", "grupo_articulos", "ubicacion", "critico"]

    CONSUMO_REQUIRED_COLS = ["material", "fecha", "cantidad"]
    CONSUMO_OPTIONAL_COLS = ["centro"]

    MRP_COLS = ["material", "stock_seguridad", "punto_pedido", "stock_maximo", "lead_time_dias"]

    def validate_file(self, file_storage, filename: str) -> ValidationResult:
        """
        Valida un archivo Excel completo.

        Args:
            file_storage: FileStorage de Flask
            filename: Nombre del archivo

        Returns:
            ValidationResult con errores/warnings y DataFrames parseados
        """
        result = ValidationResult()

        # 1. Validar extensión
        ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext not in self.ALLOWED_EXTENSIONS:
            result.add_error(f"Formato no soportado: {ext}. Use .xlsx o .xls")
            return result

        # 2. Validar tamaño
        file_storage.seek(0, 2)  # Ir al final
        size_mb = file_storage.tell() / (1024 * 1024)
        file_storage.seek(0)  # Volver al inicio

        if size_mb > self.MAX_FILE_SIZE_MB:
            result.add_error(f"Archivo muy grande: {size_mb:.1f}MB. Máximo: {self.MAX_FILE_SIZE_MB}MB")
            return result

        # 3. Intentar leer el Excel
        try:
            file_bytes = BytesIO(file_storage.read())
            file_storage.seek(0)

            excel = pd.ExcelFile(file_bytes)
            sheet_names = [s.lower() for s in excel.sheet_names]

        except Exception as e:
            result.add_error(f"Error al leer el archivo Excel: {str(e)}")
            return result

        # 4. Validar hojas requeridas
        for sheet in self.REQUIRED_SHEETS:
            if sheet not in sheet_names:
                result.add_error(f"Hoja requerida '{sheet}' no encontrada")

        if not result.valid:
            return result

        # 5. Validar y parsear hoja 'stock'
        stock_df, stock_errors, stock_warnings = self._validate_stock_sheet(excel)
        for err in stock_errors:
            result.add_error(err)
        for warn in stock_warnings:
            result.add_warning(warn)

        if stock_df is not None:
            result.stock_df = stock_df
            result.registros_stock = len(stock_df)

        # 6. Validar y parsear hoja 'consumo_historico'
        consumo_df, consumo_errors, consumo_warnings = self._validate_consumo_sheet(excel)
        for err in consumo_errors:
            result.add_error(err)
        for warn in consumo_warnings:
            result.add_warning(warn)

        if consumo_df is not None:
            result.consumo_df = consumo_df
            result.registros_consumo = len(consumo_df)

        # 7. Validar hoja opcional 'parametros_mrp'
        if "parametros_mrp" in sheet_names:
            mrp_df, mrp_errors, mrp_warnings = self._validate_mrp_sheet(excel)
            for err in mrp_errors:
                result.add_error(err)
            for warn in mrp_warnings:
                result.add_warning(warn)
            result.parametros_mrp_df = mrp_df
        else:
            result.add_warning("Hoja 'parametros_mrp' no incluida. Se calcularán automáticamente.")

        # 8. Validaciones cruzadas
        if result.valid and result.stock_df is not None:
            result.materiales_count = result.stock_df["material"].nunique()

            # Verificar consistencia entre hojas
            cross_errors, cross_warnings = self._validate_cross_sheet(
                result.stock_df, result.consumo_df
            )
            for err in cross_errors:
                result.add_error(err)
            for warn in cross_warnings:
                result.add_warning(warn)

        return result

    def _validate_stock_sheet(self, excel: pd.ExcelFile) -> Tuple[Optional[pd.DataFrame], List[str], List[str]]:
        """Valida la hoja de stock."""
        errors = []
        warnings = []

        try:
            # Leer hoja (case-insensitive)
            sheet_name = self._find_sheet_name(excel, "stock")
            df = pd.read_excel(excel, sheet_name=sheet_name)

            # Normalizar nombres de columnas
            df.columns = [c.lower().strip() for c in df.columns]

            # Verificar columnas requeridas
            missing_cols = set(self.STOCK_REQUIRED_COLS) - set(df.columns)
            if missing_cols:
                errors.append(f"Hoja 'stock': Columnas faltantes: {', '.join(missing_cols)}")
                return None, errors, warnings

            # Verificar que hay datos
            if len(df) == 0:
                errors.append("Hoja 'stock': No hay registros")
                return None, errors, warnings

            # Verificar tipos de datos
            df_clean = df.copy()

            # Material y descripción deben ser texto no vacío
            df_clean["material"] = df_clean["material"].astype(str).str.strip()
            empty_materials = df_clean["material"].isin(["", "nan", "None"]).sum()
            if empty_materials > 0:
                errors.append(f"Hoja 'stock': {empty_materials} filas sin código de material")

            # Stock debe ser numérico
            df_clean["stock"] = pd.to_numeric(df_clean["stock"], errors="coerce")
            invalid_stock = df_clean["stock"].isna().sum()
            if invalid_stock > 0:
                warnings.append(f"Hoja 'stock': {invalid_stock} valores de stock inválidos (se usará 0)")
                df_clean["stock"] = df_clean["stock"].fillna(0)

            # Stock negativo
            negative_stock = (df_clean["stock"] < 0).sum()
            if negative_stock > 0:
                warnings.append(f"Hoja 'stock': {negative_stock} registros con stock negativo")

            # Verificar duplicados
            duplicates = df_clean.duplicated(subset=["material", "centro", "almacen"], keep=False).sum()
            if duplicates > 0:
                warnings.append(f"Hoja 'stock': {duplicates} registros duplicados (material+centro+almacen)")

            return df_clean, errors, warnings

        except Exception as e:
            errors.append(f"Error procesando hoja 'stock': {str(e)}")
            return None, errors, warnings

    def _validate_consumo_sheet(self, excel: pd.ExcelFile) -> Tuple[Optional[pd.DataFrame], List[str], List[str]]:
        """Valida la hoja de consumo histórico."""
        errors = []
        warnings = []

        try:
            sheet_name = self._find_sheet_name(excel, "consumo_historico")
            df = pd.read_excel(excel, sheet_name=sheet_name)

            df.columns = [c.lower().strip() for c in df.columns]

            # Verificar columnas requeridas
            missing_cols = set(self.CONSUMO_REQUIRED_COLS) - set(df.columns)
            if missing_cols:
                errors.append(f"Hoja 'consumo_historico': Columnas faltantes: {', '.join(missing_cols)}")
                return None, errors, warnings

            if len(df) == 0:
                errors.append("Hoja 'consumo_historico': No hay registros")
                return None, errors, warnings

            df_clean = df.copy()

            # Material debe ser texto
            df_clean["material"] = df_clean["material"].astype(str).str.strip()

            # Fecha debe ser válida
            df_clean["fecha"] = pd.to_datetime(df_clean["fecha"], errors="coerce")
            invalid_dates = df_clean["fecha"].isna().sum()
            if invalid_dates > 0:
                warnings.append(f"Hoja 'consumo_historico': {invalid_dates} fechas inválidas (serán ignoradas)")

            # Cantidad debe ser numérica
            df_clean["cantidad"] = pd.to_numeric(df_clean["cantidad"], errors="coerce")
            invalid_qty = df_clean["cantidad"].isna().sum()
            if invalid_qty > 0:
                warnings.append(f"Hoja 'consumo_historico': {invalid_qty} cantidades inválidas (se usará 0)")
                df_clean["cantidad"] = df_clean["cantidad"].fillna(0)

            # Verificar rango de fechas
            valid_dates = df_clean["fecha"].dropna()
            if len(valid_dates) > 0:
                fecha_min = valid_dates.min()
                fecha_max = valid_dates.max()
                dias_historico = (fecha_max - fecha_min).days

                if dias_historico < 30:
                    warnings.append(
                        f"Histórico muy corto: {dias_historico} días. "
                        "Se recomienda mínimo 90 días para forecast confiable."
                    )

            # Verificar distribución por material
            registros_por_material = df_clean.groupby("material").size()
            materiales_poco_historico = (registros_por_material < 5).sum()
            if materiales_poco_historico > 0:
                warnings.append(
                    f"{materiales_poco_historico} materiales con menos de 5 registros de consumo"
                )

            return df_clean, errors, warnings

        except Exception as e:
            errors.append(f"Error procesando hoja 'consumo_historico': {str(e)}")
            return None, errors, warnings

    def _validate_mrp_sheet(self, excel: pd.ExcelFile) -> Tuple[Optional[pd.DataFrame], List[str], List[str]]:
        """Valida la hoja opcional de parámetros MRP."""
        errors = []
        warnings = []

        try:
            sheet_name = self._find_sheet_name(excel, "parametros_mrp")
            df = pd.read_excel(excel, sheet_name=sheet_name)

            df.columns = [c.lower().strip() for c in df.columns]

            # Material es requerido
            if "material" not in df.columns:
                errors.append("Hoja 'parametros_mrp': Columna 'material' requerida")
                return None, errors, warnings

            df_clean = df.copy()
            df_clean["material"] = df_clean["material"].astype(str).str.strip()

            # Convertir columnas numéricas
            numeric_cols = ["stock_seguridad", "punto_pedido", "stock_maximo", "lead_time_dias"]
            for col in numeric_cols:
                if col in df_clean.columns:
                    df_clean[col] = pd.to_numeric(df_clean[col], errors="coerce")

            return df_clean, errors, warnings

        except Exception as e:
            warnings.append(f"Error procesando hoja 'parametros_mrp': {str(e)} (se ignorará)")
            return None, errors, warnings

    def _validate_cross_sheet(
        self,
        stock_df: pd.DataFrame,
        consumo_df: pd.DataFrame
    ) -> Tuple[List[str], List[str]]:
        """Validaciones cruzadas entre hojas."""
        errors = []
        warnings = []

        materiales_stock = set(stock_df["material"].unique())
        materiales_consumo = set(consumo_df["material"].dropna().unique())

        # Materiales en consumo que no están en stock
        sin_stock = materiales_consumo - materiales_stock
        if sin_stock:
            warnings.append(
                f"{len(sin_stock)} materiales en consumo no existen en stock "
                f"(ejemplo: {list(sin_stock)[:3]})"
            )

        # Materiales sin consumo histórico
        sin_consumo = materiales_stock - materiales_consumo
        if sin_consumo:
            pct = len(sin_consumo) / len(materiales_stock) * 100
            warnings.append(
                f"{len(sin_consumo)} materiales ({pct:.0f}%) sin consumo histórico. "
                "Forecast limitado para estos materiales."
            )

        return errors, warnings

    def _find_sheet_name(self, excel: pd.ExcelFile, target: str) -> str:
        """Encuentra el nombre real de la hoja (case-insensitive)."""
        for name in excel.sheet_names:
            if name.lower() == target.lower():
                return name
        return target


# Instancia singleton
excel_validator = ExcelValidator()
