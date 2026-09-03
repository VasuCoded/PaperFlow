/**
 * PLACEHOLDER. Regenerate after every schema change with:
 *   supabase gen types typescript --local > src/lib/database.types.ts
 *
 * Until the local Supabase stack is running (needs Docker), this empty-but-
 * valid shape lets the app typecheck. Do not hand-edit generated output.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
