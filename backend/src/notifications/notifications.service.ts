// ═══════════════════════════════════════════════════════
// Notification Service — SMS, WhatsApp, Email
//
// FIX: Providers are now registered via NestJS DI tokens.
//      Swapping MSG91 for Twilio/Gupshup = change one line
//      in notifications.module.ts, not this file.
// ═══════════════════════════════════════════════════════

import { Injectable, Inject } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { NotificationChannel, NotificationStatus } from "@prisma/client";

// ─── PROVIDER INTERFACES (exported for DI) ──────────

export interface SmsProvider {
  send(
    mobile: string,
    content: string,
    vars?: Record<string, string>,
  ): Promise<void>;
}
export interface WhatsAppProvider {
  send(mobile: string, content: string): Promise<void>;
}
export interface EmailProvider {
  send(email: string, subject: string, content: string): Promise<void>;
}

// DI tokens
export const SMS_PROVIDER = "SMS_PROVIDER";
export const WHATSAPP_PROVIDER = "WHATSAPP_PROVIDER";
export const EMAIL_PROVIDER = "EMAIL_PROVIDER";

// ─── MSG91 SMS PROVIDER ─────────────────────────────

@Injectable()
export class Msg91SmsProvider implements SmsProvider {
  private authKey: string;
  private senderId: string;

  constructor() {
    this.authKey = process.env.MSG91_AUTH_KEY || "";
    this.senderId = process.env.MSG91_SENDER_ID || "RSHTSETU";
  }

  async send(
    mobile: string,
    content: string,
    vars?: Record<string, string>,
  ): Promise<void> {
    console.log("vars", vars);
    if (!this.authKey) {
      console.log(`[MSG91 SMS NOT CONFIGURED] To: ${mobile} | ${content}`);
      return;
    }
    try {
      // MSG91 "Flow" expects template variables as top-level JSON fields.
      // Your DLT template uses `{#numeric#}`, so we must send `numeric`.
      // Keep `var1` as a fallback for older flows that use var1.
      const numeric = vars?.numeric ?? vars?.otp ?? "";
      const response = await fetch("https://api.msg91.com/api/v5/flow/", {
        method: "POST",
        headers: {
          authkey: this.authKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          flow_id: process.env.MSG91_FLOW_ID || "",
          sender: this.senderId,
          mobiles: `91${mobile}`,
          // message: content,
          OTP:numeric,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`MSG91 SMS failed: ${error}`);
      }
    } catch (error) {
      console.error("MSG91 SMS error:", error);
      throw error;
    }
  }
}

// ─── MSG91 WHATSAPP PROVIDER ────────────────────────

@Injectable()
export class Msg91WhatsAppProvider implements WhatsAppProvider {
  private authKey: string;

  constructor() {
    this.authKey = process.env.MSG91_AUTH_KEY || "";
  }

  async send(mobile: string, content: string): Promise<void> {
    if (!this.authKey) {
      console.log(`[MSG91 WA NOT CONFIGURED] To: ${mobile} | ${content}`);
      return;
    }

    const response = await fetch(
      "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/",
      {
        method: "POST",
        headers: {
          authkey: this.authKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          integrated_number: process.env.MSG91_WA_NUMBER || "",
          content_type: "text",
          payload: {
            to: `91${mobile}`,
            type: "text",
            text: { body: content },
          },
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MSG91 WhatsApp failed: ${error}`);
    }
  }
}

// ─── NODEMAILER EMAIL PROVIDER ──────────────────────

@Injectable()
export class NodemailerEmailProvider implements EmailProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transporter: any;
  private configured: boolean;

  constructor() {
    this.configured = !!process.env.SMTP_USER;
    // Lazy-init transporter on first use to avoid import at module load
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getTransporter(): Promise<any> {
    if (this.transporter) return this.transporter;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore -- nodemailer types are optional
    const { default: nodemailer } = await import("nodemailer");
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || "",
      },
    });
    return this.transporter;
  }

  async send(email: string, subject: string, content: string): Promise<void> {
    if (!this.configured) return;

    try {
      const transport = await this.getTransporter();
      await transport.sendMail({
        from: `"RishteNate - Hanuman Mandir" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: email,
        subject,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:linear-gradient(135deg,#8B1A1A,#5a0f0f);color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
              <h2 style="margin:0;">RishteNate</h2>
              <p style="margin:4px 0 0;font-size:12px;color:#F5E6B8;">Mandir — Geeta Colony</p>
            </div>
            <div style="padding:24px;background:white;border:1px solid #E8D5C4;border-top:none;border-radius:0 0 8px 8px;">
              ${content}
            </div>
            <p style="text-align:center;font-size:11px;color:#7A6355;margin-top:12px;">
              Mandir, Geeta Colony, East Delhi — 110031
            </p>
          </div>
        `,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Email send failed to ${email}: ${message}`);
    }
  }
}

// ─── MOCK PROVIDERS (Development) ───────────────────

@Injectable()
export class MockSmsProvider implements SmsProvider {
  async send(mobile: string, content: string): Promise<void> {
    console.log(`[MOCK SMS] To: +91${mobile}\n   ${content}\n`);
  }
}

@Injectable()
export class MockWhatsAppProvider implements WhatsAppProvider {
  async send(mobile: string, content: string): Promise<void> {
    console.log(`[MOCK WHATSAPP] To: +91${mobile}\n   ${content}\n`);
  }
}

@Injectable()
export class MockEmailProvider implements EmailProvider {
  async send(email: string, subject: string, content: string): Promise<void> {
    console.log(
      `[MOCK EMAIL] To: ${email}\n   Subject: ${subject}\n   ${content}\n`,
    );
  }
}

// ═══ NOTIFICATION SERVICE ═══════════════════════════

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    @Inject(SMS_PROVIDER) private smsProvider: SmsProvider,
    @Inject(WHATSAPP_PROVIDER) private whatsAppProvider: WhatsAppProvider,
    @Inject(EMAIL_PROVIDER) private emailProvider: EmailProvider,
  ) {}

  // ─── CORE SEND ────────────────────────────────────
  async send(data: {
    mobile?: string;
    email?: string;
    channel: NotificationChannel;
    type: string;
    content: string;
    subject?: string;
    vars?: Record<string, string>;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        mobile: data.mobile,
        email: data.email,
        channel: data.channel,
        type: data.type,
        content: data.content,
        status: NotificationStatus.PENDING,
      },
    });

    try {
      switch (data.channel) {
        case NotificationChannel.SMS:
          await this.smsProvider.send(data.mobile!, data.content, data.vars);
          break;
        case NotificationChannel.WHATSAPP:
          await this.whatsAppProvider.send(data.mobile!, data.content);
          break;
        case NotificationChannel.EMAIL:
          await this.emailProvider.send(
            data.email!,
            data.subject || "RishteNate Notification",
            data.content,
          );
          break;
      }

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.SENT, sentAt: new Date() },
      });
      return { success: true, notificationId: notification.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.FAILED, error: message },
      });
      return { success: false, error: message };
    }
  }

  // ─── NOTIFICATION TRIGGERS ────────────────────────

  async onRegistrationCreated(
    mobile: string,
    regNumber: string,
    email?: string,
  ) {
    const msg = `Namaste! Your matrimony registration ${regNumber} has been submitted at Mandir. Please complete payment to activate your profile. Jai Shri Ram!`;

    await this.send({
      mobile,
      channel: NotificationChannel.SMS,
      type: "REGISTRATION_CONFIRM",
      content: msg,
    });
    await this.send({
      mobile,
      channel: NotificationChannel.WHATSAPP,
      type: "REGISTRATION_CONFIRM",
      content: msg,
    });

    if (email) {
      await this.send({
        email,
        channel: NotificationChannel.EMAIL,
        type: "REGISTRATION_CONFIRM",
        subject: `Registration ${regNumber} Submitted — RishteNate`,
        content: `<h3>Registration Submitted!</h3><p>Your matrimony registration <strong>${regNumber}</strong> has been submitted. Please complete payment to activate your profile.</p><p>Jai Shri Ram!</p>`,
      });
    }
  }

  async onPaymentCompleted(
    mobile: string,
    amount: number,
    regNumber: string,
    email?: string,
  ) {
    const msg = `Payment of Rs.${amount} received for registration ${regNumber} at Hanuman Mandir Geeta Colony. Your profile is now ACTIVE! Temple committee will begin matching.`;

    await this.send({
      mobile,
      channel: NotificationChannel.SMS,
      type: "PAYMENT_CONFIRM",
      content: msg,
    });
    await this.send({
      mobile,
      channel: NotificationChannel.WHATSAPP,
      type: "PAYMENT_CONFIRM",
      content: msg,
    });

    if (email) {
      await this.send({
        email,
        channel: NotificationChannel.EMAIL,
        type: "PAYMENT_CONFIRM",
        subject: `Payment Confirmed — ${regNumber} — RishteNate`,
        content: `<h3>Payment Confirmed!</h3><p>Rs.${amount} received for registration <strong>${regNumber}</strong>. Your profile is now active.</p>`,
      });
    }

    // Notify admin
    const adminMobile = process.env.ADMIN_NOTIFICATION_MOBILE;
    if (adminMobile) {
      await this.send({
        mobile: adminMobile,
        channel: NotificationChannel.WHATSAPP,
        type: "ADMIN_NEW_REG",
        content: `New Registration: ${regNumber}\nPayment: Rs.${amount}\nMobile: ${mobile}`,
      });
    }
  }

  async onMatchFound(mobile: string, matchCount: number) {
    const msg = `${matchCount} new match(es) found on RishteNate! Login to view profiles. Mandir Matrimony.`;
    await this.send({
      mobile,
      channel: NotificationChannel.WHATSAPP,
      type: "MATCH_NOTIFY",
      content: msg,
    });
    await this.send({
      mobile,
      channel: NotificationChannel.SMS,
      type: "MATCH_NOTIFY",
      content: msg,
    });
  }

  async onProfileSettled(mobile: string, regNumber: string) {
    const msg = `Congratulations! Profile ${regNumber} has been marked as settled on RishteNate. We wish you a blessed married life! Jai Shri Ram!`;
    await this.send({
      mobile,
      channel: NotificationChannel.WHATSAPP,
      type: "PROFILE_SETTLED",
      content: msg,
    });
  }
}
