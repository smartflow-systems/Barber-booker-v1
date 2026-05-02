# Barber-booker-tempate-v1 — Claude Context

Role: Complete booking management system for barbershops, salons, and service businesses.
Repo: https://github.com/smartflow-systems/Barber-booker-tempate-v1
Local: /home/garet/SFS/Barber-booker-tempate-v1

## Purpose
Full-stack booking platform — online booking, staff management,
payments, calendar sync, and customer portal.

## Key Features
- Online 24/7 booking
- Google Calendar two-way sync
- Stripe payment processing
- Email notifications (SendGrid)
- Staff management and scheduling
- Customer portal and admin dashboard
- Drag-and-drop calendar interface
- Mobile responsive
- Waitlist management

## Stack
Full-stack (check package.json for exact versions)
Stripe, SendGrid, Google Calendar API

## Key Files
- [src/booking/] — booking engine
- [src/calendar/] — Google Calendar sync
- [src/payments/] — Stripe integration
- [src/notifications/] — SendGrid email
- [src/admin/] — admin dashboard
- [.github/workflows/ci.yml] — CI pipeline

## Health Check
GET /health → {"ok":true}

## Common Commands
npm run dev    → Start dev server
npm run build  → Build for production

## Secrets
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
SENDGRID_API_KEY, GOOGLE_CALENDAR_CLIENT_ID,
GOOGLE_CALENDAR_CLIENT_SECRET, SFS_PAT

## Agent Reference
See: /mnt/c/Users/garet/OneDrive/Documents/SFS-ChatGPT-Upload/agents/barber-booker-agent.md

## Notes
This is a template — when deploying for a specific client,
fork and customise branding, services list, and staff.
