"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import type { Submission, SubmissionFeed } from "@/types/submission";
import styles from "./submissions.module.css";

export function MyWorks({ submitted = false }: {
  submitted?: boolean;
}) {
  const t = useTranslations("submissions");
  const router = useRouter();
  const [items, setItems] = useState<Submission[]>([]);
  const [nextPage, setNextPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const acceptFeed = useCallback((feed: SubmissionFeed, page: number) => {
    setItems(current => page === 1 ? feed.items : [...current, ...feed.items]);
    setMore(feed.has_more);
    setNextPage(page + 1);
    setBusy(false);
  }, []);
  const handleFailure = useCallback((error: unknown) => {
    if (error instanceof Error && error.message === "unauthorized") router.push("/login?returnTo=/my-works");
    else setError(true);
    setBusy(false);
  }, [router]);
  function load(page: number) {
    setBusy(true);
    setError(false);
    void fetchFeed(page).then(feed => acceptFeed(feed, page)).catch(handleFailure);
  }
  useEffect(() => {
    const controller = new AbortController();
    void fetchFeed(1, controller.signal).then(feed => {
      if (!controller.signal.aborted) acceptFeed(feed, 1);
    }).catch(error => {
      if (!controller.signal.aborted) handleFailure(error);
    });
    return () => controller.abort();
  }, [acceptFeed, handleFailure]);
  return <main className={styles.page}>
    <div className={styles.top}>
      <h1>
        {t("myWorks")}
      </h1>
      <Link href="/publish">
        {t("heading")}
      </Link>
    </div>
    {submitted && <p role="status">
      {t("submitted")}
    </p>}
    {!busy && !error && !items.length && <p>
      {t("empty")}
    </p>}
    <div className={styles.list}>
      {items.map(item => <article key={item.id} className={styles.card}>
        {/* eslint-disable-next-line @next/next/no-img-element -- signed private submission image */}
        {item.image_urls[0] && <img src={item.image_urls[0]} alt="" />}
        <div>
          <h2>
            {item.title}
          </h2>
          <span className={styles.status}>
            {t(item.review_status === "approved" && !item.published ? "offline" : item.review_status)}
          </span>
          {item.review_note && <p>
            {item.review_note}
          </p>}
          <p className={styles.muted}>
            {item.created_at.slice(0, 10)}
          </p>
        </div>
      </article>)}
    </div>
    {busy && <p role="status">
      {t("processing")}
    </p>}
    {error && <div role="alert">
      <p>
        {t("loadError")}
      </p>
      <button className={styles.primary} onClick={() => load(nextPage)}>
        {t("retry")}
      </button>
    </div>}
    {more && !error && <button disabled={busy} className={styles.primary} onClick={() => load(nextPage)}>
      {t("more")}
    </button>}
  </main>;
}

async function fetchFeed(page: number, signal?: AbortSignal): Promise<SubmissionFeed> {
  const response = await fetch(`/api/submissions?page=${page}&page_size=20`, { cache: "no-store", signal });
  if (response.status === 401) throw new Error("unauthorized");
  if (!response.ok) throw new Error("load");
  return response.json();
}
