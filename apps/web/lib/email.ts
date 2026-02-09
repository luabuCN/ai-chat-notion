import nodemailer from "nodemailer";

// 创建 QQ 邮箱 SMTP 传输器
const transporter = nodemailer.createTransport({
  host: "smtp.qq.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // QQ 邮箱授权码
  },
});

// 发送验证码邮件
export async function sendVerificationCodeEmail(
  email: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await transporter.sendMail({
      from: `"AI Chat" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "您的登录验证码",
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; text-align: center;">登录验证码</h2>
          <p style="color: #666; text-align: center;">您的验证码是：</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${code}</span>
          </div>
          <p style="color: #999; font-size: 14px; text-align: center;">验证码 5 分钟内有效，请勿泄露给他人。</p>
        </div>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error("发送验证码邮件失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "发送邮件失败",
    };
  }
}
