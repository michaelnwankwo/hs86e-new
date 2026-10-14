import axios, { type AxiosError, type AxiosInstance } from "axios";
import { getEnv } from "@/lib/env";

function attachRetry(instance: AxiosInstance, label: string) {
  instance.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
      const config = error.config as typeof error.config & { __retryCount?: number };
      if (!config) throw error;
      config.__retryCount = config.__retryCount ?? 0;
      const status = error.response?.status ?? 0;
      const retryable = !error.response || status >= 500 || status === 429;
      if (retryable && config.__retryCount < 2) {
        config.__retryCount += 1;
        const wait = 350 * config.__retryCount;
        await new Promise((r) => setTimeout(r, wait));
        return instance.request(config);
      }
      const data = error.response?.data as
        | { code?: string; message?: string }
        | undefined;
      const detail = data?.message || error.message;
      const code = data?.code ? ` [${data.code}]` : "";
      // Preserve the exact WP status + error code + body excerpt so server
      // logs identify credential vs permission vs route problems precisely.
      const wrapped = new Error(
        `${label} HTTP ${status}${code}: ${String(detail).slice(0, 300)}`,
      );
      (wrapped as Error & { status?: number }).status = status;
      (wrapped as Error & { wpCode?: string }).wpCode = data?.code;
      throw wrapped;
    },
  );
  instance.interceptors.request.use((config) => {
    config.headers.set("User-Agent", "HS86E-Tickets/1.0");
    return config;
  });
  return instance;
}

export function wcClient() {
  const env = getEnv();
  if (!env.WP_BASE_URL || !env.WC_CONSUMER_KEY || !env.WC_CONSUMER_SECRET) {
    throw new Error("WooCommerce credentials are not configured");
  }
  const instance = axios.create({
    baseURL: `${env.WP_BASE_URL}/wp-json/wc/v3`,
    auth: {
      username: env.WC_CONSUMER_KEY,
      password: env.WC_CONSUMER_SECRET,
    },
    params: {
      consumer_key: env.WC_CONSUMER_KEY,
      consumer_secret: env.WC_CONSUMER_SECRET,
    },
    timeout: 18_000,
  });
  return attachRetry(instance, "WooCommerce");
}

export function fooEventsClient() {
  const env = getEnv();
  if (!env.WP_BASE_URL || !env.WP_APP_USER || !env.WP_APP_PASSWORD) {
    throw new Error("FooEvents / WordPress application credentials are not configured");
  }
  const instance = axios.create({
    baseURL: `${env.WP_BASE_URL}/wp-json/fooevents/v1`,
    auth: {
      username: env.WP_APP_USER,
      password: env.WP_APP_PASSWORD,
    },
    timeout: 18_000,
  });
  return attachRetry(instance, "FooEvents");
}

export function wpBaseClient() {
  const env = getEnv();
  if (!env.WP_BASE_URL || !env.WP_APP_USER || !env.WP_APP_PASSWORD) {
    throw new Error("WordPress application credentials are not configured");
  }
  const instance = axios.create({
    baseURL: `${env.WP_BASE_URL}/wp-json`,
    auth: {
      username: env.WP_APP_USER,
      password: env.WP_APP_PASSWORD,
    },
    timeout: 18_000,
  });
  return attachRetry(instance, "WordPress");
}
