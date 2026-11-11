import React, { useCallback, useEffect, useState } from 'react';
import {
  PackageOpen,
  Plus,
  CheckCircle2,
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  X,
  History,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useAuth } from '../context/AuthContext';
import {
  inventoryService,
  InventoryItem,
  InventoryMovement,
  StockMovementType,
} from '../services/inventoryService';
import { propertyService } from '../services/propertyService';
import { Property } from '../types/property';
import { getApiErrorMessage } from '../utils/apiError';

export const InventoryPage: React.FC = () => {
  const { role } = useAuth();
  const canCreateItem = role === 'admin' || role === 'owner';

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal de Novo Item
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newItem, setNewItem] = useState({
    property_id: '',
    name: '',
    category: 'higiene',
    unit: 'un',
    initial_quantity: '10',
    minimum_quantity: '4',
  });

  // Modal de Movimentação (Entrada / Saída)
  const [movementTarget, setMovementTarget] = useState<{
    item: InventoryItem;
    type: StockMovementType;
  } | null>(null);
  const [movementQty, setMovementQty] = useState('1');
  const [movementReason, setMovementReason] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [itemsData, movsData, propsData] = await Promise.all([
        inventoryService.listItems({ low_stock_only: lowStockOnly }),
        inventoryService.listMovements(),
        propertyService.listProperties({ page: 1, page_size: 100 }),
      ]);
      setItems(itemsData);
      setMovements(movsData);
      setProperties(propsData.items || []);
      if (propsData.items?.length && !newItem.property_id) {
        setNewItem((prev) => ({ ...prev, property_id: propsData.items[0].id }));
      }
    } catch (err) {
      setLoadError(getApiErrorMessage(err, 'Não foi possível carregar os dados de estoque.'));
    } finally {
      setIsLoading(false);
    }
  }, [lowStockOnly, newItem.property_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.property_id) {
      setNotice({ type: 'error', text: 'Selecione um imóvel para cadastrar o item.' });
      return;
    }
    setIsSaving(true);
    setNotice(null);
    try {
      const created = await inventoryService.createItem({
        property_id: newItem.property_id,
        name: newItem.name.trim(),
        category: newItem.category,
        unit: newItem.unit.trim() || 'un',
        initial_quantity: Number(newItem.initial_quantity || 0),
        minimum_quantity: Number(newItem.minimum_quantity || 0),
      });
      setItems((prev) => [...prev, created]);
      setIsItemModalOpen(false);
      setNewItem((prev) => ({ ...prev, name: '', initial_quantity: '10', minimum_quantity: '4' }));
      setNotice({ type: 'success', text: `Item "${created.name}" adicionado ao estoque.` });
      await loadData();
    } catch (err) {
      setNotice({
        type: 'error',
        text: getApiErrorMessage(err, 'Erro ao cadastrar item de estoque.'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementTarget) return;
    setIsSaving(true);
    setNotice(null);
    try {
      await inventoryService.recordMovement({
        item_id: movementTarget.item.id,
        movement_type: movementTarget.type,
        quantity: Number(movementQty),
        reason: movementReason.trim() || undefined,
      });
      setMovementTarget(null);
      setMovementQty('1');
      setMovementReason('');
      setNotice({
        type: 'success',
        text: 'Movimentação registrada e saldo atualizado com sucesso!',
      });
      await loadData();
    } catch (err) {
      setNotice({
        type: 'error',
        text: getApiErrorMessage(err, 'Não foi possível registrar a movimentação (RF-12).'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Suprimentos & Controle de Estoque
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Monitoramento de enxoval, higiene e limpeza por imóvel com bloqueio de saldo negativo (RF-12).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setLowStockOnly((v) => !v)}
          >
            {lowStockOnly ? 'Mostrar Todos' : 'Apenas Estoque Baixo'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            icon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Atualizar
          </Button>
          {canCreateItem && (
            <Button
              variant="primary"
              onClick={() => setIsItemModalOpen(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              Novo Suprimento
            </Button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="text-xs font-bold underline">
            Fechar
          </button>
        </div>
      )}

      {/* Listagem de Itens */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-40 rounded-2xl bg-white border border-slate-200/70 p-5 animate-pulse" />
          ))}
        </div>
      ) : loadError ? (
        <Card className="p-8 text-center border-rose-200 bg-rose-50/40">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">Falha ao carregar estoque</h3>
          <p className="text-xs text-slate-600 mt-1">{loadError}</p>
          <div className="mt-4">
            <Button variant="primary" size="sm" onClick={loadData}>
              Tentar novamente
            </Button>
          </div>
        </Card>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-slate-300 bg-white/50">
          <PackageOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">Nenhum suprimento encontrado</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Cadastre itens de higiene, limpeza, cozinha e enxoval dos imóveis para acompanhar alertas de reposição.
          </p>
          {canCreateItem && (
            <div className="mt-5">
              <Button variant="primary" size="sm" onClick={() => setIsItemModalOpen(true)} icon={<Plus className="w-4 h-4" />}>
                Cadastrar Primeiro Item
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card key={item.id} className="p-5 flex flex-col justify-between border-slate-200/90 shadow-sm">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="slate" size="sm">
                    {item.category.toUpperCase()}
                  </Badge>
                  <Badge variant={item.is_low_stock ? 'rose' : 'emerald'} dot size="sm">
                    {item.is_low_stock ? 'Estoque Crítico' : 'Saldo Normal'}
                  </Badge>
                </div>
                <h3 className="text-base font-extrabold text-slate-900">{item.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{item.property_name}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Saldo Atual / Mínimo</p>
                  <p className="text-lg font-black text-slate-900">
                    {Number(item.current_quantity)} {item.unit}
                    <span className="text-xs font-normal text-slate-500 ml-1">
                      (mín. {Number(item.minimum_quantity)})
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="emerald"
                    onClick={() => setMovementTarget({ item, type: 'in' })}
                    icon={<ArrowUpCircle className="w-3.5 h-3.5" />}
                  >
                    Entrada
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setMovementTarget({ item, type: 'out' })}
                    icon={<ArrowDownCircle className="w-3.5 h-3.5" />}
                  >
                    Saída
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Livro-Razão de Movimentações Recentes */}
      {movements.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-4.5 h-4.5 text-brand-600" />
            <h3 className="text-base font-bold text-slate-900">Livro-Razão de Movimentações</h3>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {movements.slice(0, 15).map((mov) => (
              <div
                key={mov.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs"
              >
                <div>
                  <span className="font-bold text-slate-800">{mov.item_name}</span>
                  <span className="text-slate-500"> ({mov.property_name})</span>
                  {mov.reason && <p className="text-[11px] text-slate-500 mt-0.5">{mov.reason}</p>}
                </div>
                <div className="text-right">
                  <Badge
                    variant={mov.movement_type === 'in' ? 'emerald' : 'amber'}
                    size="sm"
                  >
                    {mov.movement_type === 'in' ? '+' : '-'}
                    {Number(mov.quantity)} (Saldo: {Number(mov.balance_after)})
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Modal de Novo Suprimento */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-extrabold text-slate-900">Cadastrar Suprimento</h3>
              <button
                type="button"
                onClick={() => setIsItemModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700"
                aria-label="Fechar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                  Imóvel *
                </label>
                <select
                  required
                  value={newItem.property_id}
                  onChange={(e) => setNewItem({ ...newItem, property_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl px-3.5 py-2.5"
                >
                  <option value="">Selecione um imóvel...</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Nome do Item *"
                placeholder="Ex: Papel Higiênico Folha Dupla"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                    Categoria
                  </label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl px-3.5 py-2.5"
                  >
                    <option value="higiene">Higiene</option>
                    <option value="limpeza">Limpeza</option>
                    <option value="enxoval">Enxoval</option>
                    <option value="cozinha">Cozinha</option>
                  </select>
                </div>

                <Input
                  label="Unidade *"
                  placeholder="un, rolo, kit..."
                  value={newItem.unit}
                  onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Saldo Inicial *"
                  type="number"
                  min="0"
                  step="1"
                  value={newItem.initial_quantity}
                  onChange={(e) => setNewItem({ ...newItem, initial_quantity: e.target.value })}
                  required
                />
                <Input
                  label="Estoque Mínimo *"
                  type="number"
                  min="0"
                  step="1"
                  value={newItem.minimum_quantity}
                  onChange={(e) => setNewItem({ ...newItem, minimum_quantity: e.target.value })}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="ghost" onClick={() => setIsItemModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" isLoading={isSaving}>
                  Salvar Item
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Movimentação */}
      {movementTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-extrabold text-slate-900">
                {movementTarget.type === 'in' ? 'Registrar Entrada' : 'Registrar Saída / Consumo'}
              </h3>
              <button
                type="button"
                onClick={() => setMovementTarget(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700"
                aria-label="Fechar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordMovement} className="space-y-4 mt-4">
              <div className="p-3 rounded-xl bg-slate-50 text-xs">
                <p className="font-bold text-slate-800">{movementTarget.item.name}</p>
                <p className="text-slate-500">
                  Saldo atual: {Number(movementTarget.item.current_quantity)} {movementTarget.item.unit}
                </p>
              </div>

              <Input
                label={`Quantidade (${movementTarget.item.unit}) *`}
                type="number"
                min="1"
                step="1"
                value={movementQty}
                onChange={(e) => setMovementQty(e.target.value)}
                required
              />

              <Input
                label="Motivo / Observação"
                placeholder="Ex: Reposição para check-in ou compra mensal"
                value={movementReason}
                onChange={(e) => setMovementReason(e.target.value)}
              />

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="ghost" onClick={() => setMovementTarget(null)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" isLoading={isSaving}>
                  Confirmar Movimentação
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
