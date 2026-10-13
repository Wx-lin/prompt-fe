export function safeReturnTo(value: string | null): "/publish" | "/my-works" | "/" {
  return value === "/publish" || value === "/my-works" ? value : "/";
}
