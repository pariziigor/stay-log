import axios from 'axios';

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: {
      validation_errors?: Array<{ field?: string; message?: string }>;
    };
  };
}

/**
 * Converte qualquer falha de chamada à API em uma mensagem legível para o usuário.
 * Nunca devolve detalhes técnicos além do que o backend padroniza em `error.message`.
 */
export function getApiErrorMessage(err: unknown, fallback = 'Não foi possível concluir a operação.'): string {
  if (!axios.isAxiosError<ApiErrorBody>(err)) {
    return fallback;
  }

  if (!err.response) {
    return 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
  }

  const body = err.response.data?.error;
  const firstValidation = body?.details?.validation_errors?.[0];
  if (firstValidation?.message) {
    const field = firstValidation.field ? `${firstValidation.field}: ` : '';
    return `${field}${firstValidation.message}`;
  }

  if (body?.message) {
    return body.message;
  }

  if (err.response.status >= 500) {
    return 'Ocorreu um erro no servidor. Tente novamente em instantes.';
  }

  return fallback;
}
