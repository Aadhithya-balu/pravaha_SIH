"""
PRAVAHA — AICTE Regulatory Workflow Notification & Email Service
Handles asynchronous email delivery, SMTP transport, template formatting,
and persistent email delivery auditing in the authoritative database.
"""
import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Dict, Any, Optional

logger = logging.getLogger("pravaha.email")

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", "notifications@pravaha.aicte-india.org")
EMAIL_ENABLED = os.getenv("EMAIL_ENABLED", "false").lower() in ["true", "1", "yes"]

# In-memory delivery buffer accessible for fast diagnostics
DELIVERY_LOGS = []


def is_email_configured() -> bool:
    """Returns True if a live SMTP server is configured."""
    return EMAIL_ENABLED and bool(SMTP_HOST and SMTP_USER and SMTP_PASS)


def get_email_status() -> Dict[str, Any]:
    """Returns email service operational status and diagnostics."""
    total_db_records = 0
    try:
        from .models import EmailDeliveryRecord
        from .db import SessionLocal, DATABASE_READY
        if DATABASE_READY:
            with SessionLocal() as db:
                total_db_records = db.query(EmailDeliveryRecord).count()
    except Exception:
        pass

    return {
        "configured": is_email_configured(),
        "enabled": EMAIL_ENABLED,
        "smtp_host": SMTP_HOST or "Unconfigured (Local fallback active)",
        "smtp_port": SMTP_PORT,
        "sender": SMTP_FROM,
        "total_attempted": len(DELIVERY_LOGS),
        "total_persisted_in_db": total_db_records,
        "recent_deliveries": DELIVERY_LOGS[-10:]
    }


def send_workflow_email(
    recipient: str,
    subject: str,
    template_type: str,
    context: Dict[str, Any],
    db: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Sends a formatted regulatory email to institutional applicants or officers.
    Records delivery audit in both memory buffer and authoritative database.
    """
    app_ref = context.get("reference", "N/A")
    inst_name = context.get("institution_name", "Applicant Institution")
    stage = context.get("stage", "SCRUTINY")
    action_url = context.get("action_url", "http://localhost:5173")
    details = context.get("details", "")

    # Build Plaintext and HTML message bodies
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1E293B; }}
        .header {{ background: #0F172A; color: #FFFFFF; padding: 20px; border-radius: 6px 6px 0 0; }}
        .header h2 {{ margin: 0; font-size: 18px; color: #FFFFFF; }}
        .header p {{ margin: 4px 0 0; font-size: 12px; color: #94A3B8; }}
        .content {{ padding: 24px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 6px 6px; background: #FFFFFF; }}
        .badge {{ display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background: #EEF2FF; color: #4338CA; }}
        .details-box {{ background: #F8FAFC; border: 1px solid #E2E8F0; border-left: 4px solid #2563EB; padding: 12px 16px; margin: 16px 0; border-radius: 4px; font-size: 13px; }}
        .btn {{ display: inline-block; padding: 10px 20px; background: #2563EB; color: #FFFFFF; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600; margin-top: 16px; }}
        .footer {{ margin-top: 24px; font-size: 11px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 12px; }}
      </style>
    </head>
    <body>
      <div class="header">
        <h2>AICTE — PRAVAHA Regulatory Operations Platform</h2>
        <p>Approval Process Handbook (APH 2024–2027) Regulatory Workflow Notice</p>
      </div>
      <div class="content">
        <p>Dear <b>{inst_name}</b>,</p>
        <p>An official status update has been registered regarding your application dossier:</p>
        
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 12px 0;">
          <tr>
            <td style="padding: 6px 0; color: #64748B; width: 140px;">Application Reference:</td>
            <td style="padding: 6px 0; font-family: monospace; font-weight: bold;">{app_ref}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748B;">Current Stage:</td>
            <td style="padding: 6px 0;"><span class="badge">{stage}</span></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748B;">Notice Type:</td>
            <td style="padding: 6px 0; font-weight: 600;">{subject}</td>
          </tr>
        </table>

        <div class="details-box">
          <b>Official Directive / Remarks:</b><br/>
          {details or "Your application status has advanced to the next regulatory workflow stage."}
        </div>

        <p>Please log in to the PRAVAHA Institutional Portal to review full findings, respond to directives, or download orders:</p>
        <a href="{action_url}" class="btn">Open Application in PRAVAHA Portal &rarr;</a>

        <div class="footer">
          This is an automated statutory communication issued by the All India Council for Technical Education (AICTE) Scrutiny System.
          Please do not reply directly to this automated email.
        </div>
      </div>
    </body>
    </html>
    """

    delivery_record = {
        "recipient": recipient,
        "subject": subject,
        "template": template_type,
        "reference": app_ref,
        "timestamp": datetime.utcnow().isoformat(),
        "status": "SENT" if is_email_configured() else "LOGGED_LOCAL"
    }

    if is_email_configured():
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"[PRAVAHA] {subject} - {app_ref}"
            msg["From"] = SMTP_FROM
            msg["To"] = recipient

            text_body = f"PRAVAHA AICTE Notification:\n\nApplication: {app_ref}\nInstitution: {inst_name}\nStage: {stage}\nSubject: {subject}\n\nDetails: {details}\n\nLogin at: {action_url}\n"
            msg.attach(MIMEText(text_body, "plain"))
            msg.attach(MIMEText(html_body, "html"))

            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASS)
                server.send_message(msg)

            delivery_record["status"] = "DELIVERED"
            logger.info(f"Delivered email notice to {recipient} for {app_ref}")
        except Exception as e:
            delivery_record["status"] = "FAILED"
            delivery_record["error"] = str(e)
            logger.error(f"Failed to deliver SMTP email to {recipient}: {e}")
    else:
        logger.info(f"[EMAIL MOCK/LOG] To: {recipient} | Subject: {subject} | Ref: {app_ref}")

    DELIVERY_LOGS.append(delivery_record)
    if len(DELIVERY_LOGS) > 100:
        DELIVERY_LOGS.pop(0)

    # Persist in authoritative database
    try:
        from .models import EmailDeliveryRecord
        from .db import SessionLocal, DATABASE_READY

        should_close = False
        active_db = db
        if active_db is None and DATABASE_READY:
            active_db = SessionLocal()
            should_close = True

        if active_db:
            rec = EmailDeliveryRecord(
                recipient=recipient,
                subject=subject,
                template_type=template_type,
                application_reference=app_ref,
                status=delivery_record["status"],
                error_message=delivery_record.get("error")
            )
            active_db.add(rec)
            active_db.commit()
            if should_close:
                active_db.close()
    except Exception as persist_err:
        logger.warning(f"Failed to persist email delivery record to database: {persist_err}")

    return delivery_record
