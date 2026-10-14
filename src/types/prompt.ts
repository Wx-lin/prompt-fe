export interface PromptListItem {
  id: string;
  title: string;
  category: string;
  models: string[];
  thumbnail_url: string | null;
  like_count: number;
  view_count: number;
  author_name: string | null;
  created_at: string;
}

export interface PromptListResponse {
  items: PromptListItem[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface PromptImage {
  id: string;
  image_url: string;
  thumbnail_url: string | null;
  sort_order: number;
}

export interface PromptDetail extends PromptListItem {
  author_avatar_url: string | null;
  prompt_text: string;
  description: string | null;
  source_url: string | null;
  collect_count: number;
  images: PromptImage[];
  is_liked: boolean;
  is_collected: boolean;
}

export interface Category {
  label_en?: string;
  order?: number;
  key: string;
  label: string;
  count: number;
}

export interface GalleryCard extends PromptListItem {
  image: string;
  imageWidth: number;
  imageHeight: number;
  promptText?: string;
}

export interface CurrentUser {
  id: string;
  email: string | null;
  nickname: string | null;
  avatar_url: string | null;
  created_at: string;
}
