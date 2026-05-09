// ═══════════════════════════════════════════════════════
// NOTIFICATIONS MODULE — SMS / WhatsApp / Email
//
// FIX: Providers registered via DI tokens. To swap MSG91
// for Twilio, change useClass below — no service changes.
// ═══════════════════════════════════════════════════════

import { Module } from '@nestjs/common';
import {
  NotificationsService,
  SMS_PROVIDER,
  WHATSAPP_PROVIDER,
  EMAIL_PROVIDER,
  Msg91SmsProvider,
  Msg91WhatsAppProvider,
  NodemailerEmailProvider,
  MockSmsProvider,
  MockWhatsAppProvider,
  MockEmailProvider,
} from './notifications.service';

const isMock = false;
// const isMock = process.env.OTP_PROVIDER === 'mock' || process.env.NODE_ENV === 'development';

@Module({
  providers: [
    NotificationsService,
    { provide: SMS_PROVIDER, useClass: isMock ? MockSmsProvider : Msg91SmsProvider },
    { provide: WHATSAPP_PROVIDER, useClass: isMock ? MockWhatsAppProvider : Msg91WhatsAppProvider },
    { provide: EMAIL_PROVIDER, useClass: isMock ? MockEmailProvider : NodemailerEmailProvider },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
