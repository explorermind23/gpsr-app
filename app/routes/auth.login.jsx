import { redirect } from "@remix-run/node";
import { login } from "../shopify.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  if (shop) {
    const result = await login(request);
    if (result instanceof Response) return result;
    return redirect(`/auth?shop=${shop}`);
  }
  return new Response("Missing shop parameter", { status: 400 });
};