# Backlog plan (analysis, no code yet)

Branch `plan/backlog`, from `main` at #74. Each block below is planned as its
own PR (with its migration, if any) so it can be tested and merged alone.
Open questions are at the end of each block; answers go back into this file.

Production snapshot (2026-10-05):
- 5 operations, 3 of them open and unpaid.
- 3 own tickets and 2,721 Passion tickets.
- 1,750 tickets with a map, and 21 distinct zone colors (all hex).
- Users: 3 admins, 3 clients, no moderators.
- 6 access requests.

---

## 1. In-page confirmations instead of browser pop-ups

**Today: 6 `confirm()` pop-ups.**
- Accesos (3): reject request, resend access (new password), revoke/reactivate (`components/admin/SolicitudesAcceso.tsx:80,131,167`).
- Mis pedidos (3): accept quote, reject quote, cancel order/consult (`components/tienda/MisPedidos.tsx:133,155`).
- The panel's "Cancelar operación" has **no** confirmation at all.

**Plan.**
- One shared `ConfirmarBoton` component. The first tap turns the button into "¿Seguro? **Sí, cancelar** · No", inline in the same spot.
- It resets after ~5 s or on tapping elsewhere.
- No modal: it works the same on phone and desktop, and it is keyboard-accessible.
- It replaces the 6 pop-ups.
- Destructive actions also get a confirmation: cancelling an operation in the panel, and discarding a consult.

## 2. Confirmation step before "Enviar pedido"

**Today.** The cart modal goes straight from the item list to POST `/api/pedidos`, with no review step. There are no form fields: the buyer comes from the session.

**Plan.** "Enviar pedido" opens a review step inside the same modal:
- Items, split into "Pedido" (bookable) and "Consulta" (on request).
- A total per currency.
- What happens next: "no se cobra nada ahora; te confirmamos y te pasamos cómo pagar".
- Buttons: **Confirmar y enviar** / Volver.
- A double tap can't send twice: the button disables while sending, and the server already de-duplicates.

## 3. Clickable metrics in "Panel"

**Today.** The 5 cards in `AdminDashboard` (A cotizar, Esperando cliente, En curso, Para entregar, Entregadas) are display-only. The money metrics (Volumen, Comisiones, Entradas, Capital comprometido) live in a separate board on `/moderador`.

**Plan.**
- Each card becomes a button that sets the list filter, scrolls to the list, and highlights the active card. Tapping again clears it.
- **En curso**, **Para entregar** and **Entregadas** map 1:1 to existing tabs.
- **A cotizar** and **Esperando cliente** need 2 new filters that show only consults in that state. Today consults never filter by state.

## 4. Colored sector marker on the stadium map

**Today.**
- A sector has `zona_color` (hex) shown as a dot and text chip, plus one map image per event.
- There are **no coordinates** anywhere, so we can't know where a sector is on the image.

**Options.**
- **A. Automatic color highlight (recommended).**
  - When a sector is tapped, the browser reads the map image and finds the pixels of that zone's color.
  - It dims the rest and outlines or pulses the zone.
  - No data entry, and it works for all 1,750 mapped tickets at once.
  - Risk: maps where two zones share a color, or with gradients. In those cases it falls back to today's chip.
- **B. Manual pins.**
  - An admin taps once per zone per map in "Entradas" to place a marker (stored as x/y %).
  - Exact, but it means manual work on ~255 maps, and new Passion maps start without pins.
- **C. Hybrid.** Automatic by default, plus manual pins where the automatic one is wrong.

## 5. Stock taken at creation, returned on cancel

**Today.**
- Stock moves only when **payment** is marked: taken on pago ✓, returned on pago ✗ or on cancel.
- It only applies to **own** tickets (`manual::…`). Passion stock is overwritten by the worker every 5 min from the portal, so the app never touches it.
- The store caps the cart at the visible stock. The server does not block a sold-out own ticket (stock 0 counts as "no data"), and nothing is reserved between order and payment.

**Plan.**
- Stock is taken for own tickets as soon as an operation exists (store order, staff-created op, accepted quote). It stays when paid/delivered and is returned when cancelled (by client or admin). Reopening takes it again.
- Same SQL function (`stock_operacion`), so the move is atomic and recorded per line in `stock_descontado`.
- One migration to take stock for the open unpaid ops that exist today.

## 6. "Equipo / Clientes" admin screen (+ Accesos bug)

**Bug found.**
- `revocar/route.ts:75-77` writes `role: null` on revoke and hardcodes `role: "cliente"` on reactivate.
- A staff member who also has an access request (e.g. a client later made admin) loses their staff role on Revocar→Restaurar.
- "Reenviar acceso" also resets their password, and `/api/clientes` lists them as a client.
- No check prevents an admin from doing this to themselves.

**Today.**
- No way to create staff or change roles from the app (only the Supabase dashboard).
- No staff list.
- Clients only exist through access requests.

**Plan: new "Equipo" section (admin only), two tabs.**
- **Equipo:**
  - Lists admins/moderators.
  - Invite staff (email → user created with a temporary password emailed, same as clients).
  - Change role.
  - Deactivate/reactivate (blocks login without erasing the role).
  - Guards: can't demote or deactivate yourself, can't remove the last admin.
- **Clientes:**
  - Every client with orders, open orders, total bought per currency, and last order.
  - Click → their orders in the panel.
  - Revoke/reactivate.
  - "Accesos" (pending requests) stays as is or moves in here (see question).
- Every role change is logged: who, when, from→to.

## 7. Customer bell and emails (PR E)

**Today.**
- Customers get **no** notifications except the credentials email.
- No status-change emails, no "your quote is ready", no bell.
- Resend is wired (`lib/email.ts`) but production needs `RESEND_API_KEY` + `EMAIL_FROM` on a verified domain.

**Plan.**
- **Emails to the customer, in their language (es/en):**
  - Pedido recibido.
  - Confirmado.
  - **Para pagar** (with the payment text per currency).
  - Pagado.
  - Entregada.
  - Cotización lista (with expiry).
  - Cotización por vencer.
- Each email links to the order page.
- **Bell in the store header:** unread count plus a list of the same events, marked read on open. Backed by a `notificaciones` table filled by the same code that sends the emails.

## 8. WhatsApp admin templates

**Today.**
- One message per new store order or access request.
- Meta template params can't contain line breaks, so a multi-line summary can't go inside a template.
- No scheduled jobs exist. The Vercel cron on the current plan is once a day.

**Approaches (from before).**
- Daily digest.
- Per-event alert with a deep link.
- Urgent-only.
- **Hybrid (recommended):** an instant short alert with a link for new orders/consults, plus a daily digest.
  - The digest is one approved template with counts: "3 por confirmar · 2 a cotizar · 1 cotización vence hoy · 2 para entregar · 1 pago a proveedor pendiente" and a link to the panel.
  - The panel opens already filtered (needs block 3).

## Proposed order

1. **UX batch, no migrations:** 1 + 2 + 3.
2. **Equipo / Clientes**, including the Accesos bug fix: 6.
3. **Stock at creation:** 5.
4. **Map highlight:** 4.
5. **Customer emails + bell:** 7.
6. **WhatsApp digest:** 8. It reuses 3's filters and 7's event list.
