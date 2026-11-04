"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Dialog } from "@base-ui/react/dialog";
import { Plus, Search, Pencil, Trash2, UserRound } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { markCharacterFreshStart } from "@/features/character-builder/character-draft-scope";
import { CharacterSelect } from "@/features/character-builder/character-select";
import { OFFICIAL_CHARACTERS } from "./official-characters";
import styles from "./character-library.module.css";

type Asset = Readonly<{ id: string | number; name: string; has_preview: boolean }>;
type Props = Readonly<{ locale: string; authenticated: boolean; initialTab?: "official" | "mine" }>;

function isAsset(value: unknown): value is Asset {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (typeof record.id === "string" || typeof record.id === "number") && typeof record.name === "string" && typeof record.has_preview === "boolean";
}

function matchesAge(filter: string, value: string): boolean {
  if (filter === "all") return true;
  const age = Number.parseInt(value, 10);
  if (!Number.isFinite(age)) return false;
  if (filter === "under20") return age < 20;
  if (filter === "20s") return age >= 20 && age < 30;
  if (filter === "30s") return age >= 30 && age < 40;
  if (filter === "40to59") return age >= 40 && age < 60;
  if (filter === "60plus") return age >= 60;
  return false;
}

export function CharacterLibrary({ locale, authenticated, initialTab = "official" }: Props) {
  const en = locale === "en";
  const tr = (zh: string, english: string) => en ? english : zh;
  const [tab, setTab] = useState<"official" | "mine">(initialTab);
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState("all");
  const [age, setAge] = useState("all");
  const [style, setStyle] = useState("all");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(initialTab === "mine" && authenticated);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [moreError, setMoreError] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (tab !== "mine" || !authenticated) return;
    const controller = new AbortController();
    void fetch("/api/character-assets", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 401 ? "session" : "load");
        const body: unknown = await response.json();
        if (!body || typeof body !== "object" || !("data" in body) || !Array.isArray(body.data) || !body.data.every(isAsset)) throw new Error("load");
        setAssets(body.data); setOffset(body.data.length); setHasMore(body.data.length === 100); setMoreError(false);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(err instanceof Error && err.message === "session" ? "session" : "load");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [tab, authenticated, attempt]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true); setMoreError(false);
    try {
      const response = await fetch(`/api/character-assets?limit=100&offset=${offset}`, { cache: "no-store" });
      if (!response.ok) throw new Error("load");
      const body: unknown = await response.json();
      if (!body || typeof body !== "object" || !("data" in body) || !Array.isArray(body.data) || !body.data.every(isAsset)) throw new Error("load");
      const page: Asset[] = body.data;
      setAssets((previous) => [...previous, ...page.filter((item) => !previous.some((existing) => String(existing.id) === String(item.id)))]);
      setOffset((previous) => previous + page.length); setHasMore(page.length === 100);
    } catch { setMoreError(true); } finally { setLoadingMore(false); }
  }

  async function deleteAsset() {
    if (!deleteTarget || deleting) return;
    setDeleting(true); setDeleteError("");
    try {
      const response = await fetch(`/api/character-assets/${encodeURIComponent(String(deleteTarget.id))}`, { method: "DELETE" });
      if (!response.ok) throw new Error(response.status === 401 ? "session" : "delete");
      setAssets((previous) => previous.filter((asset) => String(asset.id) !== String(deleteTarget.id)));
      setOffset((previous) => Math.max(0, previous - 1));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error && err.message === "session" ? tr("登录已过期，请重新登录。", "Your session has expired. Please sign in again.") : tr("删除失败，请重试。", "Could not delete. Please try again."));
    } finally { setDeleting(false); }
  }

  const query = search.trim().toLocaleLowerCase();
  const official = useMemo(() => OFFICIAL_CHARACTERS.filter((character) =>
    (gender === "all" || character.gender === gender) && (style === "all" || character.style === style) &&
    matchesAge(age, character.values.age) &&
    (!query || `${character.name} ${character.englishName} ${character.values.regionalStyle} ${character.values.genre}`.toLocaleLowerCase().includes(query)),
  ), [gender, age, style, query]);
  const personal = assets.filter((asset) => !query || asset.name.toLocaleLowerCase().includes(query));

  return <main className={styles.main}>
    <Link className={styles.back} href="/">← {tr("返回首页", "Back to home")}</Link>
    <div className={styles.heading}><div><h1>{tr("角色库", "Character library")}</h1><p>{tr("选择官方角色开始创作，或创建属于自己的角色。", "Start with an official character or create your own.")}</p></div><Link className={styles.create} href="/character-setting?new=1" onClick={() => markCharacterFreshStart("?new=1")}><Plus size={17} />{tr("创建角色", "Create character")}</Link></div>
    <div className={styles.toolbar}>
      <div className={styles.tabs} role="tablist" aria-label={tr("角色库", "Character libraries")}>
        <button type="button" role="tab" aria-selected={tab === "official"} onClick={() => setTab("official")}>{tr("官方角色库", "Official characters")}</button>
        <button type="button" role="tab" aria-selected={tab === "mine"} onClick={() => { if (tab !== "mine") { setLoading(authenticated); setError(""); setTab("mine"); } }}>{tr("我的角色库", "My characters")}</button>
      </div>
      <div className={styles.filters}>
        {tab === "official" && <>
          <div className={styles.filterControl}><CharacterSelect label={tr("性别", "Gender")} value={gender} onChange={setGender} options={[{ value: "all", label: tr("全部性别", "All genders") }, { value: "female", label: tr("女性", "Women") }, { value: "male", label: tr("男性", "Men") }]} /></div>
          <div className={styles.filterControl}><CharacterSelect label={tr("年龄段", "Age range")} value={age} onChange={setAge} options={[{ value: "all", label: tr("全部年龄", "All ages") }, { value: "under20", label: tr("20岁以下", "Under 20") }, { value: "20s", label: tr("20–29岁", "20–29") }, { value: "30s", label: tr("30–39岁", "30–39") }, { value: "40to59", label: tr("40–59岁", "40–59") }, { value: "60plus", label: tr("60岁以上", "60 and over") }]} /></div>
          <div className={styles.filterControl}><CharacterSelect label={tr("风格", "Style")} value={style} onChange={setStyle} options={[{ value: "all", label: tr("全部风格", "All styles") }, { value: "modern", label: tr("现代", "Modern") }, { value: "ancient", label: tr("古风", "Historical") }, { value: "scifi", label: tr("科幻", "Sci-fi") }]} /></div>
        </>}
        <label className={styles.search}><Search size={16} aria-hidden="true" /><span className={styles.srOnly}>{tr("搜索角色", "Search characters")}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr("搜索角色名称、风格", "Search characters")} /></label>
      </div>
    </div>
    <section className={styles.results} role="tabpanel" aria-label={tab === "official" ? tr("官方角色库", "Official characters") : tr("我的角色库", "My characters")}>
      {tab === "official" ? <>{official.length ? <div className={styles.grid}>{official.map((character) => <article key={character.id} className={styles.character}>
        <Link className={styles.characterLink} href={`/character-setting?preset=${encodeURIComponent(character.id)}`} aria-label={tr(`编辑${character.name}`, `Edit ${character.englishName}`)}>
          <div className={styles.stage}><div className={styles.light} /><div className={styles.platform} /><Image src={character.image} alt="" width={1024} height={1536} sizes="(max-width: 600px) 50vw, (max-width: 900px) 33vw, 25vw" /></div>
          <span className={styles.name}>{en ? character.englishName : character.name}</span><span className={styles.edit}><Pencil size={14} />{tr("编辑角色", "Edit character")}</span>
        </Link>
      </article>)}</div> : <p className={styles.empty}>{tr("没有找到符合条件的角色。", "No characters match your filters.")}</p>}</> :
      !authenticated ? <div className={styles.emptyState}><UserRound size={27} aria-hidden="true" /><strong>{tr("登录后查看你的角色", "Sign in to view your characters")}</strong><p>{tr("保存的角色会出现在这里，方便随时继续编辑。", "Your saved characters will appear here.")}</p><Link href="/login?returnTo=%2Fcharacter-library%3Ftab%3Dmine" className={styles.login}>{tr("登录", "Sign in")}</Link></div> :
      loading ? <p className={styles.empty} role="status">{tr("正在加载角色…", "Loading characters…")}</p> :
      error ? <div className={styles.emptyState} role="alert"><strong>{error === "session" ? tr("登录已过期，请重新登录", "Your session has expired") : tr("角色加载失败，请重试", "Unable to load characters")}</strong>{error === "session" ? <Link className={styles.login} href="/login?returnTo=%2Fcharacter-library%3Ftab%3Dmine">{tr("登录", "Sign in")}</Link> : <button type="button" className={styles.retry} onClick={() => { setError(""); setLoading(true); setAttempt((value) => value + 1); }}>{tr("重试", "Retry")}</button>}</div> :
      personal.length ? <div className={styles.grid}>{personal.map((asset) => <article key={asset.id} className={styles.character}><Link className={styles.characterLink} href={`/character-setting?asset=${encodeURIComponent(String(asset.id))}`} aria-label={tr(`编辑${asset.name}`, `Edit ${asset.name}`)}><div className={styles.stage}><div className={styles.light} /><div className={styles.platform} />{asset.has_preview ? <Image src={`/api/character-assets/${encodeURIComponent(String(asset.id))}/image`} alt={asset.name} width={1024} height={1536} unoptimized /> : <div className={styles.placeholder}><UserRound size={46} strokeWidth={1.2} /><span>{tr("尚未生成预览", "No preview yet")}</span></div>}</div><span className={styles.name}>{asset.name}</span><span className={styles.edit}><Pencil size={14} />{tr("编辑角色", "Edit character")}</span></Link><button type="button" className={styles.deleteButton} aria-label={tr(`删除${asset.name}`, `Delete ${asset.name}`)} onClick={() => { setDeleteError(""); setDeleteTarget(asset); }}><Trash2 size={16} /></button></article>)}</div> : <div className={styles.emptyState}><UserRound size={27} aria-hidden="true" /><strong>{query ? tr("没有找到符合条件的角色", "No matching characters") : tr("还没有保存的角色", "No saved characters yet")}</strong><p>{tr("从官方角色开始，或创建一个新角色。", "Start with an official character or create a new one.")}</p><Link className={styles.login} href="/character-setting?new=1" onClick={() => markCharacterFreshStart("?new=1")}>{tr("创建角色", "Create character")}</Link></div>}
    </section>
    {tab === "mine" && authenticated && !loading && !error && hasMore && <div className={styles.more}>{query && <p>{tr("搜索当前已加载的角色。", "Searching loaded characters.")}</p>}{moreError && <p role="alert">{tr("加载失败，请重试。", "Could not load more. Try again.")}</p>}<button type="button" className={styles.moreButton} disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? tr("加载中…", "Loading…") : tr("加载更多", "Load more")}</button></div>}
    <Dialog.Root open={deleteTarget !== null} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}><Dialog.Portal><Dialog.Backdrop className={styles.dialogBackdrop} /><Dialog.Popup className={styles.dialog}><Dialog.Title>{tr("删除角色？", "Delete character?")}</Dialog.Title><Dialog.Description>{tr(`“${deleteTarget?.name ?? ""}”及其保存的预览图将从你的角色库中删除，此操作无法撤销。`, `“${deleteTarget?.name ?? ""}” and its saved preview will be removed. This cannot be undone.`)}</Dialog.Description>{deleteError && <p className={styles.deleteError} role="alert">{deleteError}</p>}<div className={styles.dialogActions}><Dialog.Close disabled={deleting}>{tr("取消", "Cancel")}</Dialog.Close><button type="button" disabled={deleting} onClick={() => void deleteAsset()}>{deleting ? tr("删除中…", "Deleting…") : tr("确认删除", "Delete")}</button></div></Dialog.Popup></Dialog.Portal></Dialog.Root>
  </main>;
}
