import React from 'react';
import { Search, Filter, RotateCcw } from 'lucide-react';
import { PropertyStatus, PropertyType } from '../../types/property';
import { PropertyFilterParams } from '../../services/propertyService';

interface PropertyFiltersProps {
  filters: PropertyFilterParams;
  onChange: (updated: PropertyFilterParams) => void;
  onReset: () => void;
}

export const PropertyFilters: React.FC<PropertyFiltersProps> = ({
  filters,
  onChange,
  onReset,
}) => {
  return (
    <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
      {/* Busca Textual */}
      <div className="relative flex-1">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={filters.city || ''}
          onChange={(e) => onChange({ ...filters, city: e.target.value })}
          placeholder="Buscar por cidade ou região..."
          className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200/90 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
        />
      </div>

      {/* Filtros em Dropdown */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
        <select
          value={filters.property_type || ''}
          onChange={(e) =>
            onChange({
              ...filters,
              property_type: (e.target.value as PropertyType) || undefined,
            })
          }
          className="bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-semibold rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          <option value="">Todos os Tipos</option>
          <option value="apartment">Apartamento</option>
          <option value="house">Casa</option>
          <option value="studio">Studio</option>
          <option value="chalet">Chalé</option>
          <option value="farm">Sítio</option>
        </select>

        <select
          value={filters.status || ''}
          onChange={(e) =>
            onChange({
              ...filters,
              status: (e.target.value as PropertyStatus) || undefined,
            })
          }
          className="bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-semibold rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          <option value="">Todos os Status</option>
          <option value="active">Ativo</option>
          <option value="under_maintenance">Em Manutenção</option>
          <option value="inactive">Inativo</option>
        </select>

        <select
          value={filters.min_guests || ''}
          onChange={(e) =>
            onChange({
              ...filters,
              min_guests: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          className="bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-semibold rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          <option value="">Capacidade</option>
          <option value="2">2+ Hóspedes</option>
          <option value="4">4+ Hóspedes</option>
          <option value="6">6+ Hóspedes</option>
          <option value="8">8+ Hóspedes</option>
        </select>

        <button
          onClick={onReset}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Limpar filtros"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
