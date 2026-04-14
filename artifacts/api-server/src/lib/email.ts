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
