// Plain-text error Responses shared by API routes, middleware, and page
// frontmatter, so the status/body pairs stay consistent in one place.

export const notFound = () => new Response("Not found", { status: 404 });
export const unauthorized = () => new Response("Unauthorized", { status: 401 });
export const forbidden = (message = "Forbidden") =>
  new Response(message, { status: 403 });
