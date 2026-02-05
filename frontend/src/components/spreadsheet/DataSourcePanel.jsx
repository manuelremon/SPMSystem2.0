/**
 * DataSourcePanel - Panel lateral para gestionar fuentes de datos SPM
 */

import { useState } from 'react';
import { useI18n } from '../../context/i18n';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import * as Icons from '../ui/Icons';

const PlusIcon = Icons.Plus || (() => <span>+</span>);
const TrashIcon = Icons.Trash2 || (() => <span>🗑️</span>);
const RefreshIcon = Icons.RefreshCw || (() => <span>🔄</span>);
const DatabaseIcon = Icons.Database || (() => <span>🗄️</span>);
const ChartIcon = Icons.BarChart2 || (() => <span>📊</span>);

const DATA_SOURCE_TYPES = [
  { value: 'stock', label: 'Stock/Inventario', icon: '📦', color: 'bg-green-100 text-green-700' },
  { value: 'budget', label: 'Presupuesto', icon: '💰', color: 'bg-blue-100 text-blue-700' },
  { value: 'solicitudes', label: 'Solicitudes', icon: '📝', color: 'bg-purple-100 text-purple-700' },
  { value: 'forecast', label: 'Forecast', icon: '📈', color: 'bg-orange-100 text-orange-700' },
  { value: 'mrp', label: 'MRP/Alertas', icon: '⚠️', color: 'bg-red-100 text-red-700' },
];

export default function DataSourcePanel({
  datasources = [],
  onAdd,
  onRemove,
  onRefresh,
  isCollapsed = false,
  onToggleCollapse,
}) {
  const { t } = useI18n();
  const [isAdding, setIsAdding] = useState(false);
  const [newDs, setNewDs] = useState({
    nombre: '',
    tipo: 'stock',
    filtros: {},
  });

  const handleAdd = async () => {
    if (!newDs.nombre.trim()) return;

    await onAdd({
      nombre: newDs.nombre,
      tipo: newDs.tipo,
      filtros: newDs.filtros,
    });

    setNewDs({ nombre: '', tipo: 'stock', filtros: {} });
    setIsAdding(false);
  };

  const getTypeInfo = (tipo) => {
    return DATA_SOURCE_TYPES.find((t) => t.value === tipo) || DATA_SOURCE_TYPES[0];
  };

  if (isCollapsed) {
    return (
      <div
        className="w-12 bg-gray-50 border-l border-gray-200 flex flex-col items-center py-4 cursor-pointer hover:bg-gray-100"
        onClick={onToggleCollapse}
        title={t('dashboard_datasources', 'Fuentes de datos')}
      >
        <DatabaseIcon className="w-5 h-5 text-gray-500" />
        <span className="text-xs text-gray-500 mt-1 writing-mode-vertical">
          {datasources.length}
        </span>
      </div>
    );
  }

  return (
    <div className="w-64 bg-gray-50 border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-medium text-gray-700 flex items-center gap-2">
          <DatabaseIcon className="w-4 h-4" />
          {t('dashboard_datasources', 'Fuentes de datos')}
        </h3>
        <button
          onClick={onToggleCollapse}
          className="text-gray-400 hover:text-gray-600"
        >
          →
        </button>
      </div>

      {/* Lista de datasources */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {datasources.length === 0 && !isAdding && (
          <div className="text-center text-gray-500 text-sm py-8">
            <ChartIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>{t('dashboard_no_datasources', 'Sin fuentes de datos')}</p>
            <p className="text-xs mt-1">
              {t('dashboard_add_datasource_hint', 'Agrega una para usar formulas SPM')}
            </p>
          </div>
        )}

        {datasources.map((ds) => {
          const typeInfo = getTypeInfo(ds.tipo);
          return (
            <div
              key={ds.id}
              className="bg-white rounded-lg border border-gray-200 p-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-sm text-gray-800">{ds.nombre}</div>
                  <div className={`text-xs mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded ${typeInfo.color}`}>
                    <span>{typeInfo.icon}</span>
                    {typeInfo.label}
                  </div>
                </div>
                <div className="flex gap-1">
                  {onRefresh && (
                    <button
                      onClick={() => onRefresh(ds.id)}
                      className="p-1 rounded hover:bg-gray-100"
                      title={t('common_refresh', 'Actualizar')}
                    >
                      <RefreshIcon className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                  )}
                  <button
                    onClick={() => onRemove(ds.id)}
                    className="p-1 rounded hover:bg-red-50"
                    title={t('common_delete', 'Eliminar')}
                  >
                    <TrashIcon className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              </div>

              {ds.ultimo_refresh && (
                <div className="text-xs text-gray-400 mt-2">
                  {t('dashboard_last_refresh', 'Actualizado')}: {new Date(ds.ultimo_refresh).toLocaleString()}
                </div>
              )}
            </div>
          );
        })}

        {/* Formulario para agregar */}
        {isAdding && (
          <div className="bg-white rounded-lg border-2 border-indigo-200 p-3 space-y-3">
            <Input
              placeholder={t('dashboard_datasource_name', 'Nombre de la fuente')}
              value={newDs.nombre}
              onChange={(e) => setNewDs({ ...newDs, nombre: e.target.value })}
              autoFocus
            />

            <Select
              value={newDs.tipo}
              onChange={(e) => setNewDs({ ...newDs, tipo: e.target.value })}
              options={DATA_SOURCE_TYPES.map((t) => ({
                value: t.value,
                label: `${t.icon} ${t.label}`,
              }))}
            />

            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleAdd}
                disabled={!newDs.nombre.trim()}
                className="flex-1"
              >
                {t('common_add', 'Agregar')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAdding(false)}
              >
                {t('common_cancel', 'Cancelar')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Boton agregar */}
      {!isAdding && (
        <div className="p-3 border-t border-gray-200">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
            className="w-full"
          >
            <PlusIcon className="w-4 h-4 mr-1" />
            {t('dashboard_add_datasource', 'Agregar fuente')}
          </Button>
        </div>
      )}

      {/* Ayuda de formulas */}
      <div className="p-3 border-t border-gray-200 bg-indigo-50">
        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-indigo-700">
            {t('dashboard_formula_help', 'Formulas SPM disponibles')}
          </summary>
          <div className="mt-2 space-y-1 text-gray-600">
            <code className="block">=SPM.STOCK("MAT001", "1000", "stock_actual")</code>
            <code className="block">=SPM.BUDGET("1000", "MTTO", "saldo_usd")</code>
            <code className="block">=SPM.SOLICITUDES.COUNT("aprobada", "1000")</code>
            <code className="block">=SPM.FORECAST("MAT001", 30, "arima")</code>
            <code className="block">=SPM.MRP.ALERTAS("1000", "alta")</code>
          </div>
        </details>
      </div>
    </div>
  );
}
