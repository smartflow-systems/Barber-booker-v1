import OpenAI from "openai";
import { notify } from "../sfs-comms-client";

// Check if OpenAI API key is available
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export async function generateBookingMessage(customerName: string, date: string, time: string): Promise<string> {
  if (!openai) {
    // Return a professional confirmation message if OpenAI is not configured
    return `Dear ${customerName}, your appointment is confirmed for ${date} at ${time}. We look forward to providing you with exceptional barbershop services at BarberFlow Systems. Please arrive 5 minutes early and bring a valid ID. If you need to reschedule or cancel, please contact us at least 24 hours in advance. Thank you for choosing BarberFlow Systems!`;
  }

  try {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a professional barbershop assistant. Generate a warm, personalized booking confirmation message. Keep it friendly but professional, around 2-3 sentences. Include the appointment details and any helpful reminders."
        },
        {
          role: "user",
          content: `Generate a booking confirmation message for ${customerName} with an appointment on ${date} at ${time}.`
        }
      ],
      max_tokens: 150,
      temperature: 0.7
    });

    return response.choices[0].message.content || "Your appointment has been confirmed. We look forward to seeing you!";
  } catch (error) {
    console.error("Error generating AI message:", error);
    // Fallback to a standard professional message
    return `Dear ${customerName}, your appointment is confirmed for ${date} at ${time}. We look forward to providing you with exceptional service at BarberFlow Systems. Please arrive 5 minutes early. Thank you for choosing us!`;
  }
}

export async function sendEmailConfirmation(email: string, message: string): Promise<boolean> {
  // Option 0: sfs-comms-hub (preferred when configured)
  if (process.env.SFS_COMMS_URL) {
    try {
      await notify.email({
        to: email,
        subject: "Booking Confirmation - BarberFlow Systems",
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#374151">Booking Confirmation</h2><p style="color:#6b7280;line-height:1.6">${message}</p><hr style="border:1px solid #e5e7eb;margin:20px 0"><p style="color:#9ca3af;font-size:12px">SmartFlow Systems — Professional Barbershop Services</p></div>`,
      });
      console.log(`✓ Email sent via sfs-comms-hub to ${email}`);
      return true;
    } catch (err) {
      console.error("sfs-comms-hub email failed, falling back:", (err as Error).message);
    }
  }

  // Option 1: SendGrid (if available)
  if (process.env.SENDGRID_API_KEY) {
    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      
      const msg = {
        to: email,
        from: process.env.FROM_EMAIL || 'bookings@barberflowsystems.com',
        subject: 'Booking Confirmation - BarberFlow Systems',
        text: message,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #374151;">Booking Confirmation</h2>
            <p style="color: #6b7280; line-height: 1.6;">${message}</p>
            <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #9ca3af; font-size: 12px;">Smart Flow Systems - Professional Barbershop Services</p>
          </div>
        `
      };
      
      await sgMail.send(msg);
      console.log(`✓ Email sent successfully to ${email} via SendGrid`);
      return true;
    } catch (error) {
      console.error('SendGrid email failed:', error);
    }
  }
  
  // Option 2: Gmail SMTP (if available)
  if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
    try {
      const nodemailer = require('nodemailer');
      
      const transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASS // App password required
        }
      });
      
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: email,
        subject: 'Booking Confirmation - Smart Flow Systems',
        text: message,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #374151;">Booking Confirmation</h2>
            <p style="color: #6b7280; line-height: 1.6;">${message}</p>
            <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #9ca3af; font-size: 12px;">Smart Flow Systems - Professional Barbershop Services</p>
          </div>
        `
      };
      
      await transporter.sendMail(mailOptions);
      console.log(`✓ Email sent successfully to ${email} via Gmail SMTP`);
      return true;
    } catch (error) {
      console.error('Gmail SMTP email failed:', error);
    }
  }
  
  // Option 3: Outlook/Hotmail SMTP (if available)
  if (process.env.OUTLOOK_USER && process.env.OUTLOOK_PASS) {
    try {
      const nodemailer = require('nodemailer');
      
      const transporter = nodemailer.createTransporter({
        service: 'hotmail',
        auth: {
          user: process.env.OUTLOOK_USER,
          pass: process.env.OUTLOOK_PASS
        }
      });
      
      const mailOptions = {
        from: process.env.OUTLOOK_USER,
        to: email,
        subject: 'Booking Confirmation - Smart Flow Systems',
        text: message,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #374151;">Booking Confirmation</h2>
            <p style="color: #6b7280; line-height: 1.6;">${message}</p>
            <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #9ca3af; font-size: 12px;">Smart Flow Systems - Professional Barbershop Services</p>
          </div>
        `
      };
      
      await transporter.sendMail(mailOptions);
      console.log(`✓ Email sent successfully to ${email} via Outlook SMTP`);
      return true;
    } catch (error) {
      console.error('Outlook SMTP email failed:', error);
    }
  }
  
  // Fallback: Log the email (no service configured)
  console.log(`📧 Email confirmation for ${email}:`);
  console.log(message);
  console.log('ℹ️  To enable email sending, configure one of these options:');
  console.log('   • SendGrid: Set SENDGRID_API_KEY');
  console.log('   • Gmail: Set GMAIL_USER and GMAIL_PASS (app password)');
  console.log('   • Outlook: Set OUTLOOK_USER and OUTLOOK_PASS');
  
  return true;
}