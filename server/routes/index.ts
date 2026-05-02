import { generateBookingMessage, sendEmailConfirmation } from "../ai/bookingMessage";
import express, { type Express } from "express";
import lusca from "lusca";
import session from "express-session";
import bcrypt from "bcrypt";
import { createServer } from "http";
import { storage } from "../storage";
import { googleAuthService } from "../auth/google";
import {
  insertBookingSchema,
  insertClientSchema,
  insertServiceSchema,
  insertBarberSchema,
  insertAdminUserSchema,
  insertReviewSchema,
  insertDiscountCodeSchema,
  insertReminderTemplateSchema,
  insertStaffBreakSchema,
  type Booking
} from "../../shared/schema";
import connectPgSimple from "connect-pg-simple";
import Stripe from "stripe";
import { smsService } from "../services/sms";
import { reminderScheduler } from "../services/reminderScheduler";
import { helmetConfig, corsConfig, apiLimiter, authLimiter, sanitizeInput } from "../middleware/security";
import jwt from "jsonwebtoken";
import { requireAuth as sfsRequireAuth } from "../middleware/sfs-auth";

// Initialize Stripe only if API key is provided
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-05-28.basil",
  });
  console.log('[Stripe] Initialized successfully');
} else {
  console.warn('[Stripe] API key not provided - payment features will be disabled');
}

export async function registerRoutes(app: Express) {
  const server = createServer(app);

  // Helper function to create Google Calendar events
  async function createCalendarEvent(booking: Booking) {
    try {
      // Get all Google tokens to find an active one
      const allTokens = await storage.getGoogleTokens();
      if (!allTokens || allTokens.length === 0) {
        console.log('No Google tokens found, skipping calendar event creation');
        return;
      }

      // Use the first available token (in a real app, you'd associate tokens with specific users/barbers)
      const googleToken = allTokens[0];
      console.log(`Using Google token for user: ${googleToken.userId}`);

      // Set credentials for the Google API client
      googleAuthService.setCredentials(
        googleToken.accessToken,
        googleToken.refreshToken,
        googleToken.expiryDate.getTime()
      );

      // Get barber and service details
      const barber = await storage.getBarber(booking.barberId);
      const service = await storage.getService(booking.serviceId);

      if (!barber || !service) {
        console.error('Missing barber or service data for calendar event');
        return;
      }

      // Create calendar event
      const calendar = googleAuthService.getCalendarClient();

      // Parse the booking time and create start/end times
      const [hours, minutes] = booking.time.split(':').map(Number);
      const startDate = new Date(booking.date);
      startDate.setHours(hours, minutes, 0, 0);

      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + service.duration);

      const event = {
        summary: `${service.name} - ${booking.customerName}`,
        description: `Barbershop appointment\nBarber: ${barber.name}\nService: ${service.name}\nClient: ${booking.customerName}\nPhone: ${booking.customerPhone || 'N/A'}`,
        start: {
          dateTime: startDate.toISOString(),
          timeZone: 'America/New_York', // Adjust timezone as needed
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: 'America/New_York',
        },
        // Remove attendees to avoid email validation issues
        // attendees: [],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 24 hours before
            { method: 'popup', minutes: 30 }, // 30 minutes before
          ],
        },
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });

      console.log('Calendar event created:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw error;
    }
  }

  // Security middleware
  app.use(helmetConfig);
  app.use(corsConfig);

  // Input sanitization
  app.use(sanitizeInput);

  // Session configuration
  const pgSession = connectPgSimple(session);
  app.use(session({
    store: new pgSession({
      conString: process.env.DATABASE_URL,
      tableName: 'sessions',
      createTableIfMissing: false,
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // Enable secure cookies in production
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict', // CSRF protection via SameSite cookie attribute
    },
  }));

  // CSRF protection middleware
  app.use(lusca.csrf());

  // Utility route for frontend to fetch CSRF token (optional)
  app.get("/api/csrf-token", (req, res) => {
    // lusca places the token at req.csrfToken
    res.json({ csrfToken: req.csrfToken && req.csrfToken() });
  });

  // SFS JWT auth middleware — token issued by SFS-Backend, verified by shared SFS_JWT_SECRET
  const requireAuth = sfsRequireAuth;

  // Admin Authentication Routes
  // Local login — issues a JWT signed with SFS_JWT_SECRET for standalone / demo use.
  // On multi-tenant deployments, direct users to SFS-Backend for login instead.
  app.post("/api/admin/login", authLimiter, async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }
      const adminUser = await storage.getAdminUserByUsername(username);
      if (!adminUser || !adminUser.isActive) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const bcrypt = await import("bcrypt");
      const valid = await bcrypt.compare(password, adminUser.password);
      if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const secret = process.env.SFS_JWT_SECRET;
      if (!secret) return res.status(500).json({ error: "Server misconfiguration: SFS_JWT_SECRET not set" });

      const token = jwt.sign(
        {
          userId: String(adminUser.id),
          orgId:  adminUser.orgId  || "",
          email:  adminUser.username,
          role:   adminUser.role === "admin" ? "admin" : "member",
          plan:   "pro",
        },
        secret,
        { expiresIn: "24h" }
      );
      res.json({ success: true, token, user: { id: adminUser.id, username: adminUser.username, role: adminUser.role } });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/admin/logout", apiLimiter, (_req, res) => {
    // JWT is stateless — logout is handled client-side by discarding the token.
    res.json({ success: true });
  });

  app.get("/api/admin/user", apiLimiter, requireAuth, async (req, res) => {
    const { userId, orgId, email, role } = req.user!;
    res.json({ userId, orgId, email, role });
  });

  app.get("/api/admin/google-token", apiLimiter, requireAuth, async (req, res) => {
    try {
      const token = await storage.getGoogleToken(req.user!.userId);
      res.json(token);
    } catch (error) {
      console.error("Error fetching Google token:", error);
      res.status(500).json({ error: "Failed to fetch Google token" });
    }
  });

  app.delete("/api/admin/google-disconnect", apiLimiter, requireAuth, async (req, res) => {
    try {
      await storage.deleteGoogleToken(req.user!.userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error disconnecting Google:", error);
      res.status(500).json({ error: "Failed to disconnect Google" });
    }
  });

  // Barbers
  app.get("/api/barbers", apiLimiter, async (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || process.env.SFS_ORG_ID;
      const barbers = await storage.getBarbers(orgId);
      res.json(barbers);
    } catch (error) {
      console.error("Error fetching barbers:", error);
      res.status(500).json({ error: "Failed to fetch barbers" });
    }
  });

  app.post("/api/bookings", apiLimiter, async (req, res) => {
  try {
    // ✅ Step 1: Validate and store booking
    const orgId = (req.query.orgId as string) || (req.body.orgId as string) || process.env.SFS_ORG_ID;
    const bookingData = insertBookingSchema.parse({ ...req.body, orgId });
    const booking = await storage.createBooking(bookingData);

    // ✅ Step 2: Add Google Calendar event
    await createCalendarEvent(booking);

    // ✅ Step 3: Generate AI message
    const message = await generateBookingMessage(
      booking.customerName,
      booking.date,
      booking.time
    );

    // ✅ Step 4: Send email if email is provided
    if (booking.customerEmail) {
      await sendEmailConfirmation(booking.customerEmail, message);
    }

    // ✅ Step 5: Return booking info + AI message
    res.json({ ...booking, aiMessage: message });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(400).json({ error: "Failed to create booking" });
  }
});

  // Stripe payment route for payment intents
  app.post("/api/create-payment-intent", apiLimiter, async (req, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ 
          error: "Payment processing unavailable", 
          message: "Stripe API key not configured" 
        });
      }

      const { amount, currency = "usd", description, bookingId, clientId, paymentType } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Valid amount is required" });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount), // Amount in cents
        currency,
        description: description || "Barbershop service payment",
        metadata: {
          bookingId: bookingId?.toString() || "",
          clientId: clientId?.toString() || "",
          paymentType: paymentType || "service"
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.json({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id 
      });
    } catch (error: any) {
      console.error("Stripe payment intent error:", error);
      res.status(500).json({ 
        error: "Error creating payment intent", 
        message: error.message 
      });
    }
  });

  // Test email endpoint
  app.post("/api/test-email", apiLimiter, async (req, res) => {
    try {
      const { email, message } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      
      const testMessage = message || "This is a test email from Smart Flow Systems booking system.";
      const success = await sendEmailConfirmation(email, testMessage);
      
      if (success) {
        res.json({ message: "Email sent successfully" });
      } else {
        res.status(500).json({ error: "Failed to send email" });
      }
    } catch (error) {
      console.error("Email test error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Services
  app.get("/api/services", apiLimiter, async (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || process.env.SFS_ORG_ID;
      const services = await storage.getServices(orgId);
      res.json(services);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ error: "Failed to fetch services" });
    }
  });

  app.post("/api/services", apiLimiter, requireAuth, async (req, res) => {
    try {
      const service = insertServiceSchema.parse({ ...req.body, orgId: req.user!.orgId });
      const newService = await storage.createService(service);
      res.status(201).json(newService);
    } catch (error) {
      console.error("Error creating service:", error);
      res.status(500).json({ error: "Failed to create service" });
    }
  });

  // Bookings
  app.get("/api/bookings", apiLimiter, requireAuth, async (req, res) => {
    try {
      const bookings = await storage.getBookings(req.user!.orgId);
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  app.get("/api/bookings/date/:date", apiLimiter, async (req, res) => {
    try {
      const { date } = req.params;
      const orgId = (req.query.orgId as string) || process.env.SFS_ORG_ID;
      const bookings = await storage.getBookingsByDate(date, orgId);
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching bookings by date:", error);
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  app.get("/api/bookings/barber/:barberId/date/:date", apiLimiter, async (req, res) => {
    try {
      const { barberId, date } = req.params;
      const orgId = (req.query.orgId as string) || process.env.SFS_ORG_ID;
      const bookings = await storage.getBookingsByBarberAndDate(parseInt(barberId), date, orgId);
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching barber bookings:", error);
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  app.patch("/api/bookings/:id", apiLimiter, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;

      const booking = await storage.updateBooking(id, updates);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      res.json(booking);
    } catch (error) {
      console.error("Error updating booking:", error);
      res.status(500).json({ error: "Failed to update booking" });
    }
  });

  app.delete("/api/bookings/:id", apiLimiter, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteBooking(id);

      if (!success) {
        return res.status(404).json({ error: "Booking not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting booking:", error);
      res.status(500).json({ error: "Failed to delete booking" });
    }
  });

  // Availability - Get available time slots for a barber on a specific date
  app.get("/api/availability", apiLimiter, async (req, res) => {
    try {
      const { barberId, date, serviceId } = req.query;

      if (!barberId || !date) {
        return res.status(400).json({ error: "barberId and date are required" });
      }

      const barberIdNum = parseInt(barberId as string);
      const dateStr = date as string;

      // Get service duration if provided
      let serviceDuration = 30; // default 30 minutes
      if (serviceId) {
        const service = await storage.getService(parseInt(serviceId as string));
        if (service) {
          serviceDuration = service.duration;
        }
      }

      // Business hours (can be made configurable)
      const businessStart = "09:00";
      const businessEnd = "18:00";

      // Generate all possible time slots based on service duration
      const allSlots = generateTimeSlots(businessStart, businessEnd, 30); // 30-min intervals

      // Get existing bookings for the date and barber
      const orgId = (req.query.orgId as string) || process.env.SFS_ORG_ID;
      const bookings = await storage.getBookingsByBarberAndDate(barberIdNum, dateStr, orgId);

      // Get staff breaks for the date and barber
      const breaks = await storage.getStaffBreaksByBarber(barberIdNum, dateStr);

      // Calculate blocked time slots
      const blockedSlots = new Set<string>();

      // Block slots for existing bookings (including service duration)
      for (const booking of bookings) {
        const service = await storage.getService(booking.serviceId);
        const duration = service?.duration || 30;

        // Block all slots covered by this booking
        const bookingSlots = getSlotsForDuration(booking.time, duration, 30);
        bookingSlots.forEach(slot => blockedSlots.add(slot));
      }

      // Block slots for staff breaks
      for (const breakTime of breaks) {
        const breakStart = breakTime.startTime;
        const breakEnd = breakTime.endTime;
        const breakSlots = getSlotsBetween(breakStart, breakEnd, 30);
        breakSlots.forEach(slot => blockedSlots.add(slot));
      }

      // Filter available slots
      const availableSlots = allSlots.filter(slot => {
        // Check if slot is blocked
        if (blockedSlots.has(slot)) return false;

        // Check if there's enough time for the service before closing/break
        const requiredSlots = getSlotsForDuration(slot, serviceDuration, 30);

        // All required slots must not be blocked
        return requiredSlots.every(reqSlot => !blockedSlots.has(reqSlot));
      });

      res.json(availableSlots);
    } catch (error) {
      console.error("Error fetching availability:", error);
      res.status(500).json({ error: "Failed to fetch availability" });
    }
  });

  // Helper function to generate time slots
  function generateTimeSlots(start: string, end: string, intervalMinutes: number): string[] {
    const slots: string[] = [];
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);

    let currentMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    while (currentMinutes < endMinutes) {
      const hours = Math.floor(currentMinutes / 60);
      const minutes = currentMinutes % 60;
      slots.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
      currentMinutes += intervalMinutes;
    }

    return slots;
  }

  // Helper function to get all slots needed for a duration starting at a specific time
  function getSlotsForDuration(startTime: string, durationMinutes: number, slotInterval: number): string[] {
    const slots: string[] = [];
    const [startHour, startMin] = startTime.split(':').map(Number);

    let currentMinutes = startHour * 60 + startMin;
    const endMinutes = currentMinutes + durationMinutes;

    while (currentMinutes < endMinutes) {
      const hours = Math.floor(currentMinutes / 60);
      const minutes = currentMinutes % 60;
      slots.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
      currentMinutes += slotInterval;
    }

    return slots;
  }

  // Helper function to get all slots between two times
  function getSlotsBetween(startTime: string, endTime: string, slotInterval: number): string[] {
    const slots: string[] = [];
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    let currentMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    while (currentMinutes < endMinutes) {
      const hours = Math.floor(currentMinutes / 60);
      const minutes = currentMinutes % 60;
      slots.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
      currentMinutes += slotInterval;
    }

    return slots;
  }

  // Clients
  app.get("/api/clients", apiLimiter, requireAuth, async (req, res) => {
    try {
      const clients = await storage.getClients(req.user!.orgId);
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.post("/api/clients", apiLimiter, async (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || process.env.SFS_ORG_ID;
      const client = insertClientSchema.parse({ ...req.body, orgId });
      const newClient = await storage.createClient(client);
      res.status(201).json(newClient);
    } catch (error) {
      console.error("Error creating client:", error);
      res.status(500).json({ error: "Failed to create client" });
    }
  });

  app.patch("/api/clients/:id", apiLimiter, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;

      const client = await storage.updateClient(id, updates);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      console.error("Error updating client:", error);
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  // Health check for external connectivity
  app.get("/health", (req, res) => {
    res.json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      domain: req.hostname,
      port: process.env.PORT || (process.env.NODE_ENV === "production" ? 3000 : 5000)
    });
  });

  // Simple connectivity test
  app.get("/test", (req, res) => {
    res.send(`<h1>Server is running!</h1><p>Domain: ${req.hostname}</p><p>Time: ${new Date().toISOString()}</p>`);
  });

  // Google OAuth2 routes
  app.get("/auth/google", async (req, res) => {
    try {
      const userId = req.query.userId as string || "admin"; // Default user for testing
      console.log(`[OAuth] Initiating Google OAuth for user: ${userId}`);

      const authUrl = googleAuthService.getAuthUrl(userId);
      console.log(`[OAuth] Generated auth URL: ${authUrl}`);

      res.redirect(authUrl);
    } catch (error) {
      console.error("[OAuth] Error initiating Google auth:", error);
      res.status(500).json({ 
        error: "Failed to initiate Google authentication",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/auth/google/callback", async (req, res) => {
    try {
      const code = req.query.code as string;
      const state = req.query.state as string; // This contains the userId
      const error = req.query.error as string;

      console.log(`[OAuth] Callback received - Code: ${code ? 'present' : 'missing'}, State: ${state}, Error: ${error}`);

      if (error) {
        console.error(`[OAuth] Authorization error: ${error}`);
        return res.redirect('/connected?error=' + encodeURIComponent(error));
      }

      if (!code) {
        console.error("[OAuth] No authorization code received");
        return res.redirect('/connected?error=' + encodeURIComponent('No authorization code received'));
      }

      if (!state) {
        console.error("[OAuth] No state parameter received");
        return res.redirect('/connected?error=' + encodeURIComponent('Invalid state parameter'));
      }

      // Exchange code for tokens
      const tokens = await googleAuthService.exchangeCodeForTokens(code);
      console.log("[OAuth] Token exchange successful");

      // Store tokens in database
      const savedToken = await storage.createGoogleToken({
        userId: state,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: new Date(tokens.expiry_date)
      });

      if (!savedToken) {
        throw new Error("Failed to save token to database");
      }

      console.log(`[OAuth] Token successfully stored with ID: ${savedToken.id}`);

      // Test calendar access
      googleAuthService.setCredentials(
        tokens.access_token, 
        tokens.refresh_token, 
        tokens.expiry_date
      );

      const calendarAccessTest = await googleAuthService.testCalendarAccess();
      console.log(`[OAuth] Calendar access test: ${calendarAccessTest ? 'SUCCESS' : 'FAILED'}`);

      // Redirect to success page instead of returning JSON
      res.redirect('/connected?success=true');

    } catch (error) {
      console.error("[OAuth] Callback error:", error);
      res.redirect('/connected?error=' + encodeURIComponent(
        error instanceof Error ? error.message : "Unknown error occurred"
      ));
    }
  });

  // Test endpoint for stored tokens
  app.get("/auth/google/test/:userId", async (req, res) => {
    try {
      const { userId } = req.params;

      const token = await storage.getGoogleToken(userId);
      if (!token) {
        return res.status(404).json({ error: "No token found for user" });
      }

      // Test if token is still valid
      googleAuthService.setCredentials(
        token.accessToken,
        token.refreshToken,
        token.expiryDate.getTime()
      );

      const calendarAccess = await googleAuthService.testCalendarAccess();

      res.json({
        success: true,
        tokenId: token.id,
        calendarAccess,
        expiryDate: token.expiryDate.toISOString()
      });

    } catch (error) {
      console.error("[OAuth] Test error:", error);
      res.status(500).json({
        error: "Failed to test token",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // =====================================================
  // CUSTOMER AUTHENTICATION ENDPOINTS
  // =====================================================

  // Customer registration
  app.post("/api/customer/register", async (req, res) => {
    try {
      const { name, email, phone, password } = req.body;

      // Check if customer already exists
      const existingByEmail = email ? await storage.getClientByEmail(email) : null;
      const existingByPhone = await storage.getClientByPhone(phone);

      if (existingByEmail || existingByPhone) {
        return res.status(400).json({ error: "Customer already exists with this email or phone" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create customer — orgId scopes this customer to the right shop
      const orgId = (req.query.orgId as string) || (req.body.orgId as string) || process.env.SFS_ORG_ID;
      const customer = await storage.createClient({
        name,
        email,
        phone,
        password: hashedPassword,
        emailVerified: false,
        orgId,
      });

      // Set session
      if (req.session) {
        (req.session as any).customerId = customer.id;
        (req.session as any).customerName = customer.name;
      }

      res.json({
        success: true,
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone
        }
      });
    } catch (error) {
      console.error("Customer registration error:", error);
      res.status(500).json({ error: "Failed to register customer" });
    }
  });

  // Customer login
  app.post("/api/customer/login", async (req, res) => {
    try {
      const { identifier, password } = req.body; // identifier can be email or phone

      // Find customer by email or phone
      let customer = await storage.getClientByEmail(identifier);
      if (!customer) {
        customer = await storage.getClientByPhone(identifier);
      }

      if (!customer || !customer.password) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, customer.password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Set session
      if (req.session) {
        (req.session as any).customerId = customer.id;
        (req.session as any).customerName = customer.name;
      }

      res.json({
        success: true,
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          loyaltyPoints: customer.loyaltyPoints,
          totalVisits: customer.totalVisits
        }
      });
    } catch (error) {
      console.error("Customer login error:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  // Customer logout
  app.post("/api/customer/logout", async (req, res) => {
    if (req.session) {
      delete (req.session as any).customerId;
      delete (req.session as any).customerName;
    }
    res.json({ success: true });
  });

  // Get current customer
  app.get("/api/customer/me", async (req, res) => {
    try {
      const customerId = (req.session as any)?.customerId;
      if (!customerId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const customer = await storage.getClient(customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      // Get customer's bookings
      const bookings = await storage.getBookingsByClient(customerId);

      res.json({
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          loyaltyPoints: customer.loyaltyPoints,
          totalVisits: customer.totalVisits,
          totalSpent: customer.totalSpent,
          birthday: customer.birthday,
          anniversary: customer.anniversary,
          preferences: customer.preferences,
          profilePhoto: customer.profilePhoto
        },
        bookings
      });
    } catch (error) {
      console.error("Get customer error:", error);
      res.status(500).json({ error: "Failed to get customer data" });
    }
  });

  // Update customer profile
  app.patch("/api/customer/profile", async (req, res) => {
    try {
      const customerId = (req.session as any)?.customerId;
      if (!customerId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const updates = req.body;
      // Don't allow updating password through this endpoint
      delete updates.password;

      const customer = await storage.updateClient(customerId, updates);
      res.json({ success: true, customer });
    } catch (error) {
      console.error("Update customer error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // =====================================================
  // REVIEW ENDPOINTS
  // =====================================================

  // Get all reviews (optionally filtered by barber)
  app.get("/api/reviews", async (req, res) => {
    try {
      const { barberId } = req.query;

      let reviews;
      if (barberId) {
        reviews = await storage.getReviewsByBarber(parseInt(barberId as string));
      } else {
        reviews = await storage.getReviews();
      }

      // Filter to only published reviews for public access
      const publishedReviews = reviews.filter(r => r.isPublished);

      res.json(publishedReviews);
    } catch (error) {
      console.error("Get reviews error:", error);
      res.status(500).json({ error: "Failed to get reviews" });
    }
  });

  // Get reviews by customer (requires auth)
  app.get("/api/customer/reviews", async (req, res) => {
    try {
      const customerId = (req.session as any)?.customerId;
      if (!customerId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const reviews = await storage.getReviewsByClient(customerId);
      res.json(reviews);
    } catch (error) {
      console.error("Get customer reviews error:", error);
      res.status(500).json({ error: "Failed to get reviews" });
    }
  });

  // Create a review
  app.post("/api/reviews", async (req, res) => {
    try {
      const customerId = (req.session as any)?.customerId;
      if (!customerId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const reviewData = insertReviewSchema.parse({
        ...req.body,
        clientId: customerId
      });

      const review = await storage.createReview(reviewData);

      // Update barber's average rating (this is a simple implementation)
      // In production, you'd want to calculate this more efficiently
      const barberReviews = await storage.getReviewsByBarber(review.barberId);
      const avgRating = barberReviews.reduce((sum, r) => sum + r.rating, 0) / barberReviews.length;

      res.json({ success: true, review, avgRating });
    } catch (error) {
      console.error("Create review error:", error);
      res.status(500).json({ error: "Failed to create review" });
    }
  });

  // Update a review (customer can only update their own)
  app.patch("/api/reviews/:id", async (req, res) => {
    try {
      const customerId = (req.session as any)?.customerId;
      const reviewId = parseInt(req.params.id);

      // Check if review exists and belongs to customer
      const existingReview = await storage.getReview(reviewId);
      if (!existingReview) {
        return res.status(404).json({ error: "Review not found" });
      }

      if (existingReview.clientId !== customerId) {
        return res.status(403).json({ error: "Not authorized to update this review" });
      }

      const updates = req.body;
      const review = await storage.updateReview(reviewId, updates);

      res.json({ success: true, review });
    } catch (error) {
      console.error("Update review error:", error);
      res.status(500).json({ error: "Failed to update review" });
    }
  });

  // Delete a review (admin only or customer's own)
  app.delete("/api/reviews/:id", async (req, res) => {
    try {
      const customerId = (req.session as any)?.customerId;
      const adminId = (req.session as any)?.userId;
      const reviewId = parseInt(req.params.id);

      const existingReview = await storage.getReview(reviewId);
      if (!existingReview) {
        return res.status(404).json({ error: "Review not found" });
      }

      // Allow if admin or review owner
      if (!adminId && existingReview.clientId !== customerId) {
        return res.status(403).json({ error: "Not authorized to delete this review" });
      }

      await storage.deleteReview(reviewId);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete review error:", error);
      res.status(500).json({ error: "Failed to delete review" });
    }
  });

  // =====================================================
  // DISCOUNT CODE ENDPOINTS
  // =====================================================

  // Validate a discount code
  app.post("/api/discounts/validate", async (req, res) => {
    try {
      const { code, serviceId, clientId } = req.body;

      const discount = await storage.getDiscountCodeByCode(code.toUpperCase());
      if (!discount) {
        return res.status(404).json({ error: "Invalid discount code" });
      }

      // Check if active
      if (!discount.isActive) {
        return res.status(400).json({ error: "This discount code is not active" });
      }

      // Check validity dates
      const now = new Date();
      if (discount.validFrom && new Date(discount.validFrom) > now) {
        return res.status(400).json({ error: "This discount code is not yet valid" });
      }
      if (discount.validUntil && new Date(discount.validUntil) < now) {
        return res.status(400).json({ error: "This discount code has expired" });
      }

      // Check usage limit
      if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
        return res.status(400).json({ error: "This discount code has reached its usage limit" });
      }

      // Check per-client usage limit
      if (clientId && discount.perClientLimit) {
        const clientUsage = await storage.getDiscountUsageByClient(clientId, discount.id);
        if (clientUsage.length >= discount.perClientLimit) {
          return res.status(400).json({ error: "You have already used this discount code" });
        }
      }

      // Check if first-time only
      if (discount.firstTimeOnly && clientId) {
        const client = await storage.getClient(clientId);
        if (client && client.totalVisits > 0) {
          return res.status(400).json({ error: "This discount is only for first-time customers" });
        }
      }

      // Check if applicable to service
      if (discount.applicableServices && discount.applicableServices.length > 0) {
        if (!serviceId || !discount.applicableServices.includes(serviceId.toString())) {
          return res.status(400).json({ error: "This discount does not apply to the selected service" });
        }
      }

      res.json({
        valid: true,
        discount: {
          id: discount.id,
          code: discount.code,
          type: discount.type,
          value: discount.value,
          description: discount.description,
          minPurchase: discount.minPurchase,
          maxDiscount: discount.maxDiscount
        }
      });
    } catch (error) {
      console.error("Validate discount error:", error);
      res.status(500).json({ error: "Failed to validate discount code" });
    }
  });

  // Get all discount codes (admin only)
  app.get("/api/discounts", requireAuth, async (req, res) => {
    try {
      const discounts = await storage.getDiscountCodes();
      res.json(discounts);
    } catch (error) {
      console.error("Get discounts error:", error);
      res.status(500).json({ error: "Failed to get discount codes" });
    }
  });

  // Create discount code (admin only)
  app.post("/api/discounts", requireAuth, async (req, res) => {
    try {
      const adminId = (req.session as any)?.userId;
      const discountData = insertDiscountCodeSchema.parse({
        ...req.body,
        code: req.body.code.toUpperCase(),
        createdBy: adminId
      });

      const discount = await storage.createDiscountCode(discountData);
      res.json({ success: true, discount });
    } catch (error) {
      console.error("Create discount error:", error);
      res.status(500).json({ error: "Failed to create discount code" });
    }
  });

  // Update discount code (admin only)
  app.patch("/api/discounts/:id", requireAuth, async (req, res) => {
    try {
      const discountId = parseInt(req.params.id);
      const updates = req.body;

      if (updates.code) {
        updates.code = updates.code.toUpperCase();
      }

      const discount = await storage.updateDiscountCode(discountId, updates);
      res.json({ success: true, discount });
    } catch (error) {
      console.error("Update discount error:", error);
      res.status(500).json({ error: "Failed to update discount code" });
    }
  });

  // Delete discount code (admin only)
  app.delete("/api/discounts/:id", requireAuth, async (req, res) => {
    try {
      const discountId = parseInt(req.params.id);
      await storage.deleteDiscountCode(discountId);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete discount error:", error);
      res.status(500).json({ error: "Failed to delete discount code" });
    }
  });

  // =====================================================
  // REMINDER TEMPLATE ENDPOINTS
  // =====================================================

  // Get all reminder templates (admin only)
  app.get("/api/reminder-templates", requireAuth, async (req, res) => {
    try {
      const templates = await storage.getReminderTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Get reminder templates error:", error);
      res.status(500).json({ error: "Failed to get reminder templates" });
    }
  });

  // Create reminder template (admin only)
  app.post("/api/reminder-templates", requireAuth, async (req, res) => {
    try {
      const templateData = insertReminderTemplateSchema.parse(req.body);
      const template = await storage.createReminderTemplate(templateData);
      res.json({ success: true, template });
    } catch (error) {
      console.error("Create reminder template error:", error);
      res.status(500).json({ error: "Failed to create reminder template" });
    }
  });

  // Update reminder template (admin only)
  app.patch("/api/reminder-templates/:id", requireAuth, async (req, res) => {
    try {
      const templateId = parseInt(req.params.id);
      const updates = req.body;
      const template = await storage.updateReminderTemplate(templateId, updates);
      res.json({ success: true, template });
    } catch (error) {
      console.error("Update reminder template error:", error);
      res.status(500).json({ error: "Failed to update reminder template" });
    }
  });

  // Delete reminder template (admin only)
  app.delete("/api/reminder-templates/:id", requireAuth, async (req, res) => {
    try {
      const templateId = parseInt(req.params.id);
      await storage.deleteReminderTemplate(templateId);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete reminder template error:", error);
      res.status(500).json({ error: "Failed to delete reminder template" });
    }
  });

  // Get reminder logs (admin only)
  app.get("/api/reminder-logs", requireAuth, async (req, res) => {
    try {
      const logs = await storage.getReminderLogs();
      res.json(logs);
    } catch (error) {
      console.error("Get reminder logs error:", error);
      res.status(500).json({ error: "Failed to get reminder logs" });
    }
  });

  // Trigger reminder check manually (admin only)
  app.post("/api/reminders/trigger", requireAuth, async (req, res) => {
    try {
      await reminderScheduler.triggerCheck();
      res.json({ success: true, message: "Reminder check triggered" });
    } catch (error) {
      console.error("Trigger reminders error:", error);
      res.status(500).json({ error: "Failed to trigger reminder check" });
    }
  });

  // Get reminder scheduler status (admin only)
  app.get("/api/reminders/status", requireAuth, async (req, res) => {
    try {
      const status = reminderScheduler.getStatus();
      const smsReady = smsService.isReady();
      res.json({ ...status, smsReady });
    } catch (error) {
      console.error("Get reminder status error:", error);
      res.status(500).json({ error: "Failed to get reminder status" });
    }
  });

  // =====================================================
  // STAFF BREAK ENDPOINTS
  // =====================================================

  // Get staff breaks
  app.get("/api/staff-breaks", async (req, res) => {
    try {
      const { barberId, date } = req.query;

      let breaks;
      if (barberId) {
        breaks = await storage.getStaffBreaksByBarber(
          parseInt(barberId as string),
          date as string | undefined
        );
      } else {
        breaks = await storage.getStaffBreaks();
      }

      res.json(breaks);
    } catch (error) {
      console.error("Get staff breaks error:", error);
      res.status(500).json({ error: "Failed to get staff breaks" });
    }
  });

  // Create staff break (admin only)
  app.post("/api/staff-breaks", requireAuth, async (req, res) => {
    try {
      const breakData = insertStaffBreakSchema.parse(req.body);
      const staffBreak = await storage.createStaffBreak(breakData);
      res.json({ success: true, staffBreak });
    } catch (error) {
      console.error("Create staff break error:", error);
      res.status(500).json({ error: "Failed to create staff break" });
    }
  });

  // Update staff break (admin only)
  app.patch("/api/staff-breaks/:id", requireAuth, async (req, res) => {
    try {
      const breakId = parseInt(req.params.id);
      const updates = req.body;
      const staffBreak = await storage.updateStaffBreak(breakId, updates);
      res.json({ success: true, staffBreak });
    } catch (error) {
      console.error("Update staff break error:", error);
      res.status(500).json({ error: "Failed to update staff break" });
    }
  });

  // Delete staff break (admin only)
  app.delete("/api/staff-breaks/:id", requireAuth, async (req, res) => {
    try {
      const breakId = parseInt(req.params.id);
      await storage.deleteStaffBreak(breakId);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete staff break error:", error);
      res.status(500).json({ error: "Failed to delete staff break" });
    }
  });

  // Start the reminder scheduler
  reminderScheduler.start();

  return server;
}