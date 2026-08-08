import nodemailer from 'nodemailer';

// Create transporter
const createTransporter = async () => {
  // For development, use Ethereal (fake SMTP)
  if (process.env.NODE_ENV !== 'production') {
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  // Production transporter
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

export const sendEmail = async ({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) => {
  try {
    const transporter = await createTransporter();
    
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Nexora Capital" <noreply@nexora.com>',
      to,
      subject,
      text: text || html.replace(/<[^>]*>/g, ''),
      html,
    });

    console.log('Email sent:', info.messageId);
    
    // In development, log the preview URL
    if (process.env.NODE_ENV !== 'production') {
      console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    }

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error };
  }
};

// Email templates
export const emailTemplates = {
  welcome: (firstName: string) => ({
    subject: 'Welcome to Nexora Capital',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e3a5f;">Welcome to Nexora Capital, ${firstName}!</h2>
        <p>Thank you for joining our premium investment platform. We're excited to help you build wealth through professional portfolio management.</p>
        <p>To get started:</p>
        <ol>
          <li>Complete your profile</li>
          <li>Set your investment goal</li>
          <li>Make your first deposit</li>
        </ol>
        <p>If you have any questions, our support team is here to help.</p>
        <p>Best regards,<br>The Nexora Capital Team</p>
      </div>
    `,
  }),

  depositReceived: (amount: string, currency: string) => ({
    subject: 'Deposit Received - Pending Confirmation',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e3a5f;">Deposit Received</h2>
        <p>We have received your deposit request:</p>
        <div style="background: #f5f5f4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Amount:</strong> ${amount} ${currency}</p>
          <p><strong>Status:</strong> Pending Confirmation</p>
        </div>
        <p>Our team will review and confirm your deposit within 1-2 hours. You will receive another notification once confirmed.</p>
        <p>Best regards,<br>The Nexora Capital Team</p>
      </div>
    `,
  }),

  depositConfirmed: (amount: string, currency: string) => ({
    subject: 'Deposit Confirmed',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #22c55e;">Deposit Confirmed! 🎉</h2>
        <p>Your deposit has been confirmed and added to your portfolio:</p>
        <div style="background: #f5f5f4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Amount:</strong> ${amount} ${currency}</p>
          <p><strong>Status:</strong> ✅ Confirmed</p>
        </div>
        <p>Your funds are now active and earning daily returns.</p>
        <p>Best regards,<br>The Nexora Capital Team</p>
      </div>
    `,
  }),

  withdrawalRequested: (amount: string, currency: string) => ({
    subject: 'Withdrawal Request Received',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e3a5f;">Withdrawal Request Received</h2>
        <p>We have received your withdrawal request:</p>
        <div style="background: #f5f5f4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Amount:</strong> ${amount} ${currency}</p>
          <p><strong>Status:</strong> Pending Review</p>
        </div>
        <p>Our team will review your request within 24-48 hours. You will receive another notification once processed.</p>
        <p>Best regards,<br>The Nexora Capital Team</p>
      </div>
    `,
  }),

  withdrawalProcessed: (amount: string, currency: string, txHash?: string) => ({
    subject: 'Withdrawal Processed',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #22c55e;">Withdrawal Processed! 🎉</h2>
        <p>Your withdrawal has been processed:</p>
        <div style="background: #f5f5f4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Amount:</strong> ${amount} ${currency}</p>
          <p><strong>Status:</strong> ✅ Completed</p>
          ${txHash ? `<p><strong>Transaction Hash:</strong> ${txHash}</p>` : ''}
        </div>
        <p>Your funds should arrive in your wallet shortly.</p>
        <p>Best regards,<br>The Nexora Capital Team</p>
      </div>
    `,
  }),

  weeklySummary: (
    firstName: string,
    portfolioValue: string,
    totalProfit: string,
    profitPercentage: string
  ) => ({
    subject: 'Your Weekly Portfolio Summary',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e3a5f;">Weekly Portfolio Summary</h2>
        <p>Hi ${firstName},</p>
        <p>Here's how your portfolio performed this week:</p>
        <div style="background: #f5f5f4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Portfolio Value:</strong> $${portfolioValue}</p>
          <p><strong>Total Profit:</strong> $${totalProfit}</p>
          <p><strong>Return:</strong> ${profitPercentage}%</p>
        </div>
        <p>Keep up the great work!</p>
        <p>Best regards,<br>The Nexora Capital Team</p>
      </div>
    `,
  }),

  goalMilestone: (goalName: string, progress: string) => ({
    subject: `🎯 Goal Milestone: ${progress}% Reached!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e3a5f;">Goal Milestone Reached! 🎉</h2>
        <p>Congratulations! You've reached a major milestone:</p>
        <div style="background: #f5f5f4; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <h3 style="color: #1e3a5f; margin: 0;">${goalName}</h3>
          <p style="font-size: 48px; font-weight: bold; color: #22c55e; margin: 10px 0;">${progress}%</p>
          <p style="color: #78716c;">Complete</p>
        </div>
        <p>You're making excellent progress toward your financial goals!</p>
        <p>Best regards,<br>The Nexora Capital Team</p>
      </div>
    `,
  }),
};
