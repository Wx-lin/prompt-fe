import { notFound } from "next/navigation";
import GalleryRoute from "@/features/gallery/components/gallery-route";
import { isCurrentCategory } from "@/features/gallery/data/categories";
import { galleryMetadata, type SearchValues } from "@/lib/seo/metadata";

type Props = { params: Promise<{ locale: string; category: string }>; searchParams: Promise<SearchValues> };
export async function generateMetadata({ params, searchParams }: Props) {
  const { locale, category } = await params;
  return galleryMetadata(locale, await searchParams, category);
}
export default async function CategoryRoute({ params, searchParams }: Props) {
  const { category } = await params;
  if (!isCurrentCategory(category)) notFound();
  return GalleryRoute({ params, searchParams: Promise.resolve({ ...await searchParams, category }), landingCategory: category });
}
