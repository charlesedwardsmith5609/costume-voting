// Route handlers read NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Point them at the
// test project for this file only, and give admin routes a test password and session secret. Importing helpers first runs its production guard and
// test_marker check against the real env values, before they are replaced here.
import { afterAll, vi } from "vitest";
import "../db/helpers";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.TEST_SUPABASE_URL!);
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!);
// Admin routes: fixed test values, never the real ones.
vi.stubEnv("ADMIN_PASSWORD", "test-admin-password");
vi.stubEnv("SESSION_SECRET", "test-session-secret-0123456789abcdef");
afterAll(() => vi.unstubAllEnvs());
