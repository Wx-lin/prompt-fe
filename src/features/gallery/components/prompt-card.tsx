"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Link, useRouter } from "@/i18n/navigation";
import type { GalleryCard } from "@/types/prompt";
import { isOverlongImage } from "@/features/gallery/lib/image-visibility";
import styles from "./prompt-card.module.css";
import skeletonStyles from "./gallery-skeleton.module.css";

interface PromptCardProps {
  prompt: GalleryCard;
  previewHover?: boolean;
  onOverlongImage?: (image: string) => void;
}

const defaultAspectRatio = 3 / 4;

export function PromptCard({ prompt, previewHover = false, onOverlongImage }: PromptCardProps) {
  const t = useTranslations("card");
  const tCategories = useTranslations("categories");
  const router = useRouter();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  // The gallery feed endpoint doesn't return is_collected (only the single-prompt detail
  // endpoint does), so a card can't know its real collected state on load. This toggle is
  // therefore session-local visual feedback only — it resets to unbookmarked on refresh.
  const [collected, setCollected] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  // Start from the best ratio we already know (real pixel size when the backend provides one,
  // the curated demo ratio otherwise) so the card reserves roughly the right height before the
  // image finishes loading, then refine it to the exact natural ratio once it does — this mirrors
  // how masonry feeds like Xiaohongshu size each tile to the photo instead of cropping it to a
  // fixed box.
  const initialRatio = prompt.imageWidth && prompt.imageHeight ? prompt.imageWidth / prompt.imageHeight : defaultAspectRatio;
  const [aspectRatio, setAspectRatio] = useState(initialRatio);
  const [settledImage, setSettledImage] = useState<string | null>(null);
  const imageLoading = Boolean(prompt.image) && settledImage !== prompt.image;
  const detailHref = `/prompt/${prompt.id}`;

  // 卡片上展示分类而不是模型标签（models 对普通浏览用户没有筛选价值，分类才是
  // 浏览发现场景下有用的信息）；分类 key 不在翻译表里时降级显示原始 key，
  // 避免 next-intl 找不到 key 时抛错导致整张卡片渲染失败。
  function categoryLabel(category: string): string {
    try {
      return tCategories(category as Parameters<typeof tCategories>[0]);
    } catch {
      return category;
    }
  }

  async function copyPrompt() {
    if (!prompt.promptText) {
      router.push(detailHref);
      return;
    }

    try {
      await navigator.clipboard.writeText(prompt.promptText);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1600);
    } catch {
      setCopyState("failed");
    }
  }

  async function toggleBookmark() {
    if (bookmarkBusy) return;
    setBookmarkBusy(true);
    const nextCollected = !collected;
    try {
      const response = await fetch(`/api/prompts/${prompt.id}/collect`, { method: nextCollected ? "POST" : "DELETE" });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error("collect failed");
      setCollected(nextCollected);
    } catch {
      // Keep the previous state; the button simply doesn't toggle on failure.
    } finally {
      setBookmarkBusy(false);
    }
  }

  return (
    <article className={`${styles.card} ${previewHover ? styles.previewHover : ""}`}>
      <div className={styles.artworkFrame} style={{ aspectRatio }}>
        <Link className={styles.artworkLink} href={detailHref} aria-label={t("viewAriaLabel", { title: prompt.title })}>
          {imageLoading && <div className={`${skeletonStyles.image} ${skeletonStyles.imagePlaceholder}`} aria-hidden="true" data-testid="gallery-image-skeleton" />}
          {prompt.image ? (
            <Image
              className={styles.artwork}
              src={prompt.image}
              alt={prompt.title}
              fill
              sizes="(max-width: 680px) 48vw, (max-width: 1060px) 31vw, 19vw"
              unoptimized={prompt.image.startsWith("/demo/") || prompt.image.startsWith("http")}
              onLoad={(event) => {
                setSettledImage(prompt.image);
                const { naturalWidth, naturalHeight } = event.currentTarget;
                if (isOverlongImage(naturalWidth, naturalHeight)) {
                  onOverlongImage?.(prompt.image);
                  return;
                }
                if (naturalWidth > 0 && naturalHeight > 0) setAspectRatio(naturalWidth / naturalHeight);
              }}
              onError={() => setSettledImage(prompt.image)}
            />
          ) : (
            <div className={styles.missingImage} role="img" aria-label={t("imageUnavailable", { title: prompt.title })} />
          )}
        </Link>

        <div className={styles.hoverTools} data-card-hover>
          <button
            className={`${styles.bookmark} ${collected ? styles.bookmarked : ""}`}
            type="button"
            aria-label={collected ? t("bookmarkedAriaLabel", { title: prompt.title }) : t("bookmarkAriaLabel", { title: prompt.title })}
            aria-pressed={collected}
            disabled={bookmarkBusy}
            onClick={toggleBookmark}
          >
            <Icon name="bookmark" size={18} />
          </button>
          <div className={styles.cardAuthor}>
            <span className={styles.avatar} aria-hidden="true">{(prompt.author_name ?? "A").slice(0, 1)}</span>
            <span>{prompt.author_name ?? t("defaultAuthor")}</span>
          </div>
          <div className={styles.overlayCaption}>
            <strong>{prompt.title}</strong>
            <span>{categoryLabel(prompt.category)}</span>
          </div>
          <div className={styles.cardActions}>
            <Link href={detailHref} className={styles.viewButton} data-testid="prompt-view-link">
              <Icon name="eye" size={17} />{t("view")}
            </Link>
            <button className={styles.copyButton} type="button" onClick={copyPrompt}>
              <Icon name="copy" size={16} />{copyState === "copied" ? t("copied") : copyState === "failed" ? t("copyFailed") : t("copy")}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.cardText}>
        <Link className={styles.title} href={detailHref}>{prompt.title}</Link>
        <p className={styles.model}>{categoryLabel(prompt.category)}</p>
      </div>
    </article>
  );
}
