import type { Session, User } from "@supabase/supabase-js";
import { createContext } from "react";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  errorMessage: string | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<boolean>;
  clearError: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
