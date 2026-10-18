// Route handlers read NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Point them at the
// test project for this file only. Importing helpers first runs its production guard and
// test_marker check against the real env values, before they are replaced here.
import { afterAll, vi } from "vitest";
import "../db/helpers";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.TEST_SUPABASE_URL!);
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!);
afterAll(() => vi.unstubAllEnvs());
