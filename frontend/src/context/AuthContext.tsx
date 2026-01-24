import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  login as authLogin,
  logout as authLogout,
  register as authRegister,
  getCurrentUser,
  validateToken,
  isAuthenticated,
  clearTokens,
  getStoredUser,
  setStoredUser,
  AuthUser,
  LoginResponse,
  RegisterResponse,
} from '../services/auth';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<LoginResponse>;
  register: (email: string, password: string, confirmPassword: string, name: string) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<AuthUser>) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (isAuthenticated()) {
          // First try to get cached user
          const cachedUser = getStoredUser();
          if (cachedUser) {
            setUser(cachedUser);
          }

          // Validate token and refresh user data
          const isValid = await validateToken();
          if (isValid) {
            const currentUser = await getCurrentUser();
            if (currentUser) {
              setUser(currentUser);
            }
          } else {
            // Token is invalid, clear auth state
            clearTokens();
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        clearTokens();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResponse> => {
    setIsLoading(true);
    try {
      const response = await authLogin(email, password);
      setUser(response.user);
      return response;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (
    email: string,
    password: string,
    confirmPassword: string,
    name: string
  ): Promise<RegisterResponse> => {
    return authRegister(email, password, confirmPassword, name);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await authLogout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateUser = useCallback((userData: Partial<AuthUser>): void => {
    setUser((prevUser) => {
      if (!prevUser) return null;
      const updatedUser = { ...prevUser, ...userData };
      setStoredUser(updatedUser);
      return updatedUser;
    });
  }, []);

  const refreshUser = useCallback(async (): Promise<void> => {
    try {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    updateUser,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
