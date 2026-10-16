"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent } from "react";
import { Popover } from "@base-ui/react/popover";
import { Command } from "cmdk";
import { Icon } from "@/components/icons/icon";
import {
  clearRecentSearches,
  readRecentSearches,
  saveRecentSearch,
  subscribeToRecentSearches,
} from "@/features/search/lib/recent-searches";
import { useRouter } from "@/i18n/navigation";
import styles from "./search-popover.module.css";

const emptyRecentSearches: string[] = [];
function noRecentSearches(): string[] { return emptyRecentSearches; }

export interface SearchPopoverHandle {
  focus: () => void;
}

interface SearchPopoverProps {
  query: string;
  filters: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

/** Inline search: an anchored dropdown next to the trigger, not a full-screen dialog. */
export function SearchPopover({ query: initialQuery, filters, inputRef: externalInputRef }: SearchPopoverProps) {
  const t = useTranslations("header");
  const tSearch = useTranslations("search");
  const router = useRouter();
  const anchorRef = useRef<HTMLDivElement>(null);
  const ownInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef ?? ownInputRef;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [previousQuery, setPreviousQuery] = useState(initialQuery);
  if (previousQuery !== initialQuery) {
    setPreviousQuery(initialQuery);
    setQuery(initialQuery);
  }
  const recentSearches = useSyncExternalStore(subscribeToRecentSearches, readRecentSearches, noRecentSearches);
  const trendingTerms = tSearch.raw("trendingTerms") as string[];

  function resultsHref(value: string) {
    const params = new URLSearchParams(filters);
    params.delete("q");
    if (value.trim()) params.set("q", value.trim());
    return params.size ? `/?${params}` : "/";
  }

  function navigateTo(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    saveRecentSearch(trimmed);
    setOpen(false);
    inputRef.current?.blur();
    router.push(resultsHref(trimmed));
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      navigateTo(query);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen} modal={false}>
      <div ref={anchorRef} className={styles.searchBox}>
        <Icon name="search" size={17} />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleInputKeyDown}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchAriaLabel")}
          className={styles.input}
        />
        {query && (
          <button
            type="button"
            className={styles.clear}
            aria-label={t("clearSearchAriaLabel")}
            onClick={() => {
              setQuery("");
              setOpen(false);
              inputRef.current?.blur();
              if (initialQuery) router.push(resultsHref(""));
            }}
          >
            ×
          </button>
        )}
        <kbd className={styles.shortcutHint} aria-hidden>⌘K</kbd>
      </div>

      <Popover.Portal>
        <Popover.Positioner anchor={anchorRef} side="bottom" align="start" sideOffset={10} className={styles.positioner}>
          <Popover.Popup
            initialFocus={false}
            finalFocus={false}
            className={styles.popup}
            onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
          >
            <Command shouldFilter={false} className={styles.command}>
              <Command.List className={styles.discovery}>
                <section>
                  <div className={styles.sectionHeading}>
                    <h2>{tSearch("recentSearches")}</h2>
                    {recentSearches.length > 0 && (
                      <button type="button" onClick={clearRecentSearches}>{tSearch("clearRecent")}</button>
                    )}
                  </div>
                  {recentSearches.length > 0 ? (
                    <div className={styles.recentTerms}>
                      {recentSearches.map((term) => (
                        <Command.Item key={term} value={term} onSelect={() => navigateTo(term)} className={styles.recentItem}>
                          {term}
                        </Command.Item>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.empty}>{tSearch("recentEmpty")}</p>
                  )}
                </section>

                <section>
                  <div className={styles.sectionHeading}><h2>{tSearch("trending")}</h2></div>
                  <div className={styles.trends}>
                    {trendingTerms.map((term, index) => (
                      <Command.Item key={term} value={term} onSelect={() => navigateTo(term)} className={styles.trendItem}>
                        <b>{String(index + 1).padStart(2, "0")}</b>
                        {term}
                      </Command.Item>
                    ))}
                  </div>
                </section>
              </Command.List>
            </Command>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
