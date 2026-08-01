import axios, { AxiosError } from 'axios';
import type { AxiosRequestConfig } from 'axios';
import { getConfig } from '../config';
import { logger } from '../utils/logger';

const instance = axios.create({
  withCredentials: true,
});

instance.interceptors.request.use((config) => {
  config.baseURL ??= getConfig().apiBaseUrl;
  logger.debug(`HTTP ${config.method?.toUpperCase() ?? ''} ${config.baseURL ?? ''}${config.url ?? ''}`, {});
  return config;
});

instance.interceptors.response.use(
  (response) => {
    logger.debug(`HTTP ${String(response.status)} ${response.config.method?.toUpperCase() ?? ''} ${response.config.url ?? ''}`, {});
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig | undefined;

    if (error.response?.status === 403) {
      const data = error.response.data as ApiErrorResponse | undefined;
      if (data?.error === 'mfa_setup_required') {
        if (!window.location.pathname.includes('/login')) {
           window.location.href = '/login?mfa_setup_required=true';
        }
        return Promise.reject(error);
      }
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && originalRequest.url && !originalRequest.url.includes('/refresh') && !originalRequest.url.includes('/login') && !originalRequest.url.includes('/mfa/verify') && !originalRequest.url.includes('/mfa/recovery') && !originalRequest.url.includes('/auth/mfa/confirm') && !originalRequest.url.includes('/logout')) {

      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          return instance(originalRequest);
        }).catch((err: unknown) => {
          return Promise.reject(err instanceof Error ? err : new Error(String(err)));
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;
      authChannel?.postMessage({ type: 'REFRESH_START' } satisfies AuthChannelMessage);

      logger.info("Token refresh started", {});

      try {
        await instance.post('/refresh', null, { withCredentials: true });
        processQueue(null);
        authChannel?.postMessage({ type: 'REFRESH_DONE' } satisfies AuthChannelMessage);
        logger.info("Token refresh succeeded", {});
        return await instance(originalRequest);
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        processQueue(error, null);
        authChannel?.postMessage({ type: 'REFRESH_FAILED', errorMessage: error.message } satisfies AuthChannelMessage);
        logger.error("Token refresh failed", { error: error.message });
        window.dispatchEvent(new Event('auth:unauthorized'));
        return await Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    logger.warn(`HTTP ${String(error.response?.status ?? '')} ${error.config?.method?.toUpperCase() ?? ''} ${error.config?.url ?? ''}`, {
      error: getErrorMessage(error.response?.data),
    });
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let failedQueue: { resolve: (value?: unknown) => void, reject: (reason?: unknown) => void }[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

interface AuthChannelMessage {
  type: 'REFRESH_START' | 'REFRESH_DONE' | 'REFRESH_FAILED';
  errorMessage?: string;
}

const authChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('auth') : null;

if (authChannel) {
  authChannel.onmessage = (event: MessageEvent<AuthChannelMessage>) => {
    if (event.data.type === 'REFRESH_START') {
      isRefreshing = true;
    } else if (event.data.type === 'REFRESH_DONE') {
      isRefreshing = false;
      processQueue(null);
    } else {
      isRefreshing = false;
      const errMsg = event.data.errorMessage ?? 'refresh failed';
      processQueue(new Error(errMsg));
    }
  };

  window.addEventListener('beforeunload', () => {
    authChannel.close();
  });
}

interface CustomAxiosRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

interface ApiErrorResponse {
  status: "error";
  error: string;
}

function getErrorMessage(data: unknown): string {
  if (data && typeof data === 'object' && 'error' in data) {
    return (data as ApiErrorResponse).error;
  }
  return 'An unexpected error occurred';
}

export { getErrorMessage };
export default instance;
