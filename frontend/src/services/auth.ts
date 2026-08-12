/**
 * Authentication Service
 * Handles JWT token storage, retrieval, and automatic refresh
 */

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'auth_user';

export interface AuthUser {
  email: string;
  name: string;
  phone?: string;
  location?: string;
  skills: string[];
  experience: string[];
  education?: string[];
  profile_summary?: string;
  is_verified: boolean;
  is_onboarded: boolean;
  chat_history?: any[];
  saved_jobs?: any[];
  applied_jobs?: any[];
  interviews?: any[];
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

export interface RegisterResponse {
  message: string;
  user_id: string;
  email: string;
}

// ==================== TOKEN MANAGEMENT ====================

export const getAccessToken = (): string | null => {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const setTokens = (accessToken: string, refreshToken: string): void => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const clearTokens = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const getStoredUser = (): AuthUser | null => {
  const userJson = localStorage.getItem(USER_KEY);
  if (userJson) {
    try {
      return JSON.parse(userJson);
    } catch {
      return null;
    }
  }
  return null;
};

export const setStoredUser = (user: AuthUser): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const isAuthenticated = (): boolean => {
  return !!getAccessToken();
};

// ==================== AUTH API CALLS ====================

const API_BASE = '/api/auth';

export const register = async (
  email: string,
  password: string,
  confirmPassword: string,
  name: string
): Promise<RegisterResponse> => {
  const response = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      confirm_password: confirmPassword,
      name,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Registration failed');
  }

  return response.json();
};

export const login = async (
  email: string,
  password: string
): Promise<LoginResponse> => {
  const response = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Login failed');
  }

  const data: LoginResponse = await response.json();

  // Store tokens and user data
  setTokens(data.access_token, data.refresh_token);
  setStoredUser(data.user);

  return data;
};

export const logout = async (): Promise<void> => {
  const token = getAccessToken();

  if (token) {
    try {
      await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    }
  }

  // Clear local storage regardless of API response
  clearTokens();
};

export const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE}/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      clearTokens();
      return null;
    }

    const data = await response.json();
    localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
    return data.access_token;
  } catch (error) {
    console.error('Token refresh failed:', error);
    clearTokens();
    return null;
  }
};

export const changePassword = async (
  currentPassword: string,
  newPassword: string,
  confirmNewPassword: string
): Promise<{ message: string }> => {
  const token = getAccessToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE}/change-password`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
      confirm_new_password: confirmNewPassword,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Password change failed');
  }

  return response.json();
};

export const validateToken = async (): Promise<boolean> => {
  const token = getAccessToken();

  if (!token) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE}/validate`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.ok) {
      return true;
    }

    // Try to refresh the token
    const newToken = await refreshAccessToken();
    return !!newToken;
  } catch {
    return false;
  }
};

export const getCurrentUser = async (): Promise<AuthUser | null> => {
  const token = getAccessToken();

  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE}/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Try to refresh token
        const newToken = await refreshAccessToken();
        if (newToken) {
          return getCurrentUser();
        }
      }
      return null;
    }

    const user = await response.json();
    setStoredUser(user);
    return user;
  } catch {
    return null;
  }
};

// ==================== AUTHENTICATED FETCH WRAPPER ====================

/**
 * Wrapper for fetch that automatically includes auth headers
 * and handles token refresh on 401 errors
 */
export const authFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  let token = getAccessToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  const authOptions: RequestInit = {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    },
  };

  let response = await fetch(url, authOptions);

  // If unauthorized, try to refresh token and retry
  if (response.status === 401) {
    const newToken = await refreshAccessToken();

    if (newToken) {
      authOptions.headers = {
        ...authOptions.headers,
        'Authorization': `Bearer ${newToken}`,
      };
      response = await fetch(url, authOptions);
    } else {
      // Token refresh failed, clear auth and throw
      clearTokens();
      throw new Error('Session expired. Please login again.');
    }
  }

  return response;
};
