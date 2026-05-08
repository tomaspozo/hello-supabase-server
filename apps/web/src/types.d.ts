declare module "virtual:highlighted-code" {
  export const handler: string;
  export const handlerLineCount: number;
  export const entrypoints: {
    supabase: string;
    vercel: string;
    cloudflare: string;
  };
}
