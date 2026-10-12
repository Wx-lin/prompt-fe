import { createNavigation } from "next-intl/navigation";
import { routing } from "@/i18n/routing";

/**
 * Locale-aware drop-ins for next/link and next/navigation. Every component that
 * builds an internal href (gallery filters, search results, prompt detail links,
 * login) must import these instead of the plain next/* versions so the active
 * locale prefix is preserved automatically.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
