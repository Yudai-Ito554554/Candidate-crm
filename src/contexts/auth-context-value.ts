import type { Session, User } from "@supabase/supabase-js";
import { createContext } from "react";

export type AuthContextValue = {
  isConfigured: boolean;
  isLoading: boolean;
  session: Session | null;
  user: User | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<string | null>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
