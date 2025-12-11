import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email
  };
}

export async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: SendEmailOptions) {
  const { client, fromEmail } = await getResendClient();
  
  return client.emails.send({
    from: fromEmail,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getWelcomeEmailHtml(firstName?: string | null): string {
  const safeName = firstName ? escapeHtml(firstName) : null;
  const greeting = safeName ? `Hey Coach ${safeName}` : "Hey Coach";
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to RC Football</title>
</head>
<body style="margin: 0; padding: 0; background-color: #1a1a2e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
          
          <!-- Header with Logo -->
          <tr>
            <td style="padding: 30px 40px; background-color: #0f172a; border-radius: 12px 12px 0 0; text-align: center;">
              <table role="presentation" style="margin: 0 auto;">
                <tr>
                  <td style="background-color: #f97316; width: 48px; height: 48px; border-radius: 8px; text-align: center; vertical-align: middle;">
                    <span style="color: #0f172a; font-size: 20px; font-weight: bold;">RC</span>
                  </td>
                  <td style="padding-left: 12px;">
                    <span style="color: #f97316; font-size: 24px; font-weight: bold;">RC Football</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px; background-color: #1e293b;">
              <h1 style="color: #f97316; font-size: 28px; margin: 0 0 24px 0; font-weight: 600;">
                ${greeting} -
              </h1>
              
              <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Football is a game of inches and you've made the first move shifting that one inch into your favor by starting to design your plays with RC Football's play designer.
              </p>
              
              <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                You've unlocked the ability to:
              </p>
              
              <table role="presentation" style="width: 100%; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px 16px; background-color: #334155; border-radius: 8px; margin-bottom: 8px;">
                    <span style="color: #f97316; font-size: 18px; margin-right: 8px;">&#10003;</span>
                    <span style="color: #e2e8f0; font-size: 15px;">Save your plays</span>
                  </td>
                </tr>
                <tr><td style="height: 8px;"></td></tr>
                <tr>
                  <td style="padding: 12px 16px; background-color: #334155; border-radius: 8px;">
                    <span style="color: #f97316; font-size: 18px; margin-right: 8px;">&#10003;</span>
                    <span style="color: #e2e8f0; font-size: 15px;">Access our most popular play templates</span>
                  </td>
                </tr>
                <tr><td style="height: 8px;"></td></tr>
                <tr>
                  <td style="padding: 12px 16px; background-color: #334155; border-radius: 8px;">
                    <span style="color: #f97316; font-size: 18px; margin-right: 8px;">&#10003;</span>
                    <span style="color: #e2e8f0; font-size: 15px;">Put our AI Beta features to use</span>
                  </td>
                </tr>
              </table>
              
              <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                We're still early but love hearing from coaches like you. What specifically were you looking for when you decided to sign up and is there anything we can help you with to get started?
              </p>
              
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0; font-style: italic;">
                Just reply to this email - we read every message.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="color: #64748b; font-size: 13px; margin: 0;">
                RC Football - Design plays. Build your playbook. Dominate.
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
}

function getWelcomeEmailText(firstName?: string | null): string {
  const greeting = firstName ? `Hey Coach ${firstName}` : "Hey Coach";
  
  return `
${greeting} -

Football is a game of inches and you've made the first move shifting that one inch into your favor by starting to design your plays with RC Football's play designer.

You've unlocked the ability to:
- Save your plays
- Access our most popular play templates
- Put our AI Beta features to use

We're still early but love hearing from coaches like you. What specifically were you looking for when you decided to sign up and is there anything we can help you with to get started?

Just reply to this email - we read every message.

---
RC Football - Design plays. Build your playbook. Dominate.
  `.trim();
}

export async function sendWelcomeEmail(email: string, firstName?: string | null) {
  return sendEmail({
    to: email,
    subject: "Welcome to RC Football, Coach!",
    html: getWelcomeEmailHtml(firstName),
    text: getWelcomeEmailText(firstName)
  });
}

function getPasswordResetEmailHtml(resetLink: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password - RC Football</title>
</head>
<body style="margin: 0; padding: 0; background-color: #1a1a2e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
          
          <!-- Header with Logo -->
          <tr>
            <td style="padding: 30px 40px; background-color: #0f172a; border-radius: 12px 12px 0 0; text-align: center;">
              <table role="presentation" style="margin: 0 auto;">
                <tr>
                  <td style="background-color: #f97316; width: 48px; height: 48px; border-radius: 8px; text-align: center; vertical-align: middle;">
                    <span style="color: #0f172a; font-size: 20px; font-weight: bold;">RC</span>
                  </td>
                  <td style="padding-left: 12px;">
                    <span style="color: #f97316; font-size: 24px; font-weight: bold;">RC Football</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px; background-color: #1e293b;">
              <h1 style="color: #f97316; font-size: 28px; margin: 0 0 24px 0; font-weight: 600;">
                Reset Your Password
              </h1>
              
              <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                We received a request to reset your password. Click the button below to create a new password:
              </p>
              
              <table role="presentation" style="width: 100%; margin: 32px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" style="display: inline-block; padding: 14px 32px; background-color: #f97316; color: #0f172a; font-size: 16px; font-weight: bold; text-decoration: none; border-radius: 8px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
                This link will expire in 1 hour for security reasons.
              </p>
              
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0;">
                If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
              
              <hr style="border: none; border-top: 1px solid #334155; margin: 24px 0;" />
              
              <p style="color: #64748b; font-size: 12px; line-height: 1.6; margin: 0;">
                If the button doesn't work, copy and paste this link into your browser:<br/>
                <a href="${resetLink}" style="color: #f97316; word-break: break-all;">${resetLink}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="color: #64748b; font-size: 13px; margin: 0;">
                RC Football - Design plays. Build your playbook. Dominate.
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
}

function getPasswordResetEmailText(resetLink: string): string {
  return `
Reset Your Password - RC Football

We received a request to reset your password. Visit the link below to create a new password:

${resetLink}

This link will expire in 1 hour for security reasons.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

---
RC Football - Design plays. Build your playbook. Dominate.
  `.trim();
}

export async function sendPasswordResetEmail(email: string, resetLink: string) {
  return sendEmail({
    to: email,
    subject: "Reset Your Password - RC Football",
    html: getPasswordResetEmailHtml(resetLink),
    text: getPasswordResetEmailText(resetLink)
  });
}

interface FeatureRequestData {
  userType: string;
  featureDescription: string;
  useCase: string;
}

function getFeatureRequestEmailHtml(data: FeatureRequestData): string {
  const safeUserType = escapeHtml(data.userType);
  const safeFeature = escapeHtml(data.featureDescription);
  const safeUseCase = escapeHtml(data.useCase);
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Feature Request - RC Football</title>
</head>
<body style="margin: 0; padding: 0; background-color: #1a1a2e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 30px 40px; background-color: #0f172a; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: #22c55e; font-size: 24px; margin: 0; font-weight: bold;">New Feature Request</h1>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px; background-color: #1e293b;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td style="padding: 16px; background-color: #334155; border-radius: 8px; margin-bottom: 16px;">
                    <p style="color: #94a3b8; font-size: 12px; text-transform: uppercase; margin: 0 0 8px 0;">User Type</p>
                    <p style="color: #e2e8f0; font-size: 16px; margin: 0; font-weight: 600;">${safeUserType}</p>
                  </td>
                </tr>
                <tr><td style="height: 16px;"></td></tr>
                <tr>
                  <td style="padding: 16px; background-color: #334155; border-radius: 8px;">
                    <p style="color: #94a3b8; font-size: 12px; text-transform: uppercase; margin: 0 0 8px 0;">Feature Request</p>
                    <p style="color: #e2e8f0; font-size: 16px; margin: 0; line-height: 1.6; white-space: pre-wrap;">${safeFeature}</p>
                  </td>
                </tr>
                <tr><td style="height: 16px;"></td></tr>
                <tr>
                  <td style="padding: 16px; background-color: #334155; border-radius: 8px;">
                    <p style="color: #94a3b8; font-size: 12px; text-transform: uppercase; margin: 0 0 8px 0;">Use Case</p>
                    <p style="color: #e2e8f0; font-size: 16px; margin: 0; line-height: 1.6; white-space: pre-wrap;">${safeUseCase}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="color: #64748b; font-size: 13px; margin: 0;">
                RC Football - Feature Request System
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
}

function getFeatureRequestEmailText(data: FeatureRequestData): string {
  return `
New Feature Request - RC Football

USER TYPE: ${data.userType}

FEATURE REQUEST:
${data.featureDescription}

USE CASE:
${data.useCase}

---
RC Football - Feature Request System
  `.trim();
}

export async function sendFeatureRequestEmail(data: FeatureRequestData) {
  return sendEmail({
    to: "ray@raymcarroll.com",
    subject: `New Feature Request from ${data.userType}`,
    html: getFeatureRequestEmailHtml(data),
    text: getFeatureRequestEmailText(data)
  });
}
