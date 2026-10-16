import { expect, it, vi, afterEach } from "vitest";
import PromptRoute, { generateMetadata } from "@/app/[locale]/prompt/[id]/page";
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
  const detail = route === PromptRoute ? result.props.children[1] : result;
  expect(detail.props.recommendations).toEqual([]);
});

it("provides detail language alternatives rather than inheriting homepage alternatives", async () => {
 const metadata = await generateMetadata({ params: Promise.resolve({ locale: "en", id: "real" }) });
 expect(metadata.alternates).toEqual({ canonical: "/en/prompt/real", languages: { zh: "/prompt/real", en: "/en/prompt/real", "x-default": "/prompt/real" } });
});
it("renders valid JSON-LD alongside detail content", async () => {
 vi.mocked(getRecommendations).mockResolvedValueOnce([]);
 const result = await PromptRoute({ params: Promise.resolve({ locale: "zh", id: "real" }) });
 const script = result.props.children[0];
 expect(script.props.type).toBe("application/ld+json");
 expect(JSON.parse(script.props.dangerouslySetInnerHTML.__html)).toMatchObject({ "@type": "CreativeWork", name: "Real detail" });
});
