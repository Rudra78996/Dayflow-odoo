import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

export type EmailDeliveryStatus = 'sent' | 'console' | 'failed';

export type EmailDeliveryResult = {
  status: EmailDeliveryStatus;
  messageId?: string;
  reason?: string;
};

type EmailMessage = {
  to: string;
  subject: string;
  preheader: string;
  heading: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter?: Transporter<SMTPTransport.SentMessageInfo>;

  constructor(private readonly config: ConfigService) {}

  private actionUrl(path: string, token: string) {
    const configuredOrigin = this.config.get<string>('WEB_APP_URL')?.trim();
    const allowedOrigin = this.config
      .get<string>('WEB_ORIGIN', 'http://localhost:3000')
      .split(',')[0]
      ?.trim();
    const origin = configuredOrigin || allowedOrigin || 'http://localhost:3000';
    const url = new URL(path, origin);
    url.searchParams.set('token', token);
    return url.toString();
  }

  async sendAdministratorVerification(input: {
    to: string;
    administratorName: string;
    companyName: string;
    token: string;
  }) {
    return this.deliver({
      to: input.to,
      subject: `Verify your ${input.companyName} workspace`,
      preheader: 'Confirm your administrator email to start using Dayflow.',
      heading: 'Your Dayflow workspace is ready',
      body: `Hi ${input.administratorName}, confirm your work email to activate the ${input.companyName} workspace. This link expires in 24 hours.`,
      actionLabel: 'Verify email',
      actionUrl: this.actionUrl('/verify-email', input.token),
    });
  }

  async sendEmployeeActivation(input: {
    to: string;
    employeeName: string;
    companyName: string;
    loginId: string;
    token: string;
  }) {
    return this.deliver({
      to: input.to,
      subject: `Join ${input.companyName} on Dayflow`,
      preheader: 'Set your password and activate your employee account.',
      heading: `Welcome to ${input.companyName}`,
      body: `Hi ${input.employeeName}, your employee account is ready. Your Login ID is ${input.loginId}. Set your password using the secure link below. It expires in 72 hours.`,
      actionLabel: 'Activate account',
      actionUrl: this.actionUrl('/activate', input.token),
    });
  }

  async sendPasswordReset(input: { to: string; name: string; token: string }) {
    return this.deliver({
      to: input.to,
      subject: 'Reset your Dayflow password',
      preheader: 'Use this secure link to choose a new password.',
      heading: 'Reset your password',
      body: `Hi ${input.name}, we received a request to reset your Dayflow password. This link expires in one hour. If you did not request this, you can ignore this email.`,
      actionLabel: 'Choose a new password',
      actionUrl: this.actionUrl('/reset-password', input.token),
    });
  }

  private async deliver(message: EmailMessage): Promise<EmailDeliveryResult> {
    const provider = this.config
      .get<string>('EMAIL_PROVIDER', 'console')
      .trim()
      .toLowerCase();

    if (provider === 'console') {
      this.logger.log(
        `[email:console] ${message.subject} -> ${message.to}\n${message.actionUrl}`,
      );
      return { status: 'console' };
    }

    if (provider !== 'gmail-oauth2') {
      this.logger.error(`Unsupported EMAIL_PROVIDER: ${provider}`);
      return {
        status: 'failed',
        reason: 'The configured email provider is not supported.',
      };
    }

    const senderEmail = this.config.get<string>('GMAIL_SENDER_EMAIL')?.trim();
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')?.trim();
    const clientSecret = this.config
      .get<string>('GOOGLE_CLIENT_SECRET')
      ?.trim();
    const refreshToken = this.config
      .get<string>('GOOGLE_REFRESH_TOKEN')
      ?.trim();
    if (!senderEmail || !clientId || !clientSecret || !refreshToken) {
      this.logger.error(
        'GMAIL_SENDER_EMAIL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN are required when EMAIL_PROVIDER=gmail-oauth2.',
      );
      return {
        status: 'failed',
        reason: 'Gmail OAuth credentials are incomplete.',
      };
    }

    try {
      const transporter = this.getTransporter({
        senderEmail,
        clientId,
        clientSecret,
        refreshToken,
      });
      const configuredFrom = this.config.get<string>('EMAIL_FROM')?.trim();
      const info = await transporter.sendMail({
        from: configuredFrom || `Dayflow <${senderEmail}>`,
        to: message.to,
        subject: message.subject,
        html: this.html(message),
        text: `${message.heading}\n\n${message.body}\n\n${message.actionLabel}: ${message.actionUrl}`,
      });

      return { status: 'sent', messageId: info.messageId };
    } catch (error) {
      const details = this.errorDetails(error);
      this.logger.error(
        `Gmail delivery failed for ${message.to}: ${details.logMessage}`,
      );
      return {
        status: 'failed',
        reason: details.userMessage,
      };
    }
  }

  private getTransporter(credentials: {
    senderEmail: string;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  }) {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: credentials.senderEmail,
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          refreshToken: credentials.refreshToken,
        },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });
    }

    return this.transporter;
  }

  private errorDetails(error: unknown) {
    const smtpError = error as {
      code?: string;
      responseCode?: number;
      message?: string;
    };
    const logMessage = smtpError.message || 'Unknown Gmail SMTP error';

    if (
      smtpError.code === 'EAUTH' ||
      smtpError.responseCode === 535 ||
      smtpError.responseCode === 534
    ) {
      return {
        logMessage,
        userMessage:
          'Gmail authentication failed. Reconnect OAuth and confirm the refresh token belongs to GMAIL_SENDER_EMAIL.',
      };
    }

    return {
      logMessage,
      userMessage:
        'Gmail could not deliver the email. Check the API log for the SMTP response.',
    };
  }

  private html(message: EmailMessage) {
    const safe = {
      preheader: escapeHtml(message.preheader),
      heading: escapeHtml(message.heading),
      body: escapeHtml(message.body),
      actionLabel: escapeHtml(message.actionLabel),
      actionUrl: escapeHtml(message.actionUrl),
    };
    return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f7f6f8;color:#241d26;font-family:Arial,sans-serif">
    <span style="display:none;max-height:0;overflow:hidden">${safe.preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;background:#f7f6f8">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e0e8;border-radius:16px;overflow:hidden">
          <tr><td style="padding:24px 32px;background:#5f3965;color:#ffffff;font-size:20px;font-weight:700">Dayflow</td></tr>
          <tr><td style="padding:36px 32px">
            <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2">${safe.heading}</h1>
            <p style="margin:0 0 28px;color:#625767;font-size:16px;line-height:1.65">${safe.body}</p>
            <a href="${safe.actionUrl}" style="display:inline-block;padding:13px 20px;border-radius:10px;background:#5f3965;color:#ffffff;text-decoration:none;font-weight:700">${safe.actionLabel}</a>
            <p style="margin:28px 0 8px;color:#7b7080;font-size:13px;line-height:1.5">If the button does not open, copy this link:</p>
            <p style="margin:0;word-break:break-all;color:#5f3965;font-size:13px;line-height:1.5">${safe.actionUrl}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  }
}
