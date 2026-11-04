"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "./creation-image-loading.module.css";

type Props = { status: "queued" | "running"; createdAt: string };

// The provider does not send progress. This is a bounded visual estimate based
// on the persisted task time, never an assertion that generation is complete.
function estimate(createdAt: string, now: number): number {
  const start = Date.parse(createdAt);
  const elapsed = Number.isFinite(start) ? Math.max(0, now - start) : 0;
  return Math.min(95, 5 + Math.floor(elapsed / 2000));
}

export function CreationImageLoading({ status, createdAt }: Props) {
  const t = useTranslations("promptCreation");
  const [progress, setProgress] = useState(5);

  useEffect(() => {
    if (status !== "running") return;
    const update = () => setProgress(estimate(createdAt, Date.now()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [createdAt, status]);

  return <div className={styles.container}>
    <div className={styles.state} role="status">{t(status === "queued" ? "imageQueue" : "imageGenerating")}</div>
    <div className={styles.stage}>
      <div className={styles.dots} aria-hidden="true" />
      {status === "running" && <div
        className={styles.badge}
        role="progressbar"
        aria-label={t("imageProgressLabel")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-valuetext={t("imageProgressEstimate", { percent: progress })}
      >{progress}%</div>}
    </div>
  </div>;
}
