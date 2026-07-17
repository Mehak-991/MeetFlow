const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface UserInfo {
  email: string;
  name: string | null;
  has_refresh_token: boolean;
}

export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('meetflow_token');
  }
  return null;
}

export function setAuthToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('meetflow_token', token);
  }
}

export function removeAuthToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('meetflow_token');
    localStorage.removeItem('meetflow_user');
  }
}

export function getUserInfo(): UserInfo | null {
  if (typeof window !== 'undefined') {
    const user = localStorage.getItem('meetflow_user');
    if (user) {
      try {
        return JSON.parse(user);
      } catch (e) {
        return null;
      }
    }
  }
  return null;
}

export function setUserInfo(user: UserInfo) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('meetflow_user', JSON.stringify(user));
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const url = `${API_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    removeAuthToken();
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.location.href = '/';
    }
    throw new Error('Unauthorized');
  }

  const responseData = await response.json();

  if (!response.ok) {
    throw new Error(responseData?.detail || responseData?.message || 'Something went wrong');
  }

  return responseData;
}
