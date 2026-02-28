import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({}: LoaderFunctionArgs) {
  return new Response(null, { status: 204 });
}

export default function FaviconRoute() {
  return null;
}
