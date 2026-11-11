import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Building2, Loader2, RefreshCw, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { Property, PropertyCreateData } from '../types/property';
import { propertyService, PropertyFilterParams } from '../services/propertyService';
import { PropertyCard } from '../components/properties/PropertyCard';
import { PropertyFilters } from '../components/properties/PropertyFilters';
import { PropertyModal } from '../components/properties/PropertyModal';
import { PropertyDetailModal } from '../components/properties/PropertyDetailModal';
import { Button } from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import { getApiErrorMessage } from '../utils/apiError';

interface Notice {
  type: 'success' | 'error';
  text: string;
}

export const PropertiesPage: React.FC = () => {
  const { role } = useAuth();
  const canCreate = role === 'admin' || role === 'owner';

  const [properties, setProperties] = useState<Property[]>([]);
  const [filters, setFilters] = useState<PropertyFilterParams>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [viewingProperty, setViewingProperty] = useState<Property | null>(null);

  // Descarta respostas de requisições antigas quando os filtros mudam rapidamente.
  const latestRequest = useRef(0);

  const loadProperties = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await propertyService.listProperties(filters);
      if (requestId === latestRequest.current) {
        setProperties(data.items);
      }
    } catch (err) {
      if (requestId === latestRequest.current) {
        setLoadError(getApiErrorMessage(err, 'Não foi possível carregar os imóveis.'));
      }
    } finally {
      if (requestId === latestRequest.current) {
        setIsLoading(false);
      }
    }
  }, [filters]);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  // Feedback de sucesso some sozinho; erros permanecem até serem dispensados.
  useEffect(() => {
    if (notice?.type !== 'success') return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Falhas são propagadas ao PropertyModal, que as exibe junto ao formulário sem fechá-lo.
  const handleSaveProperty = async (formData: PropertyCreateData) => {
    const isEditing = !!editingProperty;
    if (editingProperty) {
      await propertyService.updateProperty(editingProperty.id, formData);
    } else {
      await propertyService.createProperty(formData);
    }
    setEditingProperty(null);
    setNotice({
      type: 'success',
      text: isEditing ? 'Imóvel atualizado com sucesso.' : 'Imóvel cadastrado com sucesso.',
    });
    await loadProperties();
  };

  const handleDeleteProperty = async (property: Property) => {
    if (!window.confirm(`Deseja realmente desativar o imóvel "${property.name}"?`)) return;

    try {
      await propertyService.deleteProperty(property.id);
      setNotice({ type: 'success', text: `Imóvel "${property.name}" desativado.` });
      await loadProperties();
    } catch (err) {
      setNotice({ type: 'error', text: getApiErrorMessage(err, 'Não foi possível desativar o imóvel.') });
    }
  };

  const openCreateModal = () => {
    setEditingProperty(null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Catálogo de Propriedades
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Gerencie capacidades, comodidades, tarifas e regras de check-in de cada acomodação.
          </p>
        </div>

        {canCreate && (
          <Button variant="primary" onClick={openCreateModal} icon={<Plus className="w-4 h-4" />}>
            Cadastrar Novo Imóvel
          </Button>
        )}
      </div>

      {/* Feedback de ações (sucesso / falha) */}
      {notice && (
        <div
          role={notice.type === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs font-semibold ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          )}
          <span className="flex-1">{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Fechar aviso"
            className="shrink-0 rounded-md p-0.5 hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Barra de Filtros Interativos */}
      <PropertyFilters filters={filters} onChange={setFilters} onReset={() => setFilters({})} />

      {/* Grid de Imóveis */}
      {isLoading ? (
        <div className="min-h-64 flex flex-col items-center justify-center gap-3" role="status" aria-live="polite">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
          <p className="text-xs font-semibold text-slate-400">Carregando catálogo...</p>
        </div>
      ) : loadError ? (
        <div
          role="alert"
          className="bg-white rounded-3xl border border-rose-200 p-12 text-center max-w-md mx-auto my-8 space-y-4"
        >
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Não foi possível carregar os imóveis</h3>
            <p className="text-xs text-slate-500 mt-1">{loadError}</p>
          </div>
          <Button size="sm" variant="primary" onClick={loadProperties} icon={<RefreshCw className="w-4 h-4" />}>
            Tentar novamente
          </Button>
        </div>
      ) : properties.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center max-w-md mx-auto my-8 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto shadow-sm">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Nenhum imóvel encontrado</h3>
            <p className="text-xs text-slate-500 mt-1">
              {Object.keys(filters).length > 0
                ? 'Não encontramos acomodações com os filtros selecionados. Tente ajustar a busca.'
                : canCreate
                ? 'Você ainda não cadastrou nenhuma propriedade.'
                : 'Não há imóveis vinculados à sua conta no momento.'}
            </p>
          </div>
          {canCreate && (
            <Button size="sm" variant="primary" onClick={openCreateModal}>
              Cadastrar Imóvel
            </Button>
          )}
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {properties.map((property) => (
              <motion.div
                key={property.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <PropertyCard
                  property={property}
                  onView={(p) => setViewingProperty(p)}
                  onEdit={(p) => {
                    setEditingProperty(p);
                    setIsModalOpen(true);
                  }}
                  onDelete={handleDeleteProperty}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Modal de Criação / Edição */}
      <PropertyModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProperty(null);
        }}
        onSave={handleSaveProperty}
        initialData={editingProperty}
      />

      {/* Modal de Visualização Detalhada */}
      <PropertyDetailModal
        property={viewingProperty}
        onClose={() => setViewingProperty(null)}
        onEdit={(p) => {
          setViewingProperty(null);
          setEditingProperty(p);
          setIsModalOpen(true);
        }}
      />
    </div>
  );
};
