export interface Submission {
  id: string;
  title: string;
  review_status: "pending" | "approved" | "rejected";
  published: boolean;
  image_urls: string[];
  review_note: string | null;
  created_at: string;
}

export interface SubmissionFeed {
  items: Submission[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface SubmissionUpload {
  id: string;
  image_url: string;
}
