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
      const detail =
        (error.response?.data as { message?: string } | undefined)?.message || error.message;
      const wrapped = new Error(`${label} request failed: ${detail}`);
      (wrapped as Error & { status?: number }).status = status;
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
