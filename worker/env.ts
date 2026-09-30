export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  TOSS_SECRET: string;
  /** Username that becomes Sal (admin) when it registers. */
  SAL_USERNAME?: string;
};

export type UserRow = {
  id: number;
  username: string;
  balance_cents: number;
  is_sal: number;
  is_bot: number;
  hood: string;
  last_bailout: number;
};

export type MarketRow = {
  id: number;
  slug: string;
  kind: "lmsr" | "toss";
  category: string;
  title: string;
  blurb: string;
  rules: string;
  outcomes: string;
  q: string;
  q0: string | null;
  b: number;
  status: "open" | "resolved";
  winner: number | null;
  closes_at: number | null;
  round_no: number | null;
  featured: number;
  volume_cents: number;
  created_at: number;
  resolved_at: number | null;
  result: string | null;
};

export class HttpError extends Error {
  constructor(public status: 400 | 401 | 403 | 404 | 409, message: string) {
    super(message);
  }
}

/** A statement that fails the whole batch when the previous statement changed no rows. */
export function guard(db: D1Database): D1PreparedStatement {
  return db.prepare("INSERT INTO txn_guard (ok) VALUES (changes())");
}

export function clearGuard(db: D1Database): D1PreparedStatement {
  return db.prepare("DELETE FROM txn_guard");
}

export function isGuardFailure(e: unknown): boolean {
  return String(e).includes("CHECK constraint failed");
}

export type AppEnv = { Bindings: Env; Variables: { user: UserRow | null } };
