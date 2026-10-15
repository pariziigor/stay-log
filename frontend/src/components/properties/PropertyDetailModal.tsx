import React from 'react';
import {
  Building2,
  MapPin,
  Users,
  Home,
  Bed,
  Bath,
  Clock,
  DollarSign,
  Check,
  CalendarCheck,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Property } from '../../types/property';

interface PropertyDetailModalProps {
  property: Property | null;
  onClose: () => void;
  onEdit?: (property: Property) => void;
}

export const PropertyDetailModal: React.FC<PropertyDetailModalProps> = ({
  property,
  onClose,
  onEdit,
}) => {
  if (!property) return null;

  return (
    <Modal
      isOpen={!!property}
      onClose={onClose}
      title={property.name}
      description={`Imóvel ID: ${property.id.slice(0, 8)}...`}
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Header Status & Endereço */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="brand" size="sm">
                {property.property_type.toUpperCase()}
              </Badge>
              <Badge
                variant={property.status === 'active' ? 'emerald' : 'amber'}
                dot
                size="sm"
              >
                {property.status === 'active' ? 'Disponível para Locação' : 'Indisponível / Em Manutenção'}
              </Badge>
            </div>
            <p className="text-xs text-slate-600 flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
              {property.address.street}
              {property.address.number ? `, ${property.address.number}` : ''}
              {property.address.neighborhood ? ` — ${property.address.neighborhood}` : ''},{' '}
              {property.address.city}/{property.address.state}
            </p>
          </div>

          <div className="text-right sm:border-l sm:border-slate-200 sm:pl-4">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Diária Base</p>
            <p className="text-lg font-black text-slate-900">
              {property.base_nightly_rate
                ? `R$ ${Number(property.base_nightly_rate).toFixed(2).replace('.', ',')}`
                : 'A combinar'}
            </p>
          </div>
        </div>

        {/* Descrição */}
        {property.description && (
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Sobre o Imóvel
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed bg-white p-3.5 rounded-xl border border-slate-100">
              {property.description}
            </p>
          </div>
        )}

        {/* Grade de Capacidade e Cômodos */}
        <div>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Capacidade e Distribuição
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
              <Users className="w-4 h-4 mx-auto text-brand-600 mb-1" />
              <p className="text-sm font-bold text-slate-800">{property.max_guests} Hóspedes</p>
              <p className="text-[10px] text-slate-400">Capacidade máxima</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
              <Home className="w-4 h-4 mx-auto text-brand-600 mb-1" />
              <p className="text-sm font-bold text-slate-800">{property.bedrooms} Quartos</p>
              <p className="text-[10px] text-slate-400">Privativos</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
              <Bed className="w-4 h-4 mx-auto text-brand-600 mb-1" />
              <p className="text-sm font-bold text-slate-800">{property.beds} Camas</p>
              <p className="text-[10px] text-slate-400">Total disponíveis</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
              <Bath className="w-4 h-4 mx-auto text-brand-600 mb-1" />
              <p className="text-sm font-bold text-slate-800">{property.bathrooms} Banheiros</p>
              <p className="text-[10px] text-slate-400">Completos / lavabos</p>
            </div>
          </div>
        </div>

        {/* Horários Operacionais e Taxas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs font-bold text-slate-800">Check-in / Check-out</p>
                <p className="text-[11px] text-slate-500">
                  Entrada a partir de {property.check_in_time.slice(0, 5)} • Saída até {property.check_out_time.slice(0, 5)}
                </p>
              </div>
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <div>
                <p className="text-xs font-bold text-slate-800">Taxa de Limpeza Padrão</p>
                <p className="text-[11px] text-slate-500">
                  R$ {Number(property.cleaning_fee).toFixed(2).replace('.', ',')} por reserva
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Comodidades Cadastradas */}
        {property.amenities && property.amenities.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Comodidades Incluídas ({property.amenities.length})
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {property.amenities.map((a) => (
                <div
                  key={a.id}
                  className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center gap-2 text-xs font-semibold text-emerald-900"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">{a.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
          {onEdit && (
            <Button
              variant="primary"
              onClick={() => {
                onClose();
                onEdit(property);
              }}
            >
              Editar Imóvel
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
