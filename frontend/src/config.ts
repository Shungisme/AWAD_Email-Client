declare global {
  interface Window {
    _env_: {
      [key: string]: string;
    };
  }
}

export const getEnv = (key: string, defaultValue: string = ''): string => {
  if (window._env_ && window._env_[key]) {
    return window._env_[key];
  }
  return import.meta.env[key] || defaultValue;
};

export const API_URL = getEnv('VITE_API_URL', 'http://localhost:5000/api');
export const GOOGLE_CLIENT_ID = getEnv('VITE_GOOGLE_CLIENT_ID', '');
