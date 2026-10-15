import React from 'react';
import {
  Building2,
  Users,
  Bed,
  Bath,
  Home,
  MapPin,
  Sparkles,
  Edit2,
  Trash2,
  Eye,
  Check,
} from 'lucide-react';
import { Property, PropertyType } from '../../types/property';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';

interface PropertyCardProps {
  property: Property;
  onView: (property: Property) => void;
  onEdit?: (property: Property) => void;
  onDelete?: (property: Property) => void;
}

const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: 'Apartamento',
  house: 'Casa',
  studio: 'Studio',
  room: 'Quarto',
  chalet: 'Chalé',
  farm: 'Sítio / Chácara',
  other: 'Outro',
};

// Paleta de gradientes modernos para capas de imóveis
const GRADIENTS = [
  'from-indigo-600 via-brand-600 to-purple-700',
  'from-teal-600 via-emerald-600 to-cyan-700',
  'from-amber-600 via-orange-600 to-rose-700',
  'from-blue-600 via-indigo-600 to-slate-800',
];

export const PropertyCard: React.FC<PropertyCardProps> = ({
  property,
  onView,
  onEdit,
  onDelete,
}) => {
  const { role } = useAuth();
  const canManage = role === 'admin' || role === 'owner';

  // Escolhe gradiente consistente baseado no ID
  const gradientIndex = Math.abs(property.id.charCodeAt(0)) % GRADIENTS.length;
  const gradientClass = GRADIENTS[gradientIndex];

  return (
    <Card hoverable className="overflow-hidden flex flex-col group border-slate-200/90 shadow-sm">
      {/* Banner / Cover Header com Efeito Glass e Badges */}
      <div className={`relative h-44 bg-gradient-to-tr ${gradientClass} p-4 flex flex-col justify-between text-white overflow-hidden`}>
        {/* Padrão geométrico translúcido de fundo */}
        <div className="absolute inset-0 bg-white/5 opacity-40 mix-blend-overlay pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-black/30 backdrop-blur-md text-white border border-white/20 uppercase tracking-wider">
            {PROPERTY_TYPE_LABELS[property.property_type] || 'Imóvel'}
          </span>

          <Badge
            variant={
              property.status === 'active'
                ? 'emerald'
                : property.status === 'under_maintenance'
                ? 'amber'
                : 'slate'
            }
            dot
            size="sm"
            className="backdrop-blur-md bg-white/90"
          >
            {property.status === 'active'
              ? 'Ativo'
              : property.status === 'under_maintenance'
              ? 'Em Manutenção'
              : 'Inativo'}
          </Badge>
        </div>

        {/* Título e Localização no Cover */}
        <div className="relative z-10">
          <h3 className="text-lg font-extrabold text-white tracking-tight drop-shadow-sm truncate">
            {property.name}
          </h3>
          <p className="text-xs text-white/90 flex items-center gap-1 mt-0.5 drop-shadow-xs truncate">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {property.address.city}, {property.address.state}
          </p>
        </div>
      </div>

      {/* Corpo do Card com Especificações */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        {/* Capacidades e Cômodos */}
        <div className="grid grid-cols-4 gap-2 py-2 px-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
          <div>
            <div className="flex items-center justify-center text-slate-400 mb-0.5">
              <Users className="w-3.5 h-3.5" />
            </div>
            <p className="text-xs font-black text-slate-800">{property.max_guests}</p>
            <p className="text-[10px] text-slate-500 font-medium">Hóspedes</p>
          </div>
          <div>
            <div className="flex items-center justify-center text-slate-400 mb-0.5">
              <Home className="w-3.5 h-3.5" />
            </div>
            <p className="text-xs font-black text-slate-800">{property.bedrooms}</p>
            <p className="text-[10px] text-slate-500 font-medium">Quartos</p>
          </div>
          <div>
            <div className="flex items-center justify-center text-slate-400 mb-0.5">
              <Bed className="w-3.5 h-3.5" />
            </div>
            <p className="text-xs font-black text-slate-800">{property.beds}</p>
            <p className="text-[10px] text-slate-500 font-medium">Camas</p>
          </div>
          <div>
            <div className="flex items-center justify-center text-slate-400 mb-0.5">
              <Bath className="w-3.5 h-3.5" />
            </div>
            <p className="text-xs font-black text-slate-800">{property.bathrooms}</p>
            <p className="text-[10px] text-slate-500 font-medium">Banh.</p>
          </div>
        </div>

        {/* Comodidades em Destaque */}
        {property.amenities && property.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {property.amenities.slice(0, 3).map((a) => (
              <span
                key={a.id}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 flex items-center gap-1"
              >
                <Check className="w-3 h-3 text-emerald-600" /> {a.name}
              </span>
            ))}
            {property.amenities.length > 3 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-brand-50 text-brand-600">
                +{property.amenities.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Tarifas e Ações */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Diária Base</p>
            <p className="text-base font-black text-slate-900">
              {property.base_nightly_rate
                ? `R$ ${Number(property.base_nightly_rate).toFixed(2).replace('.', ',')}`
                : 'Sob consulta'}
              <span className="text-xs font-normal text-slate-500"> / noite</span>
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onView(property)}
              className="p-2 rounded-xl text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              title="Visualizar Detalhes"
            >
              <Eye className="w-4 h-4" />
            </button>
            {canManage && onEdit && (
              <button
                onClick={() => onEdit(property)}
                className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                title="Editar Imóvel"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            {canManage && onDelete && (
              <button
                onClick={() => onDelete(property)}
                className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Excluir Imóvel"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
