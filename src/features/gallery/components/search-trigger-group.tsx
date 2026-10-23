"use client";

import { useEffect, useRef } from "react";
import { SearchPopover } from "@/features/search/components/search-popover";
import { ImagePromptLauncher } from "@/features/image-to-prompt/components/image-prompt-launcher";

interface SearchTriggerGroupProps {
  query: string;
  filters: string;
  userId?: string | null;
}

/** Owns the search input ref so ⌘K/Ctrl+K can focus it directly, opening the dropdown in place. */
export function SearchTriggerGroup({ query, filters, userId = null }: SearchTriggerGroupProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return <SearchPopover query={query} filters={filters} inputRef={inputRef} endAdornment={(close, searchOpen) => <ImagePromptLauncher userId={userId} onOpen={close} announcementAllowed={!searchOpen && !query && !filters} />} />;
}
