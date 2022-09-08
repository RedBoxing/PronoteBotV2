declare global {
    namespace NodeJS {
        interface ProcessEnv {
            DISCORD_TOKEN: string;
            DISCORD_PRONOTE_CHANNEL: string;

            PRONOTE_URL: string;
            PRONOTE_USERNAME: string;
            PRONOTE_PASSWORD: string;
            PRONOTE_EDUCONNECT: string;

            HUGGINGFACE_API_KEY: string;
        }
    }
}

export {};