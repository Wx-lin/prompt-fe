import { authorize, boundedBody, failure, forward } from "@/lib/submissions/proxy";
import { MAX_IMAGE_SIZE, validImage } from "@/lib/submissions/validation";

export async function POST(request: Request) {
  const token = await authorize(request);
  if (token instanceof Response)
    return token;
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data;"))
    return failure(400);
  const bytes = await boundedBody(request, MAX_IMAGE_SIZE + 64 * 1024).catch(() => null);
  if (!bytes)
    return failure(413);
  try {
    const form = await new Response(bytes as BodyInit, { headers: { "Content-Type": contentType } }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || !validImage(file) || [...form.keys()].length !== 1)
      return failure(400);
    const outgoing = new FormData();
    outgoing.append("file", file);
    return forward("/upload", token, outgoing);
  }
  catch {
    return failure(400);
  }
}
