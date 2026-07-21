

import { getZettleAccessToken } from "./auth";

type ZettleRequestOptions = {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    headers?: Record<string, string>;
};

const ZETTLE_API_BASE_URL = "https://products.izettle.com";

export async function zettleRequest<T>(path: string, options: ZettleRequestOptions = {}): Promise<T> {
    const accessToken = await getZettleAccessToken();

    const response = await fetch(`${ZETTLE_API_BASE_URL}${path}`, {
        method: options.method ?? "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            ...options.headers,
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        cache: "no-store",
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(`Zettle request failed (${response.status}): ${message}`);
    }

    if (response.status === 204) {
        return undefined as T;
    }

    return response.json() as Promise<T>;
}
