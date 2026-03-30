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
      secure: false,
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
      subject: 'Verification de votre adresse email - Aji Tkhdem',
      html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #005DAA;">Bienvenue sur Aji Tkhdem</h2>
        <p>Merci pour votre inscription sur <strong>Aji Tkhdem</strong>.</p>
        <p>Afin d'activer votre compte, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous :</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${verifyUrl}"
             style="
               background-color: #005DAA;
               color: #ffffff;
               padding: 12px 24px;
               text-decoration: none;
               border-radius: 6px;
               display: inline-block;
               font-weight: bold;
             "
             target="_blank">
            Verifier mon email
          </a>
        </p>
        <p>Si le bouton ne fonctionne pas, vous pouvez copier et coller ce lien dans votre navigateur :</p>
        <p style="word-break: break-all; color: #555;">${verifyUrl}</p>
        <p style="margin-top: 20px;">Ce lien est valable pendant <strong>24 heures</strong>.</p>
        <p>Si vous n'etes pas a l'origine de cette inscription, vous pouvez ignorer cet email.</p>
        <hr style="margin: 30px 0;" />
        <p style="font-size: 12px; color: #888;">
          &copy; ${new Date().getFullYear()} Aji Tkhdem. Tous droits reserves.
        </p>
      </div>
    `,
    });
  }

  async sendResetPasswordEmail(to: string, token: string) {
    const resetUrl = `${this.config.get('WEB_URL')}/reset-password?token=${token}`;

    await this.transporter.sendMail({
      from: this.config.get('MAIL_FROM'),
      to,
      subject: 'Reinitialisation de votre mot de passe - Aji Tkhdem',
      html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #005DAA;">Reinitialisation de votre mot de passe</h2>
        <p>Vous avez demande la reinitialisation de votre mot de passe sur <strong>Aji Tkhdem</strong>.</p>
        <p>Cliquez sur le bouton ci-dessous pour definir un nouveau mot de passe :</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}"
             style="
               background-color: #F59E0B;
               color: #ffffff;
               padding: 12px 24px;
               text-decoration: none;
               border-radius: 6px;
               display: inline-block;
               font-weight: bold;
             "
             target="_blank">
            Reinitialiser mon mot de passe
          </a>
        </p>
        <p>Si le bouton ne fonctionne pas, vous pouvez copier et coller ce lien dans votre navigateur :</p>
        <p style="word-break: break-all; color: #555;">${resetUrl}</p>
        <p style="margin-top: 20px;">Pour des raisons de securite, ce lien est valable pendant une duree limitee.</p>
        <p>Si vous n'etes pas a l'origine de cette demande, vous pouvez ignorer cet email en toute securite.</p>
        <hr style="margin: 30px 0;" />
        <p style="font-size: 12px; color: #888;">
          &copy; ${new Date().getFullYear()} Aji Tkhdem. Tous droits reserves.
        </p>
      </div>
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
      subject: `Votre candidature pour "${jobTitle}" a bien ete recue - Aji Tkhdem`,
      html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color:#005DAA;">Candidature envoyee avec succes</h2>
        <p>Bonjour,</p>
        <p>Nous confirmons la bonne reception de votre candidature pour le poste :</p>
        <p style="font-size:16px; font-weight:bold; color:#000;">${jobTitle}</p>
        <p>
          ${
            employerName
              ? `Votre candidature a ete transmise a l'employeur <strong>${employerName}</strong>.`
              : `Votre candidature a ete transmise a l'employeur.`
          }
        </p>
        <p>Celui-ci examinera votre profil et pourra vous contacter directement si votre candidature correspond a ses besoins.</p>
        <p style="margin-top: 20px;">En attendant, continuez a explorer d'autres opportunites pour maximiser vos chances.</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${this.config.get('WEB_URL')}"
             style="
               background-color: #005DAA;
               color: #ffffff;
               padding: 12px 24px;
               text-decoration: none;
               border-radius: 6px;
               display: inline-block;
               font-weight: bold;
             "
             target="_blank">
            Voir plus d'offres
          </a>
        </p>
        <hr style="margin: 30px 0;" />
        <p style="font-size: 12px; color: #888;">
          &copy; ${new Date().getFullYear()} Aji Tkhdem. Tous droits reserves.<br/>
          <a href="${this.config.get('WEB_URL')}" target="_blank" style="color:#888;">
            ${this.config.get('WEB_URL')}
          </a>
        </p>
      </div>
    `,
    });
  }

  async sendInterviewInvitation(opts: {
    to: string;
    jobTitle: string;
    interviewAt: Date;
    message?: string;
  }) {
    const when = opts.interviewAt.toLocaleString('fr-FR', {
      dateStyle: 'full',
      timeStyle: 'short',
    });

    await this.transporter.sendMail({
      from: this.config.get('MAIL_FROM'),
      to: opts.to,
      subject: `Invitation a un entretien - ${opts.jobTitle} | Aji Tkhdem`,
      html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color:#005DAA;">Bonne nouvelle</h2>
        <p>Bonjour,</p>
        <p>Votre candidature pour le poste <strong>${this.escapeHtml(opts.jobTitle)}</strong> a retenu l'attention du recruteur.</p>
        <p>Vous etes invite(e) a participer a un entretien.</p>
        <p style="margin: 20px 0; font-size: 16px;">
          <strong>Date proposee :</strong><br/>
          ${this.escapeHtml(when)}
        </p>
        ${
          opts.message
            ? `
          <p>${this.escapeHtml(opts.message).replace(/\r?\n/g, '<br/>')}</p>
        `
            : ''
        }
        <p style="margin-top: 20px;">Merci de confirmer votre disponibilite en repondant a cet email.</p>
        <p style="margin-top: 20px;">Nous vous souhaitons bonne chance pour votre entretien.</p>
        <hr style="margin: 30px 0;" />
        <p style="font-size: 12px; color: #888;">
          &copy; ${new Date().getFullYear()} Aji Tkhdem. Tous droits reserves.<br/>
          <a href="${this.config.get('WEB_URL')}" target="_blank" style="color:#888;">
            ${this.config.get('WEB_URL')}
          </a>
        </p>
      </div>
    `,
    });
  }

  async sendApplicationRejection(opts: {
    to: string;
    jobTitle: string;
    reason: string;
    message?: string;
  }) {
    await this.transporter.sendMail({
      from: this.config.get('MAIL_FROM'),
      to: opts.to,
      subject: `Mise a jour de votre candidature - ${opts.jobTitle} | Aji Tkhdem`,
      html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color:#005DAA;">Mise a jour de votre candidature</h2>
        <p>Bonjour,</p>
        <p>Nous vous remercions pour l'interet que vous avez porte au poste :</p>
        <p style="font-size:16px; font-weight:bold; color:#000;">${this.escapeHtml(opts.jobTitle)}</p>
        <p>Apres etude de votre candidature, nous regrettons de vous informer que celle-ci n'a pas ete retenue pour cette opportunite.</p>
        <p><strong>Motif :</strong> ${this.escapeHtml(opts.reason)}</p>
        ${
          opts.message
            ? `
          <p>${this.escapeHtml(opts.message).replace(/\r?\n/g, '<br/>')}</p>
        `
            : ''
        }
        <p style="margin-top: 20px;">Nous vous encourageons a continuer vos recherches et a postuler a d'autres opportunites correspondant a votre profil.</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${this.config.get('WEB_URL')}"
             style="
               background-color: #005DAA;
               color: #ffffff;
               padding: 12px 24px;
               text-decoration: none;
               border-radius: 6px;
               display: inline-block;
               font-weight: bold;
             "
             target="_blank">
            Voir d'autres offres
          </a>
        </p>
        <p>Nous vous souhaitons plein succes dans la suite de vos demarches professionnelles.</p>
        <hr style="margin: 30px 0;" />
        <p style="font-size: 12px; color: #888;">
          &copy; ${new Date().getFullYear()} Aji Tkhdem. Tous droits reserves.<br/>
          <a href="${this.config.get('WEB_URL')}" target="_blank" style="color:#888;">
            ${this.config.get('WEB_URL')}
          </a>
        </p>
      </div>
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
    const subject = `Aji Tkhdem - Vos nouvelles offres d'emploi (semaine du ${opts.weekOf})`;
    const html = this.renderDigestHtml(opts);

    try {
      await this.transporter.sendMail({
        from: this.config.get('MAIL_FROM') ?? 'no-reply@ajitkhdem.com',
        to: opts.to,
        subject,
        html,
      });
    } catch (e: any) {
      this.logger.error(`Mail send failed: ${e.message}`);
      throw e;
    }
  }

  private renderDigestHtml({ candidateName, weekOf, jobs, manageUrl }: any) {
    const list = jobs
      .map(
        (j: any) => `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #eee;">
            <div style="font-weight:600;font-size:15px; margin-bottom:4px;">
              <a href="${this.config.get('WEB_URL')}/jobs/${j.slug ?? j.id}"
                 style="color:#005DAA;text-decoration:none;">
                ${this.escapeHtml(j.title ?? '')}
              </a>
            </div>
            <div style="color:#555;font-size:13px;">
              ${this.escapeHtml(j.companyName ?? '')}
              ${j.city ? ` · ${this.escapeHtml(j.city)}` : ''}
              ${j.country ? `, ${this.escapeHtml(j.country)}` : ''}
              ${j.jobType ? ` · ${this.escapeHtml(j.jobType)}` : ''}
            </div>
          </td>
        </tr>
      `,
      )
      .join('');

    return `
    <div style="font-family:Arial, sans-serif; max-width:640px; margin:auto; padding:24px; color:#333;">
      <h2 style="margin:0 0 8px 0; color:#005DAA;">Vos nouvelles opportunites</h2>
      <p style="margin:0 0 16px 0;">Bonjour <strong>${this.escapeHtml(candidateName)}</strong>,</p>
      <p style="margin:0 0 16px 0;">
        Voici une selection de nouvelles offres publiees sur <strong>Aji Tkhdem</strong>
        pour la semaine du <strong>${this.escapeHtml(weekOf)}</strong>,
        correspondant a votre profil.
      </p>
      <table style="width:100%;border-collapse:collapse;">
        ${list}
      </table>
      <p style="text-align:center; margin:30px 0;">
        <a href="${manageUrl}"
           style="
             background:#F59E0B;
             color:white;
             padding:12px 20px;
             border-radius:8px;
             text-decoration:none;
             font-weight:bold;
             display:inline-block;
           ">
          Gerer mes alertes
        </a>
      </p>
      <p style="margin-top:10px;">Continuez a explorer la plateforme pour decouvrir encore plus d'opportunites adaptees a votre profil.</p>
      <hr style="margin:30px 0;" />
      <p style="color:#888;font-size:12px;">
        Vous recevez cet email car vous avez active une alerte emploi sur Aji Tkhdem.<br/>
        Vous pouvez modifier ou desactiver vos alertes a tout moment.
      </p>
      <p style="font-size:12px; color:#888; margin-top:8px;">
        &copy; ${new Date().getFullYear()} Aji Tkhdem. Tous droits reserves.
      </p>
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
    const safeName = this.escapeHtml(opts.userName?.trim() || 'Non renseigne');
    const safeContactEmail = this.escapeHtml(
      opts.userEmail?.trim() || 'Non renseigne',
    );
    const safeAccountEmail = this.escapeHtml(
      opts.accountEmail?.trim() || 'Non renseigne',
    );
    const safeRole = this.escapeHtml(opts.userRole || 'Non renseigne');

    await this.transporter.sendMail({
      from: this.config.get('MAIL_FROM'),
      to: supportRecipient,
      replyTo: opts.userEmail ?? undefined,
      subject: `[Support Aji Tkhdem] ${opts.title.trim()}`,
      html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color:#005DAA;">Nouveau message de support</h2>
        <p>Un nouvel utilisateur a envoye une demande de support via <strong>Aji Tkhdem</strong>.</p>
        <p><strong>Titre :</strong> ${safeTitle}</p>
        <p><strong>Message :</strong><br/>${safeMessage}</p>
        <hr style="margin: 24px 0;" />
        <h3 style="color:#005DAA; font-size:16px; margin-bottom:12px;">Informations utilisateur</h3>
        <p><strong>ID utilisateur :</strong> ${opts.userId}</p>
        <p><strong>Nom :</strong> ${safeName}</p>
        <p><strong>Email de contact :</strong> ${safeContactEmail}</p>
        <p><strong>Email du compte :</strong> ${safeAccountEmail}</p>
        <p><strong>Role :</strong> ${safeRole}</p>
        <hr style="margin: 24px 0;" />
        <p style="font-size:12px; color:#888;">
          &copy; ${new Date().getFullYear()} Aji Tkhdem. Notification automatique du support.
        </p>
      </div>
    `,
    });
  }

  async sendJobDeletedByAdmin(opts: {
    to: string;
    employerName?: string | null;
    jobTitle: string;
    reason: string;
  }) {
    const safeEmployerName = this.escapeHtml(
      opts.employerName?.trim() || 'Utilisateur',
    );
    const safeJobTitle = this.escapeHtml(opts.jobTitle.trim());
    const safeReason = this.escapeHtml(opts.reason.trim()).replace(
      /\r?\n/g,
      '<br/>',
    );

    await this.transporter.sendMail({
      from: this.config.get('MAIL_FROM'),
      to: opts.to,
      subject: `Annonce supprimee - ${opts.jobTitle} | Aji Tkhdem`,
      html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color:#005DAA;">Annonce supprimee par l'administration</h2>
        <p>Bonjour <strong>${safeEmployerName}</strong>,</p>
        <p>Nous vous informons que votre annonce suivante a ete retiree de la plateforme <strong>Aji Tkhdem</strong> :</p>
        <p style="font-size:16px; font-weight:bold; color:#000;">${safeJobTitle}</p>
        <p><strong>Motif :</strong><br/>${safeReason}</p>
        <p style="margin-top: 20px;">Vous pouvez publier une nouvelle annonce en veillant a respecter les regles et conditions d'utilisation de la plateforme.</p>
        <p style="margin-top: 20px;">Si vous pensez qu'il s'agit d'une erreur ou souhaitez plus d'informations, n'hesitez pas a contacter notre support.</p>
        <p style="text-align:center; margin:30px 0;">
          <a href="${this.config.get('WEB_URL')}/dashboard/jobs"
             style="
               background:#005DAA;
               color:white;
               padding:12px 20px;
               border-radius:8px;
               text-decoration:none;
               font-weight:bold;
               display:inline-block;
             "
             target="_blank">
            Gerer mes annonces
          </a>
        </p>
        <hr style="margin: 30px 0;" />
        <p style="font-size:12px; color:#888;">
          &copy; ${new Date().getFullYear()} Aji Tkhdem. Tous droits reserves.
        </p>
      </div>
    `,
    });
  }

  async sendAdminCredentialsEmail(opts: {
    to: string;
    name: string;
    email: string;
    password: string;
  }) {
    const safeName = this.escapeHtml(opts.name.trim() || 'Administrateur');
    const safeEmail = this.escapeHtml(opts.email.trim());
    const safePassword = this.escapeHtml(opts.password);
    const loginUrl =
      this.config.get('WEB_URL') || this.config.get('APP_URL') || '';

    await this.transporter.sendMail({
      from: this.config.get('MAIL_FROM'),
      to: opts.to,
      subject: 'Acces administrateur - Aji Tkhdem',
      html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color:#005DAA;">Compte administrateur cree</h2>
        <p>Bonjour <strong>${safeName}</strong>,</p>
        <p>Un compte administrateur a ete cree pour vous sur <strong>Aji Tkhdem</strong>.</p>
        <p style="margin:20px 0;">
          <strong>Email :</strong> ${safeEmail}<br/>
          <strong>Mot de passe temporaire :</strong> ${safePassword}
        </p>
        <p style="color:#d9534f; font-weight:bold;">
          Pour des raisons de securite, veuillez vous connecter et modifier votre mot de passe immediatement.
        </p>
        ${
          loginUrl
            ? `
          <p style="text-align:center; margin:30px 0;">
            <a href="${loginUrl}"
               style="
                 background:#005DAA;
                 color:white;
                 padding:12px 20px;
                 border-radius:8px;
                 text-decoration:none;
                 font-weight:bold;
                 display:inline-block;
               "
               target="_blank">
              Acceder a la plateforme
            </a>
          </p>
        `
            : ''
        }
        <p style="margin-top: 20px;">Si vous n'etes pas a l'origine de cette creation de compte, veuillez contacter immediatement le support.</p>
        <hr style="margin: 30px 0;" />
        <p style="font-size:12px; color:#888;">
          &copy; ${new Date().getFullYear()} Aji Tkhdem. Acces securise administrateur.
        </p>
      </div>
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
