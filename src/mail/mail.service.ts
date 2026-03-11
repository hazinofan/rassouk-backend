import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

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

  async sendApplicationConfirmation(
    to: string,
    jobTitle: string,
    employerName?: string,
  ) {
    await this.transporter.sendMail({
      from: this.config.get('MAIL_FROM'),
      to,
      subject: `Votre candidature pour "${jobTitle}" a bien été reçue ✅`,
      html: `
      <h2 style="color:#005DAA">Merci d'avoir postulé sur Bghit-Nekhdem 👋</h2>
      <p>Bonjour,</p>
      <p>Nous avons bien transmis votre candidature pour le poste 
      <strong>${jobTitle}</strong> à l’employeur.</p>
      <p>
        ${employerName ? `L’employeur <strong>${employerName}</strong>` : `L’employeur`} 
        a reçu votre dossier et vous contactera dès qu’il l’aura examiné.
      </p>
      <br />
      <p style="font-size:14px;color:#555">
        🚀 L’équipe <strong>Bghit-Nekhdem</strong><br />
        <a href="${this.config.get('WEB_URL')}" target="_blank">${this.config.get('WEB_URL')}</a>
      </p>
    `,
    });
  }

  async sendJobDigest(opts: {
    to: string;
    candidateName: string;
    weekOf: string;
    jobs: any[];
    manageUrl: string;
  }) {
    const subject = `Bghit-Nekhdem — Vos nouvelles offres (semaine du ${opts.weekOf})`;
    const html = this.renderDigestHtml(opts);
    try {
      await this.transporter.sendMail({
        from: process.env.MAIL_FROM ?? 'no-reply@bghit-nekhdem.ma',
        to: opts.to,
        subject,
        html,
      });
    } catch (e) {
      this.logger.error(`Mail send failed: ${e.message}`);
      throw e;
    }
  }

  private renderDigestHtml({ candidateName, weekOf, jobs, manageUrl }: any) {
    const list = jobs
      .map(
        (j: any) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #eee;">
            <div style="font-weight:600;font-size:15px;">
              <a href="${process.env.APP_URL}/jobs/${j.slug ?? j.id}" style="color:#005DAA;text-decoration:none">${j.title}</a>
            </div>
            <div style="color:#555;font-size:13px;">
              ${j.companyName ?? ''} · ${j.city ?? ''}${j.country ? ', ' + j.country : ''} · ${j.jobType ?? ''}
            </div>
          </td>
        </tr>`,
      )
      .join('');

    return `
      <div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:auto;padding:24px">
        <h2 style="margin:0 0 8px 0;">Bonjour ${candidateName},</h2>
        <p style="margin:0 0 16px 0;">Voici jusqu’à <b>5 nouvelles offres</b> correspondant à votre alerte (semaine du ${weekOf}).</p>
        <table style="width:100%;border-collapse:collapse">${list}</table>
        <p style="margin-top:20px">
          <a href="${manageUrl}" style="background:#F59E0B;color:white;padding:10px 14px;border-radius:8px;text-decoration:none;">Gérer mes alertes</a>
        </p>
        <p style="color:#888;font-size:12px;margin-top:16px;">Vous recevez ce mail car vous avez une alerte active. Pour arrêter, désactivez l’alerte dans votre espace.</p>
      </div>
    `;
  }

  async sendSupportMessage(opts: {
    userId: number;
    userRole: string;
    userName?: string | null;
    userEmail?: string | null;
    accountEmail?: string | null;
    title: string;
    message: string;
  }) {
    const supportRecipient =
      this.config.get<string>('SUPPORT_EMAIL') ??
      this.config.get<string>('MAIL_SUPPORT_TO') ??
      this.config.get<string>('MAIL_USER');

    if (!supportRecipient) {
      throw new Error(
        'Support email recipient is not configured (SUPPORT_EMAIL or MAIL_SUPPORT_TO)',
      );
    }

    const safeTitle = this.escapeHtml(opts.title.trim());
    const safeMessage = this.escapeHtml(opts.message.trim()).replace(
      /\r?\n/g,
      '<br/>',
    );
    const safeName = this.escapeHtml(opts.userName?.trim() || 'Unknown');
    const safeContactEmail = this.escapeHtml(opts.userEmail?.trim() || 'Unknown');
    const safeAccountEmail = this.escapeHtml(
      opts.accountEmail?.trim() || 'Unknown',
    );
    const safeRole = this.escapeHtml(opts.userRole || 'unknown');

    await this.transporter.sendMail({
      from: this.config.get('MAIL_FROM'),
      to: supportRecipient,
      replyTo: opts.userEmail ?? undefined,
      subject: `[Support] ${opts.title.trim()}`,
      html: `
        <h2>Nouveau message de support</h2>
        <p><strong>Titre:</strong> ${safeTitle}</p>
        <p><strong>Message:</strong><br/>${safeMessage}</p>
        <hr/>
        <p><strong>User ID:</strong> ${opts.userId}</p>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Contact email:</strong> ${safeContactEmail}</p>
        <p><strong>Account email:</strong> ${safeAccountEmail}</p>
        <p><strong>Role:</strong> ${safeRole}</p>
      `,
    });
  }

  async sendJobDeletedByAdmin(opts: {
    to: string;
    employerName?: string | null;
    jobTitle: string;
    reason: string;
  }) {
    const safeEmployerName = this.escapeHtml(opts.employerName?.trim() || 'Employer');
    const safeJobTitle = this.escapeHtml(opts.jobTitle.trim());
    const safeReason = this.escapeHtml(opts.reason.trim()).replace(/\r?\n/g, '<br/>');

    await this.transporter.sendMail({
      from: this.config.get('MAIL_FROM'),
      to: opts.to,
      subject: `Votre annonce "${opts.jobTitle}" a été supprimée`,
      html: `
        <h2>Annonce supprimée par l'administration</h2>
        <p>Bonjour ${safeEmployerName},</p>
        <p>Votre annonce <strong>${safeJobTitle}</strong> a été supprimée.</p>
        <p><strong>Raison:</strong><br/>${safeReason}</p>
        <p>Vous pouvez publier une nouvelle annonce conforme aux règles de la plateforme.</p>
      `,
    });
  }

  async sendAdminCredentialsEmail(opts: {
    to: string;
    name: string;
    email: string;
    password: string;
  }) {
    const safeName = this.escapeHtml(opts.name.trim() || 'Admin');
    const safeEmail = this.escapeHtml(opts.email.trim());
    const safePassword = this.escapeHtml(opts.password);
    const loginUrl = this.config.get('WEB_URL') || this.config.get('APP_URL') || '';

    await this.transporter.sendMail({
      from: this.config.get('MAIL_FROM'),
      to: opts.to,
      subject: 'Vos identifiants administrateur - Ajitkhdem',
      html: `
        <h2>Compte administrateur créé</h2>
        <p>Bonjour ${safeName},</p>
        <p>Un compte administrateur a été créé pour vous sur Ajitkhdem.</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Mot de passe temporaire:</strong> ${safePassword}</p>
        <p>Connectez-vous puis changez votre mot de passe immédiatement.</p>
        ${loginUrl ? `<p><a href="${loginUrl}" target="_blank">Accéder à la plateforme</a></p>` : ''}
      `,
    });
  }

  private escapeHtml(input: string) {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

}
