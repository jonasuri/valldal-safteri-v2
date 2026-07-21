export type ZettleAccessToken = {
    accessToken: string;
    expiresAt: number;
};

let cachedToken: ZettleAccessToken | null = null;

function requireEnv(name: string) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing environment variable: ${name}`);
    }
    return value;
}

export async function getZettleAccessToken(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
        return cachedToken.accessToken;
    }

    const clientId = requireEnv("ZETTLE_CLIENT_ID");
    const apiKey = requireEnv("ZETTLE_API_KEY");

    const response = await fetch("https://oauth.izettle.com/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            client_id: clientId,
            assertion: apiKey,
        }),
        cache: "no-store",
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(`Failed to authenticate with Zettle: ${message}`);
    }

    const json = await response.json() as {
        access_token: string;
        expires_in: number;
    };

    cachedToken = {
        accessToken: json.access_token,
        expiresAt: Date.now() + json.expires_in * 1000,
    };

    return cachedToken.accessToken;
}