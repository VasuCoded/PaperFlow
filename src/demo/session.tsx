"use client";

/**
 * Demo session. Deliberately NOT Supabase auth: this is localStorage only, has
 * no server component, grants nothing, and is never imported outside /demo.
 * Signing in as a persona here is a design-review convenience, not an auth
 * mechanism — see src/app/demo/README.md.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { ACCOUNTS, account as findAccount, PLATFORM_ID } from "./institutes";
import type { DemoAccount, DemoRole } from "./types";

const ACCOUNT_KEY = "pf_demo_account";
const INSTITUTE_KEY = "pf_demo_institute";

interface SessionValue {
  ready: boolean;
  account: DemoAccount | null;
  instituteId: string | null;
  role: DemoRole | null;
  signIn: (accountId: string) => void;
  signOut: () => void;
  setInstitute: (instituteId: string) => void;
}

const Ctx = createContext<SessionValue | null>(null);

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* private mode / blocked storage — the demo still renders */
  }
}

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [instituteId, setInstituteId] = useState<string | null>(null);

  useEffect(() => {
    const a = read(ACCOUNT_KEY);
    const i = read(INSTITUTE_KEY);
    if (a && findAccount(a)) {
      setAccountId(a);
      const acc = findAccount(a)!;
      const valid = i && acc.memberships.some((m) => m.instituteId === i);
      setInstituteId(valid ? i : (acc.memberships[0]?.instituteId ?? null));
    }
    setReady(true);
  }, []);

  const signIn = useCallback(
    (id: string) => {
      const acc = findAccount(id);
      if (!acc) return;
      write(ACCOUNT_KEY, id);
      const inst = acc.memberships[0]?.instituteId ?? null;
      write(INSTITUTE_KEY, inst);
      setAccountId(id);
      setInstituteId(inst);
      router.push(acc.landing);
    },
    [router],
  );

  const signOut = useCallback(() => {
    write(ACCOUNT_KEY, null);
    write(INSTITUTE_KEY, null);
    setAccountId(null);
    setInstituteId(null);
    router.push("/demo/login");
  }, [router]);

  const setInstitute = useCallback((id: string) => {
    write(INSTITUTE_KEY, id);
    setInstituteId(id);
  }, []);

  const account = accountId ? (findAccount(accountId) ?? null) : null;
  const role = useMemo<DemoRole | null>(() => {
    if (!account) return null;
    if (account.memberships.length === 0) return "none";
    const m = account.memberships.find((x) => x.instituteId === instituteId);
    return m?.role ?? account.memberships[0]?.role ?? null;
  }, [account, instituteId]);

  const value = useMemo<SessionValue>(
    () => ({ ready, account, instituteId, role, signIn, signOut, setInstitute }),
    [ready, account, instituteId, role, signIn, signOut, setInstitute],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemoSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDemoSession must be used inside DemoSessionProvider");
  return v;
}

/** Roles allowed to see a given area, mirroring the real middleware map. */
export const AREA_ROLES: Record<string, DemoRole[]> = {
  platform: ["owner"],
  institute: ["institute_admin"],
  teacher: ["teacher", "institute_admin"],
  app: ["student", "teacher", "institute_admin", "owner"],
};

export function isPlatformOwner(acc: DemoAccount | null): boolean {
  return !!acc?.memberships.some((m) => m.instituteId === PLATFORM_ID && m.role === "owner");
}

export { ACCOUNTS };
