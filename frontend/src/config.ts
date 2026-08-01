export interface AppConfig {
  apiBaseUrl: string;
}

const isLocal = import.meta.env.DEV;

const config: AppConfig = {
  apiBaseUrl: isLocal ? "http://localhost:3333/api" : "/api",
};

export const loadConfig = async (): Promise<void> => {
  try {
    const response = await fetch('/config.json');
    if (response.ok) {
      const data = (await response.json()) as Partial<AppConfig>;
      if (data.apiBaseUrl) {
        config.apiBaseUrl = data.apiBaseUrl;
      }
    }
  } catch {
    // use defaults
  }
};

export const getConfig = (): AppConfig => config;
