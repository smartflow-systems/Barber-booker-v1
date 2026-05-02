import 'express-session';

declare module 'express-session' {
  interface SessionData {
    adminUserId?: number;
    customerId?: number;
    customerName?: string;
    userId?: number;
  }
}