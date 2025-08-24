import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('MAIL_HOST'),
      port: +this.config.get('MAIL_PORT'),
      secure: false, // true si tu utilises le port 465
      auth: {
        user: this.config.get('MAIL_USER'),
        pass: this.config.get('MAIL_PASS'),
      },
    });
  }

  async sendVerificationEmail(to: string, token: string) {
    const verifyUrl = `${this.config.get('WEB_URL')}/auth/verify?token=${token}`;

    await this.transporter.sendMail({
      from: this.config.get('MAIL_FROM'),
      to,
      subject: 'Vérification de votre email - Bghit-Nekhdem',
      html: `
        <h1>Bienvenue sur Bghit-Nekhdem 👋</h1>
        <p>Merci de vous être inscrit ! Cliquez sur le lien ci-dessous pour vérifier votre adresse email :</p>
        <a href="${verifyUrl}" target="_blank">${verifyUrl}</a>
        <p>Ce lien expire dans 24 heures.</p>
      `,
    });
  }

  async sendResetPasswordEmail(to: string, token: string) {
    const resetUrl = `${this.config.get('WEB_URL')}/reset-password?token=${token}`;

    await this.transporter.sendMail({
      from: this.config.get('MAIL_FROM'),
      to,
      subject: 'Réinitialisation de mot de passe - Bghit-Nekhdem',
      html: `
        <h1>Réinitialisation de votre mot de passe</h1>
        <p>Si vous avez demandé la réinitialisation de votre mot de passe, cliquez sur le lien ci-dessous :</p>
        <a href="${resetUrl}" target="_blank">${resetUrl}</a>
        <p>Si ce n'était pas vous, ignorez cet email.</p>
      `,
    });
  }
}
