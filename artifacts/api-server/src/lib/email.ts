import { Resend } from "resend";
import { logger } from "./logger";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date + "T00:00:00") : date;
  return d.toLocaleDateString("lt-LT", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(time: string): string {
  return time.slice(0, 5);
}

interface BookingEmailData {
  customerName: string;
  customerEmail: string;
  courtName: string;
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
  const start = formatTime(data.startTime);
  const end = formatTime(data.endTime);

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
            <td style="background:#111111;padding:32px 40px 24px;border-bottom:1px solid #1f1f1f;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="background:#adff2f;color:#000;font-weight:800;font-size:14px;padding:5px 10px;border-radius:6px;letter-spacing:0.5px;">K</span>
                    <span style="color:#adff2f;font-weight:800;font-size:18px;margin-left:8px;vertical-align:middle;">korts.lt</span>
                  </td>
                  <td align="right">
                    <span style="color:#6b7280;font-size:13px;">Rezervacija #${data.bookingId}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Success badge -->
          <tr>
            <td style="padding:32px 40px 0;">
              <div style="display:inline-block;background:#052e0f;color:#4ade80;border:1px solid #166534;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;margin-bottom:20px;">
                ✓ Rezervacija patvirtinta
              </div>
              <h1 style="color:#ffffff;font-size:26px;font-weight:700;margin:0 0 8px;">
                Sveiki, ${data.customerName}!
              </h1>
              <p style="color:#9ca3af;font-size:15px;margin:0 0 28px;">
                Jūsų kortų rezervacija sėkmingai patvirtinta. Žemiau rasite visą informaciją apie jūsų užsakymą.
              </p>
            </td>
          </tr>

          <!-- Booking details card -->
          <tr>
            <td style="padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;border:1px solid #262626;overflow:hidden;">
                <tr>
                  <td style="background:#adff2f;padding:12px 20px;">
                    <span style="color:#000;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">Rezervacijos detalės</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid #262626;">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="color:#6b7280;font-size:13px;width:40%;">Aikštelė</td>
                              <td style="color:#ffffff;font-size:14px;font-weight:600;text-align:right;">${data.courtName}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
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
                      <tr>
                        <td style="padding:10px 0;">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="color:#6b7280;font-size:13px;width:40%;">Bendra suma</td>
                              <td style="color:#adff2f;font-size:18px;font-weight:800;text-align:right;">${data.totalPrice.toFixed(2)} €</td>
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

          <!-- Info note -->
          <tr>
            <td style="padding:0 40px 32px;">
              <p style="color:#6b7280;font-size:13px;margin:0;line-height:1.6;">
                Prašome atvykti į aikštelę laiku. Jei turite klausimų, susisiekite su mumis per platformą <a href="https://korts.lt" style="color:#adff2f;text-decoration:none;">korts.lt</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #1f1f1f;">
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
      from: "korts.lt <rezervacijos@korts.lt>",
      to: data.customerEmail,
      subject: `✓ Rezervacija patvirtinta – ${data.courtName}, ${formatDate(data.date)}`,
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
