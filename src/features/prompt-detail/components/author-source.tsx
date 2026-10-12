"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { getSourcePlatform } from "../lib/source-platform";
import type { SourcePlatform } from "../lib/source-platform";
import styles from "./author-source.module.css";

const platformIcons: Record<SourcePlatform, string> = {
  xiaohongshu: "/brand-icons/xiaohongshu.svg",
  weibo: "/brand-icons/sinaweibo.svg",
  kuaishou: "/brand-icons/kuaishou.svg",
};

function defaultAvatarFor(seed: string): string {
  let hash = 2166136261;
  for (const character of seed) {
    hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619);
  }
  return `/default-avatars/${(hash & 1) === 0 ? "female" : "male"}.png`;
}

function AuthorAvatar({ name, url }: { name: string; url?: string | null }) {
  const [failed, setFailed] = useState(false);
  let validUrl: string | null = null;
  try {
    if (url && new URL(url).protocol === "https:") validUrl = url;
  } catch {
    // Invalid legacy URLs use the neutral fallback.
  }

  return (
    <span className={styles.avatar}>
      {validUrl && !failed ? (
        // Author photos come from platform media hosts or our COS bucket.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={validUrl} alt={name} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        // The choice is stable for a given displayed author, including after refresh.
        // eslint-disable-next-line @next/next/no-img-element
        <img data-testid="default-author-avatar" src={defaultAvatarFor(name)} alt="" />
      )}
    </span>
  );
}

export function AuthorSource({ authorName, authorAvatarUrl, sourceUrl }: { authorName: string | null; authorAvatarUrl?: string | null; sourceUrl?: string | null }) {
  const t = useTranslations("detail");
  const source = getSourcePlatform(sourceUrl);
  const author = authorName?.trim() || t("aiCreator");
  const authorContent = (
    <>
      <AuthorAvatar key={authorAvatarUrl || "fallback"} name={author} url={authorAvatarUrl} />
      <span className={styles.identity}>
        <strong>{author}</strong>
        {source ? <span className={styles.platformIcon} data-platform={source.platform} style={{ "--icon-url": `url(${platformIcons[source.platform]})` } as React.CSSProperties} role="img" aria-label={t(source.platform)} /> : <small>{t("aiCreator")}</small>}
      </span>
    </>
  );

  return (
    <div className={styles.authorRow}>
      {source ? (
        <a className={styles.authorLink} href={source.url} target="_blank" rel="noopener noreferrer" aria-label={`${author} · ${t(source.platform)} · ${t("viewOriginal")}`}>
          {authorContent}
        </a>
      ) : <div className={styles.authorLink}>{authorContent}</div>}
      {source && <a className={styles.originalLink} href={source.url} target="_blank" rel="noopener noreferrer">{t("viewOriginal")} <span aria-hidden="true">↗</span></a>}
    </div>
  );
}
