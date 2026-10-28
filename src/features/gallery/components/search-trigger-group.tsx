"use client";

import { useEffect, useRef } from "react";
import { SearchPopover } from "@/features/search/components/search-popover";

interface SearchTriggerGroupProps {
  query: string;
  filters: string;
}

/** Owns the search input ref so ⌘K/Ctrl+K can focus it directly, opening the dropdown in place. */
export function SearchTriggerGroup({ query, filters }: SearchTriggerGroupProps) {
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

  return <SearchPopover query={query} filters={filters} inputRef={inputRef} appearance="gallery" />;
}
