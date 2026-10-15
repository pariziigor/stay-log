import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ArrowLeft } from 'lucide-react';
import { Button } from '../components/common/Button';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto shadow-sm">
          <Building2 className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">404</h1>
        <h2 className="text-lg font-bold text-slate-800">Página não encontrada</h2>
        <p className="text-xs text-slate-500">
          O endereço acessado não existe ou você não possui permissão para visualizá-lo.
        </p>
        <div className="pt-2">
          <Button
            variant="primary"
            onClick={() => navigate('/dashboard')}
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            Voltar para o Painel
          </Button>
        </div>
      </div>
    </div>
  );
};
