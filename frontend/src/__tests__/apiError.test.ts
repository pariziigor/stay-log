import { describe, it, expect } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { getApiErrorMessage } from '../utils/apiError';
import { resolveApiBaseUrl } from '../services/api';

function axiosError(status: number | null, data?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response =
    status === null
      ? undefined
      : { status, statusText: '', headers: {}, config, data };
  return new AxiosError('falha', undefined, config, undefined, response as never);
}

describe('getApiErrorMessage', () => {
  it('usa a mensagem padronizada do backend', () => {
    const err = axiosError(409, { error: { code: 'ALREADY_EXISTS', message: 'E-mail já cadastrado.' } });
    expect(getApiErrorMessage(err)).toBe('E-mail já cadastrado.');
  });

  it('prioriza o primeiro erro de validação com o nome do campo', () => {
    const err = axiosError(422, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados de requisição inválidos.',
        details: { validation_errors: [{ field: 'password', message: 'String too short' }] },
      },
    });
    expect(getApiErrorMessage(err)).toBe('password: String too short');
  });

  it('informa falha de conexão quando não há resposta', () => {
    expect(getApiErrorMessage(axiosError(null))).toMatch(/conectar ao servidor/i);
  });

  it('usa mensagem genérica para erro 5xx sem corpo padronizado', () => {
    expect(getApiErrorMessage(axiosError(500, {}))).toMatch(/erro no servidor/i);
  });

  it('usa o fallback para erros que não vêm do Axios', () => {
    expect(getApiErrorMessage(new Error('x'), 'Falha X')).toBe('Falha X');
  });
});

describe('resolveApiBaseUrl', () => {
  it('anexa /api/v1 automaticamente quando a URL do Render não possui o sufixo', () => {
    expect(resolveApiBaseUrl('https://hospedaai-backend.onrender.com')).toBe(
      'https://hospedaai-backend.onrender.com/api/v1'
    );
    expect(resolveApiBaseUrl('https://hospedaai-backend.onrender.com/')).toBe(
      'https://hospedaai-backend.onrender.com/api/v1'
    );
  });

  it('preserva /api/v1 quando já informado', () => {
    expect(resolveApiBaseUrl('https://hospedaai-backend.onrender.com/api/v1')).toBe(
      'https://hospedaai-backend.onrender.com/api/v1'
    );
  });
});
