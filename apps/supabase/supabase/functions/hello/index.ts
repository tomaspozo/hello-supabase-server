import { createApp } from "@hello-supabase-server/handler";

Deno.serve(createApp("supabase").fetch);
