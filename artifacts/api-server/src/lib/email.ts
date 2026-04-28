import { Resend } from "resend";
import { logger } from "./logger";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const SITE_URL = process.env.SITE_URL || "https://korts.lt";

const LT_MONTHS = [
  "sausio", "vasario", "kovo", "balandžio", "gegužės", "birželio",
  "liepos", "rugpjūčio", "rugsėjo", "spalio", "lapkričio", "gruodžio",
];
const LT_WEEKDAYS = [
  "sekmadienis", "pirmadienis", "antradienis", "trečiadienis",
  "ketvirtadienis", "penktadienis", "šeštadienis",
];

function formatDate(date: Date | string): string {
  let d: Date;
  if (typeof date === "string") {
    const [year, month, day] = date.split("-").map(Number);
    d = new Date(year, month - 1, day);
  } else {
    d = date;
  }
  if (isNaN(d.getTime())) return String(date);
  const weekday = LT_WEEKDAYS[d.getDay()];
  const month = LT_MONTHS[d.getMonth()];
  return `${d.getFullYear()} m. ${month} ${d.getDate()} d., ${weekday}`;
}

function formatTime(time: string): string {
  return time.slice(0, 5);
}

function toCalDateTime(date: string, time: string): string {
  return date.replace(/-/g, "") + "T" + time.slice(0, 5).replace(":", "") + "00";
}

function googleCalendarUrl(data: {
  title: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  location: string;
  details: string;
}): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: data.title,
    dates: `${toCalDateTime(data.startDate, data.startTime)}/${toCalDateTime(data.endDate, data.endTime)}`,
    details: data.details,
    location: data.location,
    ctz: "Europe/Vilnius",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function googleMapsUrl(address: string, city: string): string {
  const query = encodeURIComponent(`${address}, ${city}, Lietuva`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export interface OwnerBookingNotificationData {
  ownerName: string;
  ownerEmail: string;
  customerName: string;
  courtName: string;
  date: Date | string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  bookingId: number;
}

export async function sendOwnerBookingNotificationEmail(data: OwnerBookingNotificationData): Promise<void> {
  const resend = getResend();
  if (!resend) {
    logger.warn("Resend not configured — skipping owner booking notification email");
    return;
  }

  const dateFormatted = formatDate(data.date);
  const start = formatTime(data.startTime);
  const end = formatTime(data.endTime);

  const html = `
<!DOCTYPE html>
<html lang="lt">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:16px;border:1px solid #1f1f1f;overflow:hidden;">
        <tr>
          <td style="padding:24px 32px;border-bottom:1px solid #1f1f1f;">
            <a href="${SITE_URL}" style="text-decoration:none;">
              <span style="background:#adff2f;color:#000;font-weight:800;font-size:14px;padding:5px 10px;border-radius:6px;">K</span>
              <span style="color:#adff2f;font-weight:800;font-size:18px;margin-left:8px;">korts.lt</span>
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 0;">
            <div style="display:inline-block;background:#172554;color:#93c5fd;border:1px solid #1d4ed8;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;margin-bottom:16px;">
              📅 Nauja rezervacija
            </div>
            <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0 0 6px;">Sveiki, ${data.ownerName}!</h1>
            <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;line-height:1.6;">Gautas naujas aikštelės <strong style="color:#ffffff;">${data.courtName}</strong> užsakymas.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;border:1px solid #262626;overflow:hidden;">
              <tr><td style="background:#1d4ed8;padding:11px 20px;"><span style="color:#fff;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.8px;">Rezervacijos detalės</span></td></tr>
              <tr><td style="padding:16px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr><td style="padding:8px 0;border-bottom:1px solid #262626;">
                    <table width="100%"><tr>
                      <td style="color:#6b7280;font-size:13px;width:40%;">Klientas</td>
                      <td style="color:#ffffff;font-size:14px;font-weight:600;text-align:right;">${data.customerName}</td>
                    </tr></table>
                  </td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #262626;">
                    <table width="100%"><tr>
                      <td style="color:#6b7280;font-size:13px;width:40%;">Data</td>
                      <td style="color:#ffffff;font-size:14px;font-weight:600;text-align:right;">${dateFormatted}</td>
                    </tr></table>
                  </td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #262626;">
                    <table width="100%"><tr>
                      <td style="color:#6b7280;font-size:13px;width:40%;">Laikas</td>
                      <td style="color:#ffffff;font-size:14px;font-weight:600;text-align:right;">${start} – ${end}</td>
                    </tr></table>
                  </td></tr>
                  <tr><td style="padding:8px 0;">
                    <table width="100%"><tr>
                      <td style="color:#6b7280;font-size:13px;width:40%;">Suma</td>
                      <td style="color:#adff2f;font-size:18px;font-weight:800;text-align:right;">${data.totalPrice.toFixed(2)} €</td>
                    </tr></table>
                  </td></tr>
                </table>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr><td style="padding:0 32px 28px;">
          <a href="${SITE_URL}/owner/dashboard" style="display:inline-block;background:#adff2f;color:#000;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none;">
            Peržiūrėti rezervacijas →
          </a>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #1f1f1f;">
          <p style="color:#374151;font-size:12px;margin:0;text-align:center;">© ${new Date().getFullYear()} korts.lt</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();

  try {
    const { error } = await resend.emails.send({
      from: "korts.lt <onboarding@resend.dev>",
      to: data.ownerEmail,
      subject: `📅 Nauja rezervacija – ${data.courtName}, ${dateFormatted} ${start}–${end}`,
      html,
    });
    if (error) logger.error({ error }, "Failed to send owner booking notification email");
    else logger.info({ bookingId: data.bookingId, email: data.ownerEmail }, "Owner booking notification email sent");
  } catch (err) {
    logger.error({ err }, "Exception sending owner booking notification email");
  }
}

export interface BookingEmailData {
  customerName: string;
  customerEmail: string;
  courtName: string;
  courtId: number;
  courtAddress: string;
  courtCity: string;
  courtPhone?: string;
  courtImageUrl?: string;
  date: Date | string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  bookingId: number;
}

export async function sendBookingConfirmationEmail(data: BookingEmailData): Promise<void> {
  const resend = getResend();
  if (!resend) {
    logger.warn("Resend not configured (RESEND_API_KEY missing) — skipping confirmation email");
    return;
  }

  const dateFormatted = formatDate(data.date);
  const dateStr = typeof data.date === "string" ? data.date.slice(0, 10) : data.date.toISOString().slice(0, 10);
  const start = formatTime(data.startTime);
  const end = formatTime(data.endTime);

  const courtUrl = `${SITE_URL}/courts/${data.courtId}`;
  const icsUrl = `${SITE_URL}/api/bookings/${data.bookingId}/ics`;
  const mapsUrl = googleMapsUrl(data.courtAddress, data.courtCity);
  const googleCalUrl = googleCalendarUrl({
    title: `Korto rezervacija – ${data.courtName}`,
    startDate: dateStr,
    startTime: data.startTime,
    endDate: dateStr,
    endTime: data.endTime,
    location: `${data.courtAddress}, ${data.courtCity}, Lietuva`,
    details: `Rezervacija #${data.bookingId} per korts.lt\n${courtUrl}`,
  });

  const photoBlock = data.courtImageUrl
    ? `<tr>
        <td style="padding:0;">
          <a href="${courtUrl}" style="display:block;">
            <img src="${data.courtImageUrl}" alt="${data.courtName}" width="560"
              style="width:100%;max-height:220px;object-fit:cover;display:block;border-bottom:1px solid #1f1f1f;" />
          </a>
        </td>
      </tr>`
    : "";

  const phoneBlock = data.courtPhone
    ? `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #262626;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:#6b7280;font-size:13px;width:40%;">Telefonas</td>
              <td style="text-align:right;">
                <a href="tel:${data.courtPhone}" style="color:#adff2f;font-size:14px;font-weight:600;text-decoration:none;">${data.courtPhone}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : "";

  const html = `
<!DOCTYPE html>
<html lang="lt">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Rezervacijos patvirtinimas</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:16px;overflow:hidden;border:1px solid #1f1f1f;">

          <!-- Header -->
          <tr>
            <td style="background:#111111;padding:24px 32px;border-bottom:1px solid #1f1f1f;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <a href="${SITE_URL}" style="text-decoration:none;">
                      <span style="background:#adff2f;color:#000;font-weight:800;font-size:14px;padding:5px 10px;border-radius:6px;letter-spacing:0.5px;">K</span>
                      <span style="color:#adff2f;font-weight:800;font-size:18px;margin-left:8px;vertical-align:middle;">korts.lt</span>
                    </a>
                  </td>
                  <td align="right">
                    <span style="color:#6b7280;font-size:13px;display:block;">Rezervacijos numeris</span>
                    <span style="color:#ffffff;font-size:14px;font-weight:700;display:block;margin-top:2px;">#${data.bookingId}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Court photo -->
          ${photoBlock}

          <!-- Success badge + greeting -->
          <tr>
            <td style="padding:28px 32px 0;">
              <div style="display:inline-block;background:#052e0f;color:#4ade80;border:1px solid #166534;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;margin-bottom:16px;">
                ✓ Rezervacija patvirtinta
              </div>
              <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0 0 6px;">
                Sveiki, ${data.customerName}!
              </h1>
              <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;line-height:1.6;">
                Jūsų kortų rezervacija sėkmingai patvirtinta. Žemiau rasite visą informaciją apie užsakymą.
              </p>
            </td>
          </tr>

          <!-- Booking details card -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;border:1px solid #262626;overflow:hidden;">
                <tr>
                  <td style="background:#adff2f;padding:11px 20px;">
                    <span style="color:#000;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.8px;">Rezervacijos detalės</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px 4px;">
                    <table width="100%" cellpadding="0" cellspacing="0">

                      <!-- Court name -->
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid #262626;">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="color:#6b7280;font-size:13px;width:40%;">Aikštelė</td>
                              <td style="text-align:right;">
                                <a href="${courtUrl}" style="color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">${data.courtName} ↗</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Date -->
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid #262626;">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="color:#6b7280;font-size:13px;width:40%;">Data</td>
                              <td style="color:#ffffff;font-size:14px;font-weight:600;text-align:right;">${dateFormatted}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Time -->
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid #262626;">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="color:#6b7280;font-size:13px;width:40%;">Laikas</td>
                              <td style="color:#ffffff;font-size:14px;font-weight:600;text-align:right;">${start} – ${end}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Location -->
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid #262626;">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="color:#6b7280;font-size:13px;width:40%;">Vieta</td>
                              <td style="text-align:right;">
                                <a href="${mapsUrl}" style="color:#60a5fa;font-size:14px;font-weight:600;text-decoration:none;">${data.courtAddress}, ${data.courtCity} ↗</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Phone (if available) -->
                      ${phoneBlock}

                      <!-- Price -->
                      <tr>
                        <td style="padding:12px 0 4px;">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="color:#6b7280;font-size:13px;width:40%;">Bendra suma</td>
                              <td style="color:#adff2f;font-size:20px;font-weight:800;text-align:right;">${data.totalPrice.toFixed(2)} €</td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Action buttons -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:8px;" width="50%">
                    <a href="${mapsUrl}" style="display:block;background:#1a1a1a;border:1px solid #262626;border-radius:10px;padding:14px 16px;text-decoration:none;text-align:center;">
                      <div style="font-size:20px;margin-bottom:4px;">📍</div>
                      <div style="color:#ffffff;font-size:13px;font-weight:600;">Maršrutas</div>
                      <div style="color:#6b7280;font-size:11px;margin-top:2px;">Google Maps</div>
                    </a>
                  </td>
                  <td style="padding-left:8px;" width="50%">
                    <a href="${courtUrl}" style="display:block;background:#1a1a1a;border:1px solid #262626;border-radius:10px;padding:14px 16px;text-decoration:none;text-align:center;">
                      <div style="font-size:20px;margin-bottom:4px;">🏟️</div>
                      <div style="color:#ffffff;font-size:13px;font-weight:600;">Aikštelė</div>
                      <div style="color:#6b7280;font-size:11px;margin-top:2px;">korts.lt</div>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Calendar buttons -->
          <tr>
            <td style="padding:0 32px 28px;">
              <p style="color:#6b7280;font-size:12px;margin:0 0 10px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Pridėti į kalendorių</p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:8px;">
                    <a href="${googleCalUrl}" style="display:inline-block;background:#1f2937;border:1px solid #374151;border-radius:8px;padding:9px 16px;text-decoration:none;color:#ffffff;font-size:13px;font-weight:600;">
                      📅 Google Calendar
                    </a>
                  </td>
                  <td>
                    <a href="${icsUrl}" style="display:inline-block;background:#1f2937;border:1px solid #374151;border-radius:8px;padding:9px 16px;text-decoration:none;color:#ffffff;font-size:13px;font-weight:600;">
                      🍎 Apple Calendar
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Note -->
          <tr>
            <td style="padding:0 32px 24px;">
              <div style="background:#0f1f0f;border:1px solid #166534;border-radius:8px;padding:14px 16px;">
                <p style="color:#86efac;font-size:13px;margin:0;line-height:1.6;">
                  Prašome atvykti laiku. Turite klausimų? Susisiekite su mumis per
                  <a href="${SITE_URL}" style="color:#adff2f;text-decoration:none;">korts.lt</a>.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #1f1f1f;">
              <p style="color:#374151;font-size:12px;margin:0;text-align:center;">
                © ${new Date().getFullYear()} korts.lt — Lietuvos sporto aikštelių rezervavimo platforma
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    const { error } = await resend.emails.send({
      from: "korts.lt <onboarding@resend.dev>",
      to: data.customerEmail,
      subject: `✓ Rezervacija patvirtinta – ${data.courtName}, ${dateFormatted}`,
      html,
    });

    if (error) {
      logger.error({ error }, "Failed to send booking confirmation email");
    } else {
      logger.info({ bookingId: data.bookingId, email: data.customerEmail }, "Booking confirmation email sent");
    }
  } catch (err) {
    logger.error({ err }, "Exception sending booking confirmation email");
  }
}

export interface CustomerCancellationEmailData {
  customerName: string;
  customerEmail: string;
  courtName: string;
  date: Date | string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  refundAmount: number;
  bookingId: number;
}

export async function sendCustomerCancellationEmail(data: CustomerCancellationEmailData): Promise<void> {
  const resend = getResend();
  if (!resend) {
    logger.warn("Resend not configured — skipping customer cancellation email");
    return;
  }

  const dateFormatted = formatDate(data.date);
  const start = formatTime(data.startTime);
  const end = formatTime(data.endTime);
  const refunded = data.refundAmount > 0;

  const refundBlock = refunded
    ? `<div style="background:#0f1f0f;border:1px solid #166534;border-radius:8px;padding:14px 16px;">
        <p style="color:#86efac;font-size:13px;margin:0 0 4px;font-weight:600;">Grąžinta į Jūsų kortelę</p>
        <p style="color:#4ade80;font-size:22px;font-weight:800;margin:0;">${data.refundAmount.toFixed(2)} €</p>
        <p style="color:#9ca3af;font-size:12px;margin:6px 0 0;">Pinigai grįš per 5–10 darbo dienų.</p>
      </div>`
    : `<div style="background:#1f0f0f;border:1px solid #7f1d1d;border-radius:8px;padding:14px 16px;">
        <p style="color:#fca5a5;font-size:13px;margin:0;line-height:1.6;">Pagal mūsų politiką vėlyviems atšaukimams (mažiau nei 24 val. iki rezervacijos) pinigai negrąžinami. Laikas atsilaisvino kitiems žaidėjams.</p>
      </div>`;

  const html = `
<!DOCTYPE html>
<html lang="lt">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:16px;border:1px solid #1f1f1f;overflow:hidden;">
        <tr>
          <td style="padding:24px 32px;border-bottom:1px solid #1f1f1f;">
            <a href="${SITE_URL}" style="text-decoration:none;">
              <span style="background:#adff2f;color:#000;font-weight:800;font-size:14px;padding:5px 10px;border-radius:6px;">K</span>
              <span style="color:#adff2f;font-weight:800;font-size:18px;margin-left:8px;">korts.lt</span>
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 0;">
            <div style="display:inline-block;background:#3f1d1d;color:#fca5a5;border:1px solid #991b1b;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;margin-bottom:16px;">
              Rezervacija atšaukta
            </div>
            <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0 0 6px;">Sveiki, ${data.customerName}!</h1>
            <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;line-height:1.6;">Jūsų rezervacija aikštelėje <strong style="color:#ffffff;">${data.courtName}</strong> sėkmingai atšaukta.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;border:1px solid #262626;overflow:hidden;">
              <tr><td style="background:#262626;padding:11px 20px;"><span style="color:#fff;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.8px;">Atšaukta rezervacija #${data.bookingId}</span></td></tr>
              <tr><td style="padding:14px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr><td style="padding:6px 0;border-bottom:1px solid #262626;"><table width="100%"><tr>
                    <td style="color:#6b7280;font-size:13px;width:40%;">Aikštelė</td>
                    <td style="color:#ffffff;font-size:14px;font-weight:600;text-align:right;">${data.courtName}</td>
                  </tr></table></td></tr>
                  <tr><td style="padding:6px 0;border-bottom:1px solid #262626;"><table width="100%"><tr>
                    <td style="color:#6b7280;font-size:13px;width:40%;">Data</td>
                    <td style="color:#ffffff;font-size:14px;font-weight:600;text-align:right;">${dateFormatted}</td>
                  </tr></table></td></tr>
                  <tr><td style="padding:6px 0;border-bottom:1px solid #262626;"><table width="100%"><tr>
                    <td style="color:#6b7280;font-size:13px;width:40%;">Laikas</td>
                    <td style="color:#ffffff;font-size:14px;font-weight:600;text-align:right;">${start} – ${end}</td>
                  </tr></table></td></tr>
                  <tr><td style="padding:6px 0;"><table width="100%"><tr>
                    <td style="color:#6b7280;font-size:13px;width:40%;">Sumokėta</td>
                    <td style="color:#9ca3af;font-size:14px;font-weight:600;text-align:right;text-decoration:line-through;">${data.totalPrice.toFixed(2)} €</td>
                  </tr></table></td></tr>
                </table>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr><td style="padding:0 32px 28px;">${refundBlock}</td></tr>
        <tr><td style="padding:0 32px 28px;">
          <a href="${SITE_URL}/courts" style="display:inline-block;background:#adff2f;color:#000;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none;">
            Rezervuoti naują laiką →
          </a>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #1f1f1f;">
          <p style="color:#374151;font-size:12px;margin:0;text-align:center;">© ${new Date().getFullYear()} korts.lt</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();

  try {
    const { error } = await resend.emails.send({
      from: "korts.lt <onboarding@resend.dev>",
      to: data.customerEmail,
      subject: `Atšaukta — ${data.courtName}, ${dateFormatted}${refunded ? ` · grąžinta ${data.refundAmount.toFixed(2)} €` : ""}`,
      html,
    });
    if (error) logger.error({ error }, "Failed to send customer cancellation email");
    else logger.info({ bookingId: data.bookingId, email: data.customerEmail }, "Customer cancellation email sent");
  } catch (err) {
    logger.error({ err }, "Exception sending customer cancellation email");
  }
}

export interface OwnerCancellationEmailData {
  ownerName: string;
  ownerEmail: string;
  customerName: string;
  courtName: string;
  date: Date | string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  refundAmount: number;
  bookingId: number;
}

export async function sendOwnerCancellationEmail(data: OwnerCancellationEmailData): Promise<void> {
  const resend = getResend();
  if (!resend) {
    logger.warn("Resend not configured — skipping owner cancellation email");
    return;
  }

  const dateFormatted = formatDate(data.date);
  const start = formatTime(data.startTime);
  const end = formatTime(data.endTime);
  const refunded = data.refundAmount > 0;
  const netRevenue = Math.max(0, data.totalPrice - data.refundAmount);

  const html = `
<!DOCTYPE html>
<html lang="lt">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:16px;border:1px solid #1f1f1f;overflow:hidden;">
        <tr>
          <td style="padding:24px 32px;border-bottom:1px solid #1f1f1f;">
            <a href="${SITE_URL}" style="text-decoration:none;">
              <span style="background:#adff2f;color:#000;font-weight:800;font-size:14px;padding:5px 10px;border-radius:6px;">K</span>
              <span style="color:#adff2f;font-weight:800;font-size:18px;margin-left:8px;">korts.lt</span>
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 0;">
            <div style="display:inline-block;background:#3f1d1d;color:#fca5a5;border:1px solid #991b1b;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;margin-bottom:16px;">
              Rezervacija atšaukta
            </div>
            <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0 0 6px;">Sveiki, ${data.ownerName}!</h1>
            <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;line-height:1.6;">Klientas <strong style="color:#ffffff;">${data.customerName}</strong> atšaukė rezervaciją aikštelėje <strong style="color:#ffffff;">${data.courtName}</strong>. Laikas vėl laisvas užsakymams.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;border:1px solid #262626;overflow:hidden;">
              <tr><td style="background:#262626;padding:11px 20px;"><span style="color:#fff;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.8px;">Atšaukta rezervacija #${data.bookingId}</span></td></tr>
              <tr><td style="padding:14px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr><td style="padding:6px 0;border-bottom:1px solid #262626;"><table width="100%"><tr>
                    <td style="color:#6b7280;font-size:13px;width:40%;">Klientas</td>
                    <td style="color:#ffffff;font-size:14px;font-weight:600;text-align:right;">${data.customerName}</td>
                  </tr></table></td></tr>
                  <tr><td style="padding:6px 0;border-bottom:1px solid #262626;"><table width="100%"><tr>
                    <td style="color:#6b7280;font-size:13px;width:40%;">Data</td>
                    <td style="color:#ffffff;font-size:14px;font-weight:600;text-align:right;">${dateFormatted}</td>
                  </tr></table></td></tr>
                  <tr><td style="padding:6px 0;border-bottom:1px solid #262626;"><table width="100%"><tr>
                    <td style="color:#6b7280;font-size:13px;width:40%;">Laikas</td>
                    <td style="color:#ffffff;font-size:14px;font-weight:600;text-align:right;">${start} – ${end}</td>
                  </tr></table></td></tr>
                  <tr><td style="padding:6px 0;border-bottom:1px solid #262626;"><table width="100%"><tr>
                    <td style="color:#6b7280;font-size:13px;width:40%;">Sumokėta</td>
                    <td style="color:#ffffff;font-size:14px;font-weight:600;text-align:right;">${data.totalPrice.toFixed(2)} €</td>
                  </tr></table></td></tr>
                  <tr><td style="padding:6px 0;border-bottom:1px solid #262626;"><table width="100%"><tr>
                    <td style="color:#6b7280;font-size:13px;width:40%;">Grąžinta klientui</td>
                    <td style="color:${refunded ? "#fca5a5" : "#9ca3af"};font-size:14px;font-weight:600;text-align:right;">${refunded ? "−" + data.refundAmount.toFixed(2) + " €" : "—"}</td>
                  </tr></table></td></tr>
                  <tr><td style="padding:8px 0 4px;"><table width="100%"><tr>
                    <td style="color:#6b7280;font-size:13px;width:40%;">Jūsų grynosios pajamos</td>
                    <td style="color:#adff2f;font-size:18px;font-weight:800;text-align:right;">${netRevenue.toFixed(2)} €</td>
                  </tr></table></td></tr>
                </table>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr><td style="padding:0 32px 28px;">
          <a href="${SITE_URL}/owner/dashboard" style="display:inline-block;background:#adff2f;color:#000;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none;">
            Atidaryti valdymo skydą →
          </a>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #1f1f1f;">
          <p style="color:#374151;font-size:12px;margin:0;text-align:center;">© ${new Date().getFullYear()} korts.lt</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();

  try {
    const { error } = await resend.emails.send({
      from: "korts.lt <onboarding@resend.dev>",
      to: data.ownerEmail,
      subject: `Atšaukta rezervacija — ${data.courtName}, ${dateFormatted} ${start}–${end}`,
      html,
    });
    if (error) logger.error({ error }, "Failed to send owner cancellation email");
    else logger.info({ bookingId: data.bookingId, email: data.ownerEmail }, "Owner cancellation email sent");
  } catch (err) {
    logger.error({ err }, "Exception sending owner cancellation email");
  }
}

const ROLE_LABELS: Record<string, string> = {
  coach: "Treneris",
  owner: "Aikštelės savininkas",
};

export async function sendAdminRoleRequestEmail(data: {
  userId: string;
  pendingRole: string;
  requestData: Record<string, unknown>;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const adminEmail = process.env.ADMIN_EMAIL || "admin@korts.lt";
  const roleLabel = ROLE_LABELS[data.pendingRole] ?? data.pendingRole;
  const name = (data.requestData.name as string) || "Nenurodyta";
  const adminUrl = `${SITE_URL}/admin`;

  const html = `
<!DOCTYPE html>
<html lang="lt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Naujas vaidmens prašymas</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;min-height:100vh;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#141414;border-radius:16px;overflow:hidden;border:1px solid #1f1f1f;max-width:600px;">
          <tr>
            <td style="background:linear-gradient(135deg,#1a2e0a 0%,#0a1a1a 100%);padding:40px 32px;text-align:center;">
              <div style="display:inline-block;background:#84cc16;border-radius:12px;padding:10px 20px;margin-bottom:16px;">
                <span style="color:#000;font-weight:800;font-size:20px;letter-spacing:-0.5px;">korts.lt</span>
              </div>
              <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0;">Naujas vaidmens prašymas</h1>
              <p style="color:#84cc16;font-size:14px;margin:8px 0 0;">${roleLabel}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="color:#d1d5db;font-size:15px;margin:0 0 24px;">Vartotojas pateikė prašymą gauti <strong style="color:#84cc16;">${roleLabel}</strong> vaidmenį.</p>
              <table width="100%" style="background:#0a0a0a;border-radius:12px;border:1px solid #1f1f1f;overflow:hidden;">
                <tr><td style="padding:16px 20px;border-bottom:1px solid #1f1f1f;">
                  <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Vartotojas</span><br>
                  <span style="color:#ffffff;font-size:15px;font-weight:600;">${name}</span>
                </td></tr>
                <tr><td style="padding:16px 20px;border-bottom:1px solid #1f1f1f;">
                  <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Prašomas vaidmuo</span><br>
                  <span style="color:#84cc16;font-size:15px;font-weight:600;">${roleLabel}</span>
                </td></tr>
                ${data.requestData.bio ? `<tr><td style="padding:16px 20px;border-bottom:1px solid #1f1f1f;">
                  <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Biografija</span><br>
                  <span style="color:#d1d5db;font-size:14px;">${data.requestData.bio}</span>
                </td></tr>` : ""}
                ${data.requestData.sports ? `<tr><td style="padding:16px 20px;border-bottom:1px solid #1f1f1f;">
                  <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Sportas</span><br>
                  <span style="color:#d1d5db;font-size:14px;">${Array.isArray(data.requestData.sports) ? (data.requestData.sports as string[]).join(", ") : data.requestData.sports}</span>
                </td></tr>` : ""}
                <tr><td style="padding:16px 20px;">
                  <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Vartotojo ID</span><br>
                  <span style="color:#6b7280;font-size:12px;font-family:monospace;">${data.userId}</span>
                </td></tr>
              </table>
              <div style="margin-top:28px;text-align:center;">
                <a href="${adminUrl}" style="display:inline-block;background:#84cc16;color:#000;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;">Peržiūrėti prašymą admin skydelyje</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #1f1f1f;">
              <p style="color:#374151;font-size:12px;margin:0;text-align:center;">© ${new Date().getFullYear()} korts.lt — Lietuvos sporto aikštelių rezervavimo platforma</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  try {
    const { error } = await resend.emails.send({
      from: "korts.lt <onboarding@resend.dev>",
      to: adminEmail,
      subject: `🔔 Naujas vaidmens prašymas — ${roleLabel} (${name})`,
      html,
    });
    if (error) {
      logger.error({ error }, "Failed to send admin role request email");
    } else {
      logger.info({ userId: data.userId, pendingRole: data.pendingRole }, "Admin role request email sent");
    }
  } catch (err) {
    logger.error({ err }, "Exception sending admin role request email");
  }
}

const SPORT_LT: Record<string, string> = {
  tennis: "Tenisas", basketball: "Krepšinis", football: "Futbolas",
  padel: "Padelis", badminton: "Badmintonas", "table-tennis": "Stalo tenisas",
  volleyball: "Tinklinis", squash: "Skvošas", golf: "Golfo",
  bowling: "Boulingas", pickleball: "Pikliboulas", hockey: "Ledo ritulys",
};

export async function sendMatchInviteEmail(
  toEmail: string,
  toName: string,
  hostName: string,
  sport: string,
  gameDate: Date,
  joinLink: string,
): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const sportLabel = SPORT_LT[sport] ?? sport;
  const dateStr = formatDate(gameDate);
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f3f7fa; padding: 32px; }
  .card { background: #fff; max-width: 520px; margin: 0 auto; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #132D4C 0%, #1a3d66 100%); padding: 32px 40px; text-align: center; }
  .header h1 { color: #C5E041; font-size: 22px; margin: 0; }
  .body { padding: 32px 40px; }
  .sport-badge { display: inline-block; background: #f0f9ff; color: #132D4C; border: 2px solid #C5E041; border-radius: 24px; padding: 6px 18px; font-size: 15px; font-weight: 600; margin-bottom: 20px; }
  .btn { display: inline-block; background: #C5E041; color: #132D4C; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; margin: 8px 0; }
  p { color: #334155; line-height: 1.6; }
  .footer { padding: 20px 40px; background: #f3f7fa; text-align: center; font-size: 12px; color: #94a3b8; }
</style></head>
<body>
<div class="card">
  <div class="header">
    <h1>🎯 Žaidimo kvietimas</h1>
  </div>
  <div class="body">
    <p>Sveiki, <strong>${toName}</strong>!</p>
    <p><strong>${hostName}</strong> kviečia jus dalyvauti:</p>
    <div class="sport-badge">${sportLabel}</div>
    <p>📅 <strong>Data:</strong> ${dateStr}</p>
    <p>Prisijunkite prie žaidimo spustelėję mygtuką žemiau:</p>
    <a href="${joinLink}" class="btn">Prisijungti prie žaidimo →</a>
    <p style="font-size: 13px; color: #94a3b8; margin-top: 24px;">Jei negalite dalyvauti, tiesiog ignoruokite šį laišką.</p>
  </div>
  <div class="footer">korts.lt — Sporto aikštelių rezervacija</div>
</div>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from: "korts.lt <onboarding@resend.dev>",
      to: toEmail,
      subject: `🎯 ${hostName} kviečia jus į ${sportLabel} žaidimą`,
      html,
    });
    if (error) {
      logger.error({ error }, "Failed to send match invite email");
    } else {
      logger.info({ toEmail, sport }, "Match invite email sent");
    }
  } catch (err) {
    logger.error({ err }, "Exception sending match invite email");
  }
}

export async function sendCoachInviteEmail(data: {
  toEmail: string;
  toName: string;
  courtName: string;
  acceptLink: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) { logger.warn("Resend not configured — skipping coach invite email"); return; }

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f3f7fa; padding: 32px; }
  .card { background: #fff; max-width: 520px; margin: 0 auto; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #132D4C 0%, #1a3d66 100%); padding: 32px 40px; text-align: center; }
  .header h1 { color: #C5E041; font-size: 22px; margin: 0; }
  .body { padding: 32px 40px; }
  .btn { display: inline-block; background: #C5E041; color: #132D4C; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; margin: 8px 0; }
  p { color: #334155; line-height: 1.6; }
  .footer { padding: 20px 40px; background: #f3f7fa; text-align: center; font-size: 12px; color: #94a3b8; }
</style></head>
<body>
<div class="card">
  <div class="header"><h1>🎾 Trenerio kvietimas</h1></div>
  <div class="body">
    <p>Sveiki, <strong>${data.toName}</strong>!</p>
    <p>Jūs esate pakviesti tapti treneriumi aikštelėje <strong>${data.courtName}</strong> platformoje korts.lt.</p>
    <p>Spustelėkite mygtuką žemiau, kad priimtumėte kvietimą:</p>
    <a href="${data.acceptLink}" class="btn">Priimti kvietimą →</a>
    <p style="font-size:13px;color:#94a3b8;margin-top:24px;">Jei negalite dalyvauti, tiesiog ignoruokite šį laišką.</p>
  </div>
  <div class="footer">korts.lt — Sporto aikštelių rezervacija</div>
</div>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from: "korts.lt <onboarding@resend.dev>",
      to: data.toEmail,
      subject: `🎾 Kvietimas tapti treneriumi — ${data.courtName}`,
      html,
    });
    if (error) logger.error({ error }, "Failed to send coach invite email");
    else logger.info({ toEmail: data.toEmail }, "Coach invite email sent");
  } catch (err) {
    logger.error({ err }, "Exception sending coach invite email");
  }
}
