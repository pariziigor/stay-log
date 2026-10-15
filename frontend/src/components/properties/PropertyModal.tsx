import React, { useState, useEffect } from 'react';
import { Building2, MapPin, DollarSign, Sparkles, Check, Clock } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { Amenity, Property, PropertyCreateData, PropertyType } from '../../types/property';
import { propertyService } from '../../services/propertyService';

interface PropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: PropertyCreateData) => Promise<void>;
  initialData?: Property | null;
}

export const PropertyModal: React.FC<PropertyModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('apartment');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('SC');
  const [postalCode, setPostalCode] = useState('');
  const [maxGuests, setMaxGuests] = useState(4);
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(1);
  const [beds, setBeds] = useState(2);
  const [areaM2, setAreaM2] = useState<number | undefined>(65);
  const [nightlyRate, setNightlyRate] = useState<number | undefined>(320);
  const [cleaningFee, setCleaningFee] = useState<number>(120);
  const [checkInTime, setCheckInTime] = useState('15:00');
  const [checkOutTime, setCheckOutTime] = useState('11:00');
  const [selectedAmenities, setSelectedAmenities] = useState<number[]>([1]);
  const [amenitiesCatalog, setAmenitiesCatalog] = useState<Amenity[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Carrega catálogo de comodidades ao abrir
  useEffect(() => {
    if (isOpen) {
      propertyService.listAmenities().then(setAmenitiesCatalog).catch(() => {
        // Fallback default
        setAmenitiesCatalog([
          { id: 1, code: 'wifi', name: 'Wi-Fi de Alta Velocidade', category: 'conectividade' },
          { id: 2, code: 'pool', name: 'Piscina', category: 'área externa' },
          { id: 3, code: 'air_conditioning', name: 'Ar-condicionado', category: 'conforto' },
          { id: 4, code: 'kitchen', name: 'Cozinha Completa', category: 'cozinha' },
          { id: 5, code: 'parking', name: 'Estacionamento Grátis', category: 'área externa' },
          { id: 6, code: 'pet_friendly', name: 'Aceita Pets', category: 'regras' },
        ]);
      });
    }
  }, [isOpen]);

  // Preenche dados quando estiver no modo de edição
  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setDescription(initialData.description || '');
      setPropertyType(initialData.property_type);
      setStreet(initialData.address.street);
      setNumber(initialData.address.number || '');
      setNeighborhood(initialData.address.neighborhood || '');
      setCity(initialData.address.city);
      setState(initialData.address.state);
      setPostalCode(initialData.address.postal_code || '');
      setMaxGuests(initialData.max_guests);
      setBedrooms(initialData.bedrooms);
      setBathrooms(initialData.bathrooms);
      setBeds(initialData.beds);
      setAreaM2(initialData.area_m2 || undefined);
      setNightlyRate(initialData.base_nightly_rate || undefined);
      setCleaningFee(initialData.cleaning_fee || 0);
      setCheckInTime(initialData.check_in_time ? initialData.check_in_time.slice(0, 5) : '15:00');
      setCheckOutTime(initialData.check_out_time ? initialData.check_out_time.slice(0, 5) : '11:00');
      setSelectedAmenities(initialData.amenities ? initialData.amenities.map((a) => a.id) : []);
    } else {
      setName('');
      setDescription('');
      setPropertyType('apartment');
      setStreet('');
      setNumber('');
      setNeighborhood('');
      setCity('');
      setState('SC');
      setPostalCode('');
      setMaxGuests(4);
      setBedrooms(2);
      setBathrooms(1);
      setBeds(2);
      setAreaM2(65);
      setNightlyRate(320);
      setCleaningFee(120);
      setCheckInTime('15:00');
      setCheckOutTime('11:00');
      setSelectedAmenities([1]);
    }
    setErrorMsg('');
  }, [initialData, isOpen]);

  const toggleAmenity = (id: number) => {
    setSelectedAmenities((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Por favor, informe o nome do imóvel.');
      return;
    }
    if (!street.trim() || !city.trim() || !state.trim()) {
      setErrorMsg('Logradouro, cidade e estado (UF) são obrigatórios.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const payload: PropertyCreateData = {
        name,
        description,
        property_type: propertyType,
        address: {
          street,
          number,
          neighborhood,
          city,
          state: state.toUpperCase(),
          postal_code: postalCode || undefined,
          country: 'BR',
        },
        max_guests: Number(maxGuests),
        bedrooms: Number(bedrooms),
        bathrooms: Number(bathrooms),
        beds: Number(beds),
        area_m2: areaM2 ? Number(areaM2) : undefined,
        base_nightly_rate: nightlyRate ? Number(nightlyRate) : undefined,
        cleaning_fee: Number(cleaningFee),
        check_in_time: checkInTime,
        check_out_time: checkOutTime,
        amenity_ids: selectedAmenities,
      };

      await onSave(payload);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Falha ao salvar imóvel.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Editar Propriedade' : 'Cadastrar Novo Imóvel'}
      description="Preencha os dados e comodidades para disponibilizar na gestão e no calendário."
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* 1. Dados Básicos */}
        <div className="space-y-3">
          <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5 border-slate-100">
            <Building2 className="w-3.5 h-3.5 text-brand-600" /> Informações Básicas
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Input
                label="Nome do Imóvel *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Apto 302 com Vista para o Mar"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 tracking-wide uppercase mb-1.5">
                Tipo do Imóvel
              </label>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                className="w-full bg-slate-50 border border-slate-200/90 text-slate-900 text-sm rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="apartment">Apartamento</option>
                <option value="house">Casa</option>
                <option value="studio">Studio</option>
                <option value="chalet">Chalé</option>
                <option value="farm">Sítio / Chácara</option>
                <option value="room">Quarto Individual</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 tracking-wide uppercase mb-1.5">
              Descrição do Imóvel
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Descreva os diferenciais, regras de convivência e orientações aos hóspedes..."
              className="w-full bg-slate-50 border border-slate-200/90 text-slate-900 text-sm rounded-xl p-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
            />
          </div>
        </div>

        {/* 2. Endereço */}
        <div className="space-y-3">
          <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5 border-slate-100">
            <MapPin className="w-3.5 h-3.5 text-brand-600" /> Endereço & Localização
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-3">
              <Input
                label="Logradouro *"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Rua, Avenida..."
                required
              />
            </div>
            <div>
              <Input
                label="Número"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="Ex: 104"
              />
            </div>
            <div className="sm:col-span-2">
              <Input
                label="Bairro"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="Ex: Centro"
              />
            </div>
            <div>
              <Input
                label="Cidade *"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex: Florianópolis"
                required
              />
            </div>
            <div>
              <Input
                label="UF (Estado) *"
                value={state}
                maxLength={2}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                placeholder="SC"
                required
              />
            </div>
          </div>
        </div>

        {/* 3. Capacidade e Cômodos */}
        <div className="space-y-3">
          <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider border-b pb-1.5 border-slate-100">
            Capacidade e Cômodos
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <Input
                type="number"
                min={1}
                max={100}
                label="Hóspedes *"
                value={maxGuests}
                onChange={(e) => setMaxGuests(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <Input
                type="number"
                min={0}
                label="Quartos"
                value={bedrooms}
                onChange={(e) => setBedrooms(Number(e.target.value))}
              />
            </div>
            <div>
              <Input
                type="number"
                min={0}
                label="Camas"
                value={beds}
                onChange={(e) => setBeds(Number(e.target.value))}
              />
            </div>
            <div>
              <Input
                type="number"
                min={1}
                label="Banheiros"
                value={bathrooms}
                onChange={(e) => setBathrooms(Number(e.target.value))}
              />
            </div>
            <div>
              <Input
                type="number"
                min={0}
                label="Área (m²)"
                value={areaM2 || ''}
                onChange={(e) => setAreaM2(e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
          </div>
        </div>

        {/* 4. Tarifas e Horários */}
        <div className="space-y-3">
          <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5 border-slate-100">
            <DollarSign className="w-3.5 h-3.5 text-brand-600" /> Tarifas & Horários
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Input
                type="number"
                min={0}
                step="0.01"
                label="Diária Base (R$)"
                value={nightlyRate || ''}
                onChange={(e) => setNightlyRate(e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
            <div>
              <Input
                type="number"
                min={0}
                step="0.01"
                label="Taxa Limpeza (R$)"
                value={cleaningFee}
                onChange={(e) => setCleaningFee(Number(e.target.value))}
              />
            </div>
            <div>
              <Input
                type="time"
                label="Check-in"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
              />
            </div>
            <div>
              <Input
                type="time"
                label="Check-out"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 5. Comodidades */}
        <div className="space-y-3">
          <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5 border-slate-100">
            <Sparkles className="w-3.5 h-3.5 text-brand-600" /> Comodidades e Serviços
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {amenitiesCatalog.map((amenity) => {
              const isChecked = selectedAmenities.includes(amenity.id);
              return (
                <div
                  key={amenity.id}
                  onClick={() => toggleAmenity(amenity.id)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer select-none transition-all ${
                    isChecked
                      ? 'bg-brand-50 border-brand-300 text-brand-800 shadow-2xs'
                      : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                      isChecked ? 'bg-brand-600 border-brand-600 text-white' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="truncate">{amenity.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" isLoading={isSubmitting}>
            {initialData ? 'Atualizar Imóvel' : 'Salvar e Publicar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
