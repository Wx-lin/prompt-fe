import { readFile } from "node:fs/promises";
import path from "node:path";
import GithubSlugger from "github-slugger";
import { toString } from "mdast-util-to-string";
import remarkParse from "remark-parse";
import { unified } from "unified";

export function getGuideSections(markdown: string) {
  const tree = unified().use(remarkParse).parse(markdown);
  const slugger = new GithubSlugger();
  return tree.children.flatMap((node) => {
    if (node.type !== "heading" || node.depth !== 2 || !node.position) return [];
    const title = toString(node);
    return [{ title, id: slugger.slug(title || "section"), line: node.position.start.line }];
  });
}

export async function loadGuide() {
  const markdown = await readFile(path.join(process.cwd(), "docs", "user-guide.md"), "utf8");
  const sections = getGuideSections(markdown);
  return { markdown, sections };
}
