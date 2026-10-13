import { expect, it, vi, afterEach } from "vitest";
import PromptRoute from "@/app/[locale]/prompt/[id]/page";
import PromptModalRoute from "@/app/[locale]/@modal/(.)prompt/[id]/page";
import { getRecommendations } from "./recommendations";
vi.mock("@/features/prompt-detail/components/detail-page", () => ({ DetailPage: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn(), getTranslations: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSessionToken: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/api/client", () => ({ getPromptDetail: vi.fn().mockResolvedValue({ id: "real", title: "Real detail" }) }));
vi.mock("./recommendations", () => ({ getRecommendations: vi.fn() }));
afterEach(() => vi.clearAllMocks());
it.each([PromptRoute, PromptModalRoute])("uses real recommendations in each detail route without demo fallback", async route => {
  vi.mocked(getRecommendations).mockResolvedValueOnce([]);
  const result = await route({ params: Promise.resolve({ locale: "zh", id: "real" }) });
  expect(getRecommendations).toHaveBeenCalledWith("real");
  expect(result.props.recommendations).toEqual([]);
});
