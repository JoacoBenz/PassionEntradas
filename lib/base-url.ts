// La dirección pública de la app, para armar links que salen afuera (WhatsApp,
// emails). NEXT_PUBLIC_SITE_URL si está; si no, la del pedido que llegó.
export function baseUrlDe(request: Request): string {
  return process.env.NEXT_PUBLIC_SITE_URL
    ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
    : new URL(request.url).origin;
}
