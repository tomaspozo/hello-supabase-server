declare module "virtual:highlighted-code" {
  export const handler: string;
  export const handlerLineCount: number;
  export const handlerVanilla: string;
  export const handlerVanillaLineCount: number;
  export const entrypoints: {
    supabase: string;
    vercel: string;
    cloudflare: string;
  };
}
