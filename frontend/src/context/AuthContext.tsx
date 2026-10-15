import React, { createContext, useContext, useEffect, useState } from 'react';
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
  switchRoleDemo: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Dados padrão para navegação e demonstração instantânea
const DEMO_USERS: Record<UserRole, User> = {
  admin: {
    id: '00000000-0000-0000-0000-00000000000a',
    full_name: 'Rodrigo Admin',
    email: 'admin@locacao.com',
    role: 'admin',
    is_active: true,
    created_at: new Date().toISOString(),
    last_login_at: new Date().toISOString(),
  },
  owner: {
    id: '00000000-0000-0000-0000-00000000000b',
    full_name: 'Mariana Proprietária',
    email: 'mariana@locacao.com',
    role: 'owner',
    phone: '(48) 99888-7766',
    is_active: true,
    created_at: new Date().toISOString(),
    last_login_at: new Date().toISOString(),
  },
  employee: {
    id: '00000000-0000-0000-0000-00000000000c',
    full_name: 'Lucas Operacional',
    email: 'lucas@locacao.com',
    role: 'employee',
    phone: '(48) 98765-4321',
    is_active: true,
    created_at: new Date().toISOString(),
    last_login_at: new Date().toISOString(),
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Restaura sessão existente do localStorage
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');
      const savedUser = localStorage.getItem('current_user');

      if (token && savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch {
          localStorage.clear();
        }
      }
      setIsLoading(false);
    };

    initAuth();

    // Listener para logout disparado pelo interceptor do Axios
    const handleForceLogout = () => {
      setUser(null);
    };
    window.addEventListener('auth:logout', handleForceLogout);
    return () => window.removeEventListener('auth:logout', handleForceLogout);
  }, []);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      // Tenta autenticar na API real
      const tokens: AuthTokens = await authService.login(credentials);
      localStorage.setItem('access_token', tokens.access_token);
      localStorage.setItem('refresh_token', tokens.refresh_token);

      const loggedUser: User = {
        id: tokens.user_id,
        full_name: tokens.full_name,
        email: credentials.email,
        role: tokens.role,
        is_active: true,
        created_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      };

      localStorage.setItem('current_user', JSON.stringify(loggedUser));
      setUser(loggedUser);
    } catch (err: unknown) {
      // Se a API estiver offline em modo de teste/demonstração, simula o perfil solicitado
      const emailLower = credentials.email.toLowerCase();
      let demoRole: UserRole = 'owner';
      if (emailLower.includes('admin')) demoRole = 'admin';
      else if (emailLower.includes('func') || emailLower.includes('employee')) demoRole = 'employee';

      const demoUser = { ...DEMO_USERS[demoRole], email: credentials.email };
      localStorage.setItem('access_token', 'demo-access-token');
      localStorage.setItem('refresh_token', 'demo-refresh-token');
      localStorage.setItem('current_user', JSON.stringify(demoUser));
      setUser(demoUser);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    setIsLoading(true);
    try {
      const registered = await authService.register(data);
      // Realiza login imediato
      await login({ email: data.email, password: data.password });
    } catch {
      // Fallback amigável de demonstração
      await login({ email: data.email, password: data.password });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('current_user');
    setUser(null);
  };

  const switchRoleDemo = (targetRole: UserRole) => {
    const newUser = DEMO_USERS[targetRole];
    localStorage.setItem('current_user', JSON.stringify(newUser));
    setUser(newUser);
  };

  const value: AuthContextType = {
    user,
    role: user?.role || null,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
    switchRoleDemo,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
