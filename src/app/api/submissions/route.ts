import { authorize, boundedBody, failure, forward } from "@/lib/submissions/proxy";
import { validSubmission } from "@/lib/submissions/validation";

export async function POST(request: Request) {
  const token = await authorize(request);
  if (token instanceof Response)
    return token;
  const bytes = await boundedBody(request, 128 * 1024).catch(() => null);
  if (!bytes)
    return failure(413);
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  }
  catch {
    return failure(400);
  }
  if (!validSubmission(body))
    return failure(400);
  return forward("", token, JSON.stringify(body));
}

export async function GET(request: Request) {
  const token = await authorize(request, false);
  if (token instanceof Response)
    return token;
  const query = new URL(request.url).searchParams;
  const page = Number(query.get("page") ?? 1);
  const size = Number(query.get("page_size") ?? 20);
  if (!Number.isInteger(page) || page < 1 || page > 10000 || !Number.isInteger(size) || size < 1 || size > 50)
    return failure(400);
  return forward(`?page=${page}&page_size=${size}`, token);
}
