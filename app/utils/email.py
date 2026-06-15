import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import current_app

def send_otp_email(to_email, otp):
    """
    Sends an OTP email to the user's email address using SMTP.
    Fallback: Prints OTP to the terminal console if SMTP is not configured or fails.
    """
    smtp_server = current_app.config.get("SMTP_SERVER")
    smtp_port = current_app.config.get("SMTP_PORT", 587)
    smtp_username = current_app.config.get("SMTP_USERNAME")
    smtp_password = current_app.config.get("SMTP_PASSWORD")
    smtp_sender = current_app.config.get("SMTP_SENDER")

    app_name = current_app.config.get("APP_NAME", "Smart Finance")

    subject = f"{otp} is your verification code for {app_name}"

    html_content = f"""
    <html>
      <body style="margin: 0; padding: 0; background-color: #020617; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #0b0f19; border: 1px solid #1e293b; border-radius: 16px; margin-top: 40px; margin-bottom: 40px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <tr>
            <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%); border-bottom: 1px solid #1e293b;">
              <h1 style="margin: 0; color: #a78bfa; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">{app_name}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px; color: #94a3b8; font-size: 16px; line-height: 1.6; text-align: center;">
              <h2 style="color: #f8fafc; font-size: 22px; font-weight: 700; margin-top: 0; margin-bottom: 20px;">Verify Your Email Address</h2>
              <p style="margin: 0 0 24px 0;">Thank you for signing up! Please use the 6-digit One-Time Password (OTP) below to complete your registration. This code will expire in {current_app.config.get('OTP_EXPIRY_MINUTES', 10)} minutes.</p>
              
              <div style="display: inline-block; background-color: #020617; border: 2px solid #8b5cf6; padding: 16px 32px; border-radius: 12px; margin-bottom: 24px;">
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #ffb800; display: block; margin-left: 8px;">{otp}</span>
              </div>
              
              <p style="margin: 0; font-size: 14px; color: #64748b;">If you did not request this verification code, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 30px; background-color: #070a13; text-align: center; border-top: 1px solid #1e293b;">
              <p style="margin: 0; font-size: 12px; color: #475569;">&copy; {current_app.config.get('APP_NAME')} System. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </body>
    </html>
    """

    # Check if SMTP configuration is set
    if not smtp_server or not smtp_username:
        print("\n" + "="*80)
        print(f" [MOCK SMTP] Verification email details:")
        print(f" To:      {to_email}")
        print(f" Subject: {subject}")
        print(f" OTP:     {otp}")
        print(" (Config SMTP_SERVER & SMTP_USERNAME in .env for real emails)")
        print("="*80 + "\n")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = smtp_sender
        msg["To"] = to_email

        # Attach text and html formats
        text_content = f"Your verification code for {app_name} is {otp}. This code is valid for {current_app.config.get('OTP_EXPIRY_MINUTES', 10)} minutes."
        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        # Setup SMTP server connection
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.ehlo()
        
        # Enable TLS
        if smtp_port == 587:
            server.starttls()
            server.ehlo()
            
        if smtp_password:
            server.login(smtp_username, smtp_password)

        server.sendmail(smtp_sender, to_email, msg.as_string())
        server.quit()
        print(f" [SMTP] Real email successfully sent to {to_email} with OTP {otp}.")
        return True
    except Exception as e:
        print("\n" + "!"*80)
        print(f" [SMTP ERROR] Failed to send real email to {to_email} due to: {e}")
        print(f" [FALLBACK OTP] The OTP code is: {otp}")
        print("!"*80 + "\n")
        return False


def send_reset_password_email(to_email, reset_url):
    """
    Sends a password reset link to the user's email address using SMTP.
    Fallback: Prints the reset URL to the terminal console if SMTP is not configured or fails.
    """
    smtp_server = current_app.config.get("SMTP_SERVER")
    smtp_port = current_app.config.get("SMTP_PORT", 587)
    smtp_username = current_app.config.get("SMTP_USERNAME")
    smtp_password = current_app.config.get("SMTP_PASSWORD")
    smtp_sender = current_app.config.get("SMTP_SENDER")

    app_name = current_app.config.get("APP_NAME", "Smart Finance")

    subject = f"Reset your password for {app_name}"

    html_content = f"""
    <html>
      <body style="margin: 0; padding: 0; background-color: #020617; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #0b0f19; border: 1px solid #1e293b; border-radius: 16px; margin-top: 40px; margin-bottom: 40px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <tr>
            <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%); border-bottom: 1px solid #1e293b;">
              <h1 style="margin: 0; color: #a78bfa; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">{app_name}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px; color: #94a3b8; font-size: 16px; line-height: 1.6; text-align: center;">
              <h2 style="color: #f8fafc; font-size: 22px; font-weight: 700; margin-top: 0; margin-bottom: 20px;">Reset Your Password</h2>
              <p style="margin: 0 0 24px 0;">We received a request to reset your password. Click the button below to set a new password. This link will expire shortly.</p>
              
              <div style="margin-bottom: 24px;">
                <a href="{reset_url}" style="display: inline-block; background-color: #8b5cf6; color: #ffffff; padding: 14px 28px; border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 16px; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);">Reset Password</a>
              </div>
              
              <p style="margin: 0 0 10px 0; font-size: 13px; color: #64748b;">If the button above does not work, copy and paste this URL into your browser:</p>
              <p style="margin: 0; font-size: 12px; color: #a78bfa; word-break: break-all;">{reset_url}</p>
              
              <p style="margin: 20px 0 0 0; font-size: 14px; color: #64748b;">If you did not request a password reset, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 30px; background-color: #070a13; text-align: center; border-top: 1px solid #1e293b;">
              <p style="margin: 0; font-size: 12px; color: #475569;">&copy; {app_name} System. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </body>
    </html>
    """

    if not smtp_server or not smtp_username:
        print("\n" + "="*80)
        print(f" [MOCK SMTP] Password reset email details:")
        print(f" To:      {to_email}")
        print(f" Subject: {subject}")
        print(f" Link:    {reset_url}")
        print(" (Config SMTP_SERVER & SMTP_USERNAME in .env for real emails)")
        print("="*80 + "\n")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = smtp_sender
        msg["To"] = to_email

        text_content = f"Please reset your password using this link: {reset_url}"
        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        server = smtplib.SMTP(smtp_server, smtp_port)
        server.ehlo()
        
        if smtp_port == 587:
            server.starttls()
            server.ehlo()
            
        if smtp_password:
            server.login(smtp_username, smtp_password)

        server.sendmail(smtp_sender, to_email, msg.as_string())
        server.quit()
        print(f" [SMTP] Password reset link sent to {to_email}.")
        return True
    except Exception as e:
        print("\n" + "!"*80)
        print(f" [SMTP ERROR] Failed to send reset email to {to_email} due to: {e}")
        print(f" [FALLBACK LINK] The reset URL is: {reset_url}")
        print("!"*80 + "\n")
        return False

