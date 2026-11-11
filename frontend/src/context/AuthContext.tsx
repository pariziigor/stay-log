import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthTokens, LoginCredentials, RegisterData, User, UserRole } from '../types/auth';
import { authService } from '../services/authService';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const clearSession = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('current_user'); // chave legada, não é mais usada
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restaura a sessão validando o token no servidor (nunca confia em dados salvos no navegador).
  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      if (!localStorage.getItem('access_token')) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await authService.getMe();
        if (!cancelled) setUser(me);
      } catch {
        clearSession();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    restoreSession();

    // Logout forçado disparado pelo interceptor do Axios (refresh token inválido/expirado)
    const handleForceLogout = () => setUser(null);
    window.addEventListener('auth:logout', handleForceLogout);
    return () => {
      cancelled = true;
      window.removeEventListener('auth:logout', handleForceLogout);
    };
  }, []);

  // Erros da API são propagados ao chamador (LoginPage) para exibir a mensagem real ao usuário.
  const login = useCallback(async (credentials: LoginCredentials) => {
    const tokens: AuthTokens = await authService.login(credentials);
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);
    try {
      setUser(await authService.getMe());
    } catch (err) {
      clearSession();
      throw err;
    }
  }, []);

  const register = useCallback(
    async (data: RegisterData) => {
      await authService.register(data);
      await login({ email: data.email, password: data.password });
    },
    [login]
  );

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    clearSession();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      role: user?.role ?? null,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
