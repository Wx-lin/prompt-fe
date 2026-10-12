"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Icon } from "@/components/icons/icon";
import { Link, useRouter } from "@/i18n/navigation";
import type { GalleryCard, PromptDetail } from "@/types/prompt";
import { AuthorSource } from "./author-source";
import styles from "./detail-page.module.css";

export function DetailPage({ prompt, recommendations = [] }: { prompt: PromptDetail | GalleryCard; recommendations?: GalleryCard[] }) {
  const t = useTranslations("detail");
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  // Only the single-prompt detail endpoint returns is_liked/is_collected (gallery/search cards
  // don't), so default to false when this component is rendered from a GalleryCard.
  const [liked, setLiked] = useState("is_liked" in prompt ? prompt.is_liked : false);
  const [likeCount, setLikeCount] = useState(prompt.like_count);
  const [likeBusy, setLikeBusy] = useState(false);
  const [collected, setCollected] = useState("is_collected" in prompt ? prompt.is_collected : false);
  const [collectBusy, setCollectBusy] = useState(false);
  // Mobile uses the image ratio for its stacked layout. Desktop keeps a stable media stage
  // so loading an image or switching between portrait and landscape never resizes the dialog.
  const [aspectRatio, setAspectRatio] = useState<number | null>(
    "imageWidth" in prompt && prompt.imageWidth && prompt.imageHeight ? prompt.imageWidth / prompt.imageHeight : null,
  );
  const images = "images" in prompt ? prompt.images : [];
  const imageCount = images.length > 0 ? images.length : 1;
  const image = images.length > 0 ? images[imageIndex]?.image_url ?? "" : "image" in prompt ? prompt.image : prompt.thumbnail_url ?? "";
  const promptText = "prompt_text" in prompt ? prompt.prompt_text : prompt.promptText ?? "";

  function closeDetail(event?: MouseEvent<HTMLAnchorElement>) {
    event?.preventDefault();
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  function showPrevImage() {
    setImageIndex((index) => (index - 1 + imageCount) % imageCount);
  }

  function showNextImage() {
    setImageIndex((index) => (index + 1) % imageCount);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDetail();
      } else if (event.key === "ArrowLeft" && imageCount > 1) {
        showPrevImage();
      } else if (event.key === "ArrowRight" && imageCount > 1) {
        showNextImage();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageCount]);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  async function sharePrompt() {
    const shareData = { title: prompt.title, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else await navigator.clipboard.writeText(shareData.url);
      setShared(true);
      window.setTimeout(() => setShared(false), 1600);
    } catch {
      setShared(false);
    }
  }

  async function toggleLike() {
    if (likeBusy) return;
    setLikeBusy(true);
    const nextLiked = !liked;
    try {
      const response = await fetch(`/api/prompts/${prompt.id}/like`, { method: nextLiked ? "POST" : "DELETE" });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error("like failed");
      setLiked(nextLiked);
      setLikeCount((count) => count + (nextLiked ? 1 : -1));
    } catch {
      // Keep the previous state; the button simply doesn't toggle on failure.
    } finally {
      setLikeBusy(false);
    }
  }

  async function toggleCollect() {
    if (collectBusy) return;
    setCollectBusy(true);
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
      setCollectBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.mobileHeader}>
        <Link href="/" onClick={closeDetail} className={styles.back} aria-label={t("backToGallery")}>‹</Link><BrandLogo />
        <button type="button" aria-label={t("moreActions")}>···</button>
      </header>
      <Link href="/" onClick={closeDetail} className={styles.backdrop} aria-label={t("closeDetail")} />
      <article className={styles.dialog}>
        <section className={styles.artworkPane} style={aspectRatio ? ({ "--art-ratio": aspectRatio } as CSSProperties) : undefined}>
          {image && (
            <Image
              key={imageIndex}
              src={image}
              alt={prompt.title}
              fill
              priority
              sizes="(max-width: 760px) 100vw, 64vw"
              unoptimized={image.startsWith("http")}
              onLoad={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget;
                if (naturalWidth > 0 && naturalHeight > 0) setAspectRatio(naturalWidth / naturalHeight);
              }}
            />
          )}
          <Link href="/" onClick={closeDetail} className={styles.desktopClose} aria-label={t("closeDetail")}>×</Link>
          {image && <a href={image} download={`${prompt.title}.jpg`} className={styles.download} aria-label={t("downloadImage")}><Icon name="download" size={19} /></a>}
          {imageCount > 1 && (
            <>
              <button type="button" className={`${styles.imageNav} ${styles.imageNavPrev}`} aria-label={t("prevImage")} onClick={showPrevImage}>
                <Icon name="arrow" size={20} />
              </button>
              <button type="button" className={`${styles.imageNav} ${styles.imageNavNext}`} aria-label={t("nextImage")} onClick={showNextImage}>
                <Icon name="arrow" size={20} style={{ transform: "rotate(180deg)" }} />
              </button>
            </>
          )}
          <span className={styles.imageCount}>{imageIndex + 1} / {imageCount}</span>
        </section>
        <section className={styles.details}>
          <AuthorSource authorName={prompt.author_name} authorAvatarUrl={"author_avatar_url" in prompt ? prompt.author_avatar_url : null} sourceUrl={"source_url" in prompt ? prompt.source_url : null} />
          <h1>{prompt.title}</h1>
          <div className={styles.tags}><span>{prompt.category}</span>{prompt.models.map((model) => <span key={model}>{model}</span>)}</div>
          <section className={styles.promptSection}>
            <h2>{t("prompt")} <small>{t("promptEnglish")}</small></h2>
            <p>{promptText || t("promptEmpty")}</p>
            {"description" in prompt && prompt.description && <p className={styles.description}>{prompt.description}</p>}
          </section>
          <button className={styles.copy} type="button" onClick={copyPrompt} data-testid="prompt-copy"><Icon name="copy" size={18} />{copied ? t("promptCopied") : t("copyPrompt")}</button>
          <div className={styles.engagement}>
            <button
              type="button"
              className={liked ? styles.active : undefined}
              aria-pressed={liked}
              disabled={likeBusy}
              onClick={toggleLike}
            >
              <Icon name="heart" size={18} />{likeCount}
            </button>
            <button
              type="button"
              className={collected ? styles.active : undefined}
              aria-pressed={collected}
              disabled={collectBusy}
              onClick={toggleCollect}
            >
              <Icon name="bookmark" size={18} />{collected ? t("bookmarked") : t("bookmark")}
            </button>
            <button type="button" onClick={sharePrompt}><Icon name="share" size={18} />{shared ? t("shared") : t("share")}</button>
          </div>
          {recommendations.length > 0 && <section className={styles.recommendations}><h2>{t("recommendations")}</h2><div>{recommendations.slice(0, 3).map((item) => <Link href={`/prompt/${item.id}`} key={item.id}><Image src={item.image} alt={item.title} width={120} height={120} /><span>{item.title}</span></Link>)}</div></section>}
        </section>
        <div className={styles.mobileCopy}><button className={styles.copy} type="button" onClick={copyPrompt} data-testid="prompt-copy"><Icon name="copy" size={18} />{copied ? t("promptCopied") : t("copyPrompt")}</button></div>
      </article>
    </main>
  );
}
