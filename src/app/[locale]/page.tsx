import GalleryRoute from "@/features/gallery/components/gallery-route";
import { galleryMetadata, type SearchValues } from "@/lib/seo/metadata";
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchValues> };
export async function generateMetadata({ params, searchParams }: Props) {
  return galleryMetadata((await params).locale, await searchParams);
}
export default async function Home(props: Props) { return GalleryRoute(props); }
