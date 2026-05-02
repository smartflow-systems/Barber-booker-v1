import {
  barbers,
  services,
  clients,
  bookings,
  googleTokens,
  adminUsers,
  reviews,
  discountCodes,
  discountUsage,
  reminderTemplates,
  reminderLogs,
  staffBreaks,
  giftCards,
  giftCardTransactions,
  referrals,
  membershipTiers,
  clientMemberships,
  virtualQueue,
  styleConsultations,
  products,
  productOrders,
  productOrderItems,
  locations,
  barberLocations,
  galleryPhotos,
  galleryLikes,
  achievements,
  clientAchievements,
  waitList,
  type Barber,
  type Service,
  type Client,
  type Booking,
  type GoogleToken,
  type AdminUser,
  type Review,
  type DiscountCode,
  type DiscountUsage,
  type ReminderTemplate,
  type ReminderLog,
  type StaffBreak,
  type GiftCard,
  type GiftCardTransaction,
  type Referral,
  type MembershipTier,
  type ClientMembership,
  type VirtualQueue,
  type StyleConsultation,
  type Product,
  type ProductOrder,
  type ProductOrderItem,
  type Location,
  type BarberLocation,
  type GalleryPhoto,
  type GalleryLike,
  type Achievement,
  type ClientAchievement,
  type WaitList,
  type InsertBarber,
  type InsertService,
  type InsertClient,
  type InsertBooking,
  type InsertGoogleToken,
  type InsertAdminUser,
  type InsertReview,
  type InsertDiscountCode,
  type InsertDiscountUsage,
  type InsertReminderTemplate,
  type InsertReminderLog,
  type InsertStaffBreak,
  type InsertGiftCard,
  type InsertGiftCardTransaction,
  type InsertReferral,
  type InsertMembershipTier,
  type InsertClientMembership,
  type InsertVirtualQueue,
  type InsertStyleConsultation,
  type InsertProduct,
  type InsertProductOrder,
  type InsertProductOrderItem,
  type InsertLocation,
  type InsertBarberLocation,
  type InsertGalleryPhoto,
  type InsertGalleryLike,
  type InsertAchievement,
  type InsertClientAchievement,
  type InsertWaitList
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // Barbers
  getBarbers(orgId?: string): Promise<Barber[]>;
  getBarber(id: number): Promise<Barber | undefined>;
  createBarber(barber: InsertBarber): Promise<Barber>;

  // Services
  getServices(orgId?: string): Promise<Service[]>;
  getService(id: number): Promise<Service | undefined>;
  createService(service: InsertService): Promise<Service>;

  // Clients
  getClients(orgId?: string): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  getClientByPhone(phone: string): Promise<Client | undefined>;
  getClientByEmail(email: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, updates: Partial<InsertClient>): Promise<Client | undefined>;

  // Google Tokens
  getGoogleToken(userId: string): Promise<GoogleToken | undefined>;
  getGoogleTokens(): Promise<GoogleToken[]>;
  createGoogleToken(token: InsertGoogleToken): Promise<GoogleToken>;
  updateGoogleToken(userId: string, updates: Partial<InsertGoogleToken>): Promise<GoogleToken | undefined>;
  deleteGoogleToken(userId: string): Promise<boolean>;

  // Admin Users
  getAdminUser(id: number): Promise<AdminUser | undefined>;
  getAdminUserByUsername(username: string): Promise<AdminUser | undefined>;
  createAdminUser(user: InsertAdminUser): Promise<AdminUser>;
  updateAdminUser(id: number, updates: Partial<InsertAdminUser>): Promise<AdminUser | undefined>;

  // Bookings
  getBookings(orgId?: string): Promise<Booking[]>;
  getBooking(id: number): Promise<Booking | undefined>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBooking(id: number, updates: Partial<InsertBooking>): Promise<Booking | undefined>;
  deleteBooking(id: number): Promise<boolean>;
  getBookingsByDate(date: string, orgId?: string): Promise<Booking[]>;
  getBookingsByBarberAndDate(barberId: number, date: string, orgId?: string): Promise<Booking[]>;
  getBookingsByClient(clientId: number): Promise<Booking[]>;

  // Reviews
  getReviews(): Promise<Review[]>;
  getReview(id: number): Promise<Review | undefined>;
  getReviewsByBarber(barberId: number): Promise<Review[]>;
  getReviewsByClient(clientId: number): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;
  updateReview(id: number, updates: Partial<InsertReview>): Promise<Review | undefined>;
  deleteReview(id: number): Promise<boolean>;

  // Discount Codes
  getDiscountCodes(): Promise<DiscountCode[]>;
  getDiscountCode(id: number): Promise<DiscountCode | undefined>;
  getDiscountCodeByCode(code: string): Promise<DiscountCode | undefined>;
  createDiscountCode(discount: InsertDiscountCode): Promise<DiscountCode>;
  updateDiscountCode(id: number, updates: Partial<InsertDiscountCode>): Promise<DiscountCode | undefined>;
  deleteDiscountCode(id: number): Promise<boolean>;

  // Discount Usage
  getDiscountUsage(discountCodeId: number): Promise<DiscountUsage[]>;
  getDiscountUsageByClient(clientId: number, discountCodeId: number): Promise<DiscountUsage[]>;
  createDiscountUsage(usage: InsertDiscountUsage): Promise<DiscountUsage>;

  // Reminder Templates
  getReminderTemplates(): Promise<ReminderTemplate[]>;
  getReminderTemplate(id: number): Promise<ReminderTemplate | undefined>;
  createReminderTemplate(template: InsertReminderTemplate): Promise<ReminderTemplate>;
  updateReminderTemplate(id: number, updates: Partial<InsertReminderTemplate>): Promise<ReminderTemplate | undefined>;
  deleteReminderTemplate(id: number): Promise<boolean>;

  // Reminder Logs
  getReminderLogs(): Promise<ReminderLog[]>;
  getReminderLogsByBooking(bookingId: number): Promise<ReminderLog[]>;
  createReminderLog(log: InsertReminderLog): Promise<ReminderLog>;
  updateReminderLog(id: number, updates: Partial<InsertReminderLog>): Promise<ReminderLog | undefined>;

  // Staff Breaks
  getStaffBreaks(): Promise<StaffBreak[]>;
  getStaffBreaksByBarber(barberId: number, date?: string): Promise<StaffBreak[]>;
  createStaffBreak(staffBreak: InsertStaffBreak): Promise<StaffBreak>;
  updateStaffBreak(id: number, updates: Partial<InsertStaffBreak>): Promise<StaffBreak | undefined>;
  deleteStaffBreak(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private barbers: Map<number, Barber>;
  private services: Map<number, Service>;
  private clients: Map<number, Client>;
  private bookings: Map<number, Booking>;
  private adminUsers: Map<number, AdminUser>;
  private currentBarberId: number;
  private currentServiceId: number;
  private currentClientId: number;
  private currentBookingId: number;
  private currentAdminUserId: number;

  constructor() {
    this.barbers = new Map();
    this.services = new Map();
    this.clients = new Map();
    this.bookings = new Map();
    this.adminUsers = new Map();
    this.currentBarberId = 1;
    this.currentServiceId = 1;
    this.currentClientId = 1;
    this.currentBookingId = 1;
    this.currentAdminUserId = 1;

    // Initialize with default data
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Create default barbers
    const defaultBarbers: InsertBarber[] = [
      {
        name: "John Doe",
        title: "Senior Barber",
        experience: "8 years exp",
        rating: "4.9 (127 reviews)",
        avatar: "JD"
      },
      {
        name: "Mike Smith",
        title: "Master Barber",
        experience: "12 years exp",
        rating: "4.8 (203 reviews)",
        avatar: "MS"
      },
      {
        name: "Alex Johnson",
        title: "Specialist",
        experience: "6 years exp",
        rating: "4.7 (89 reviews)",
        avatar: "AJ"
      },
      {
        name: "Carlos Rivera",
        title: "Style Expert",
        experience: "10 years exp",
        rating: "4.9 (156 reviews)",
        avatar: "CR"
      }
    ];

    // Create default services
    const defaultServices: InsertService[] = [
      {
        name: "Classic Haircut",
        duration: 30,
        price: 2500 // $25.00
      },
      {
        name: "Haircut + Beard",
        duration: 45,
        price: 4000 // $40.00
      },
      {
        name: "Premium Package",
        duration: 60,
        price: 6000 // $60.00
      },
      {
        name: "Beard Trim",
        duration: 20,
        price: 1500 // $15.00
      }
    ];

    // Initialize barbers
    defaultBarbers.forEach(barber => {
      const id = this.currentBarberId++;
      const fullBarber: Barber = { 
        ...barber, 
        id,
        bio: barber.bio || null,
        specialties: barber.specialties || null,
        phone: barber.phone || null,
        instagram: barber.instagram || null
      };
      this.barbers.set(id, fullBarber);
    });

    // Initialize services
    defaultServices.forEach(service => {
      const id = this.currentServiceId++;
      this.services.set(id, { ...service, id });
    });
  }

  // Barber methods
  async getBarbers(orgId?: string): Promise<Barber[]> {
    const all = Array.from(this.barbers.values());
    return orgId ? all.filter(b => b.orgId === orgId) : all;
  }

  async getBarber(id: number): Promise<Barber | undefined> {
    return this.barbers.get(id);
  }

  async createBarber(insertBarber: InsertBarber): Promise<Barber> {
    const id = this.currentBarberId++;
    const barber: Barber = { 
      ...insertBarber, 
      id,
      bio: insertBarber.bio || null,
      specialties: insertBarber.specialties || null,
      phone: insertBarber.phone || null,
      instagram: insertBarber.instagram || null
    };
    this.barbers.set(id, barber);
    return barber;
  }

  // Service methods
  async getServices(orgId?: string): Promise<Service[]> {
    const all = Array.from(this.services.values());
    return orgId ? all.filter(s => s.orgId === orgId) : all;
  }

  async getService(id: number): Promise<Service | undefined> {
    return this.services.get(id);
  }

  async createService(insertService: InsertService): Promise<Service> {
    const id = this.currentServiceId++;
    const service: Service = { ...insertService, id };
    this.services.set(id, service);
    return service;
  }

  // Booking methods
  async getBookings(orgId?: string): Promise<Booking[]> {
    let all = Array.from(this.bookings.values());
    if (orgId) all = all.filter(b => b.orgId === orgId);
    return all.sort((a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime());
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    return this.bookings.get(id);
  }

  async createBooking(insertBooking: InsertBooking): Promise<Booking> {
    const id = this.currentBookingId++;
    const booking: Booking = { 
      ...insertBooking,
      id,
      clientId: insertBooking.clientId || null,
      status: insertBooking.status || "confirmed",
      notes: insertBooking.notes || null,
      reminderSent: null,
      depositAmount: insertBooking.depositAmount || null,
      googleEventId: insertBooking.googleEventId || null,
      createdAt: new Date()
    };
    this.bookings.set(id, booking);
    return booking;
  }

  async updateBooking(id: number, updates: Partial<InsertBooking>): Promise<Booking | undefined> {
    const booking = this.bookings.get(id);
    if (!booking) return undefined;

    const updatedBooking = { ...booking, ...updates };
    this.bookings.set(id, updatedBooking);
    return updatedBooking;
  }

  async deleteBooking(id: number): Promise<boolean> {
    return this.bookings.delete(id);
  }

  async getBookingsByDate(date: string, orgId?: string): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(
      b => b.date === date && (!orgId || b.orgId === orgId)
    );
  }

  async getBookingsByBarberAndDate(barberId: number, date: string, orgId?: string): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(
      b => b.barberId === barberId && b.date === date && (!orgId || b.orgId === orgId)
    );
  }

  // Client methods
  async getClients(orgId?: string): Promise<Client[]> {
    const all = Array.from(this.clients.values());
    return orgId ? all.filter(c => c.orgId === orgId) : all;
  }

  async getClient(id: number): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async getClientByPhone(phone: string): Promise<Client | undefined> {
    return Array.from(this.clients.values()).find(client => client.phone === phone);
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const id = this.currentClientId++;
    const client: Client = { 
      ...insertClient,
      id,
      email: insertClient.email || null,
      preferredBarberId: insertClient.preferredBarberId || null,
      preferences: insertClient.preferences || null,
      notes: insertClient.notes || null,
      totalVisits: insertClient.totalVisits || 0,
      loyaltyPoints: insertClient.loyaltyPoints || 0,
      createdAt: new Date()
    };
    this.clients.set(id, client);
    return client;
  }

  async updateClient(id: number, updates: Partial<InsertClient>): Promise<Client | undefined> {
    const client = this.clients.get(id);
    if (!client) return undefined;

    const updatedClient: Client = { ...client, ...updates };
    this.clients.set(id, updatedClient);
    return updatedClient;
  }

  async getBookingsByClient(clientId: number): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(
      booking => booking.clientId === clientId
    );
  }

  // Google Token methods (not implemented for MemStorage)
  async getGoogleToken(userId: string): Promise<GoogleToken | undefined> {
    throw new Error("Google tokens not supported in memory storage");
  }

  async getGoogleTokens(): Promise<GoogleToken[]> {
    throw new Error("Google tokens not supported in memory storage");
  }

  async createGoogleToken(insertToken: InsertGoogleToken): Promise<GoogleToken> {
    throw new Error("Google tokens not supported in memory storage");
  }

  async updateGoogleToken(userId: string, updates: Partial<InsertGoogleToken>): Promise<GoogleToken | undefined> {
    throw new Error("Google tokens not supported in memory storage");
  }

  async deleteGoogleToken(userId: string): Promise<boolean> {
    throw new Error("Google tokens not supported in memory storage");
  }

  // Admin User methods (not implemented for MemStorage)
  async getAdminUser(id: number): Promise<AdminUser | undefined> {
    return this.adminUsers.get(id);
  }

  async getAdminUserByUsername(username: string): Promise<AdminUser | undefined> {
    return Array.from(this.adminUsers.values()).find(user => user.username === username);
  }

  async createAdminUser(insertUser: InsertAdminUser): Promise<AdminUser> {
    const id = this.currentAdminUserId++;
    const user: AdminUser = { 
      ...insertUser,
      id,
      barberId: insertUser.barberId ?? null,
      role: insertUser.role ?? 'barber',
      isActive: insertUser.isActive ?? true,
      createdAt: new Date(),
      lastLogin: null
    };
    this.adminUsers.set(id, user);
    return user;
  }

  async updateAdminUser(id: number, updates: Partial<InsertAdminUser>): Promise<AdminUser | undefined> {
    const user = this.adminUsers.get(id);
    if (!user) return undefined;

    const updatedUser: AdminUser = { ...user, ...updates };
    this.adminUsers.set(id, updatedUser);
    return updatedUser;
  }

  async updateBooking(id: number, updates: Partial<InsertBooking>): Promise<Booking | undefined> {
    const booking = this.bookings.get(id);
    if (!booking) return undefined;

    const updatedBooking: Booking = { ...booking, ...updates };
    this.bookings.set(id, updatedBooking);
    return updatedBooking;
  }

  // Review methods (not implemented for MemStorage)
  async getReviews(): Promise<Review[]> { return []; }
  async getReview(id: number): Promise<Review | undefined> { return undefined; }
  async getReviewsByBarber(barberId: number): Promise<Review[]> { return []; }
  async getReviewsByClient(clientId: number): Promise<Review[]> { return []; }
  async createReview(review: InsertReview): Promise<Review> { throw new Error("Reviews not supported in memory storage"); }
  async updateReview(id: number, updates: Partial<InsertReview>): Promise<Review | undefined> { return undefined; }
  async deleteReview(id: number): Promise<boolean> { return false; }

  // Discount Code methods (not implemented for MemStorage)
  async getDiscountCodes(): Promise<DiscountCode[]> { return []; }
  async getDiscountCode(id: number): Promise<DiscountCode | undefined> { return undefined; }
  async getDiscountCodeByCode(code: string): Promise<DiscountCode | undefined> { return undefined; }
  async createDiscountCode(discount: InsertDiscountCode): Promise<DiscountCode> { throw new Error("Discount codes not supported in memory storage"); }
  async updateDiscountCode(id: number, updates: Partial<InsertDiscountCode>): Promise<DiscountCode | undefined> { return undefined; }
  async deleteDiscountCode(id: number): Promise<boolean> { return false; }

  // Discount Usage methods (not implemented for MemStorage)
  async getDiscountUsage(discountCodeId: number): Promise<DiscountUsage[]> { return []; }
  async getDiscountUsageByClient(clientId: number, discountCodeId: number): Promise<DiscountUsage[]> { return []; }
  async createDiscountUsage(usage: InsertDiscountUsage): Promise<DiscountUsage> { throw new Error("Discount usage not supported in memory storage"); }

  // Reminder Template methods (not implemented for MemStorage)
  async getReminderTemplates(): Promise<ReminderTemplate[]> { return []; }
  async getReminderTemplate(id: number): Promise<ReminderTemplate | undefined> { return undefined; }
  async createReminderTemplate(template: InsertReminderTemplate): Promise<ReminderTemplate> { throw new Error("Reminder templates not supported in memory storage"); }
  async updateReminderTemplate(id: number, updates: Partial<InsertReminderTemplate>): Promise<ReminderTemplate | undefined> { return undefined; }
  async deleteReminderTemplate(id: number): Promise<boolean> { return false; }

  // Reminder Log methods (not implemented for MemStorage)
  async getReminderLogs(): Promise<ReminderLog[]> { return []; }
  async getReminderLogsByBooking(bookingId: number): Promise<ReminderLog[]> { return []; }
  async createReminderLog(log: InsertReminderLog): Promise<ReminderLog> { throw new Error("Reminder logs not supported in memory storage"); }
  async updateReminderLog(id: number, updates: Partial<InsertReminderLog>): Promise<ReminderLog | undefined> { return undefined; }

  // Staff Break methods (not implemented for MemStorage)
  async getStaffBreaks(): Promise<StaffBreak[]> { return []; }
  async getStaffBreaksByBarber(barberId: number, date?: string): Promise<StaffBreak[]> { return []; }
  async createStaffBreak(staffBreak: InsertStaffBreak): Promise<StaffBreak> { throw new Error("Staff breaks not supported in memory storage"); }
  async updateStaffBreak(id: number, updates: Partial<InsertStaffBreak>): Promise<StaffBreak | undefined> { return undefined; }
  async deleteStaffBreak(id: number): Promise<boolean> { return false; }

  // Client by email (not implemented for MemStorage)
  async getClientByEmail(email: string): Promise<Client | undefined> {
    return Array.from(this.clients.values()).find(client => client.email === email);
  }
}

export class DatabaseStorage implements IStorage {
  constructor() {
    // Initialize data asynchronously to avoid blocking server startup
    this.initializeDefaultData().catch(console.error);
  }

  private async initializeDefaultData() {
    try {
      // Always ensure the default admin user exists, regardless of other seed state
      try {
        const existingAdmin = await this.getAdminUserByUsername('admin');
        if (!existingAdmin) {
          const bcrypt = await import('bcrypt');
          const seededBarbers = await this.getBarbers();
          const hashedPassword = await bcrypt.hash('admin123', 10);
          await this.createAdminUser({
            username: 'admin',
            password: hashedPassword,
            barberId: seededBarbers[0]?.id ?? null,
            role: 'admin',
            isActive: true
          });
          console.log('[seed] admin user created (admin / admin123)');
        }
      } catch (error) {
        console.error('Error ensuring default admin user:', error);
      }

      // Check if barbers already exist before seeding content
      const existingBarbers = await this.getBarbers();
      if (existingBarbers.length > 0) return;

      // Create default barbers FIRST (admin users reference barber IDs)
      const defaultBarbers: InsertBarber[] = [
        {
          name: "John Doe",
          title: "Senior Barber",
          experience: "8 years exp",
          rating: "4.9 (127 reviews)",
          avatar: "JD"
        },
        {
          name: "Mike Smith",
          title: "Master Barber",
          experience: "12 years exp",
          rating: "4.8 (203 reviews)",
          avatar: "MS"
        },
        {
          name: "Alex Johnson",
          title: "Specialist",
          experience: "6 years exp",
          rating: "4.7 (89 reviews)",
          avatar: "AJ"
        },
        {
          name: "Carlos Rivera",
          title: "Style Expert",
          experience: "10 years exp",
          rating: "4.9 (156 reviews)",
          avatar: "CR"
        }
      ];

      // Create default services
      const defaultServices: InsertService[] = [
        {
          name: "Classic Haircut",
          duration: 30,
          price: 2500 // $25.00
        },
        {
          name: "Haircut + Beard",
          duration: 45,
          price: 4000 // $40.00
        },
        {
          name: "Premium Package",
          duration: 60,
          price: 6000 // $60.00
        },
        {
          name: "Beard Trim",
          duration: 20,
          price: 1500 // $15.00
        }
      ];

      // Initialize barbers with error handling
      for (const barber of defaultBarbers) {
        try {
          await this.createBarber(barber);
        } catch (error) {
          console.error('Error creating barber:', barber.name, error);
        }
      }

      // Initialize services with error handling
      for (const service of defaultServices) {
        try {
          await this.createService(service);
        } catch (error) {
          console.error('Error creating service:', service.name, error);
        }
      }

    } catch (error) {
      console.error('Error in initializeDefaultData:', error);
    }
  }

  // Barber methods
  async getBarbers(orgId?: string): Promise<Barber[]> {
    if (orgId) return await db.select().from(barbers).where(eq(barbers.orgId, orgId));
    return await db.select().from(barbers);
  }

  async getBarber(id: number): Promise<Barber | undefined> {
    const [barber] = await db.select().from(barbers).where(eq(barbers.id, id));
    return barber || undefined;
  }

  async createBarber(insertBarber: InsertBarber): Promise<Barber> {
    const [barber] = await db
      .insert(barbers)
      .values(insertBarber)
      .returning();
    return barber;
  }

  // Service methods
  async getServices(orgId?: string): Promise<Service[]> {
    if (orgId) return await db.select().from(services).where(eq(services.orgId, orgId));
    return await db.select().from(services);
  }

  async getService(id: number): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service || undefined;
  }

  async createService(insertService: InsertService): Promise<Service> {
    const [service] = await db
      .insert(services)
      .values(insertService)
      .returning();
    return service;
  }

  // Booking methods
  async getBookings(orgId?: string): Promise<Booking[]> {
    if (orgId) return await db.select().from(bookings).where(eq(bookings.orgId, orgId)).orderBy(bookings.createdAt);
    return await db.select().from(bookings).orderBy(bookings.createdAt);
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking || undefined;
  }

  async createBooking(insertBooking: InsertBooking): Promise<Booking> {
    const [booking] = await db
      .insert(bookings)
      .values(insertBooking)
      .returning();
    return booking;
  }

  async updateBooking(id: number, updates: Partial<InsertBooking>): Promise<Booking | undefined> {
    const [booking] = await db
      .update(bookings)
      .set(updates)
      .where(eq(bookings.id, id))
      .returning();
    return booking || undefined;
  }

  async deleteBooking(id: number): Promise<boolean> {
    const result = await db.delete(bookings).where(eq(bookings.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getBookingsByDate(date: string, orgId?: string): Promise<Booking[]> {
    const cond = orgId ? and(eq(bookings.date, date), eq(bookings.orgId, orgId)) : eq(bookings.date, date);
    return await db.select().from(bookings).where(cond);
  }

  async getBookingsByBarberAndDate(barberId: number, date: string, orgId?: string): Promise<Booking[]> {
    const cond = orgId
      ? and(eq(bookings.barberId, barberId), eq(bookings.date, date), eq(bookings.orgId, orgId))
      : and(eq(bookings.barberId, barberId), eq(bookings.date, date));
    return await db.select().from(bookings).where(cond);
  }

  // Client methods
  async getClients(orgId?: string): Promise<Client[]> {
    if (orgId) return await db.select().from(clients).where(eq(clients.orgId, orgId));
    return await db.select().from(clients);
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client || undefined;
  }

  async getClientByPhone(phone: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.phone, phone));
    return client || undefined;
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const [client] = await db
      .insert(clients)
      .values(insertClient)
      .returning();
    return client;
  }

  async updateClient(id: number, updates: Partial<InsertClient>): Promise<Client | undefined> {
    const [client] = await db
      .update(clients)
      .set(updates)
      .where(eq(clients.id, id))
      .returning();
    return client || undefined;
  }

  async getBookingsByClient(clientId: number): Promise<Booking[]> {
    return await db.select().from(bookings).where(eq(bookings.clientId, clientId));
  }

  // Google Token methods
  async getGoogleToken(userId: string): Promise<GoogleToken | undefined> {
    const [token] = await db.select().from(googleTokens).where(eq(googleTokens.userId, userId));
    return token || undefined;
  }

  async getGoogleTokens(): Promise<GoogleToken[]> {
    return await db.select().from(googleTokens);
  }

  async createGoogleToken(insertToken: InsertGoogleToken): Promise<GoogleToken> {
    const [token] = await db
      .insert(googleTokens)
      .values(insertToken)
      .returning();
    return token;
  }

  async updateGoogleToken(userId: string, updates: Partial<InsertGoogleToken>): Promise<GoogleToken | undefined> {
    const [token] = await db
      .update(googleTokens)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(googleTokens.userId, userId))
      .returning();
    return token || undefined;
  }

  async deleteGoogleToken(userId: string): Promise<boolean> {
    const result = await db.delete(googleTokens).where(eq(googleTokens.userId, userId));
    return (result.rowCount || 0) > 0;
  }

  // Admin User methods
  async getAdminUser(id: number): Promise<AdminUser | undefined> {
    const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
    return user || undefined;
  }

  async getAdminUserByUsername(username: string): Promise<AdminUser | undefined> {
    const [user] = await db.select().from(adminUsers).where(eq(adminUsers.username, username));
    return user || undefined;
  }

  async createAdminUser(insertUser: InsertAdminUser): Promise<AdminUser> {
    const [user] = await db
      .insert(adminUsers)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateAdminUser(id: number, updates: Partial<InsertAdminUser>): Promise<AdminUser | undefined> {
    const [user] = await db
      .update(adminUsers)
      .set(updates)
      .where(eq(adminUsers.id, id))
      .returning();
    return user || undefined;
  }

  // Review methods
  async getReviews(): Promise<Review[]> {
    return await db.select().from(reviews);
  }

  async getReview(id: number): Promise<Review | undefined> {
    const [review] = await db.select().from(reviews).where(eq(reviews.id, id));
    return review || undefined;
  }

  async getReviewsByBarber(barberId: number): Promise<Review[]> {
    return await db.select().from(reviews).where(eq(reviews.barberId, barberId));
  }

  async getReviewsByClient(clientId: number): Promise<Review[]> {
    return await db.select().from(reviews).where(eq(reviews.clientId, clientId));
  }

  async createReview(insertReview: InsertReview): Promise<Review> {
    const [review] = await db
      .insert(reviews)
      .values(insertReview)
      .returning();
    return review;
  }

  async updateReview(id: number, updates: Partial<InsertReview>): Promise<Review | undefined> {
    const [review] = await db
      .update(reviews)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(reviews.id, id))
      .returning();
    return review || undefined;
  }

  async deleteReview(id: number): Promise<boolean> {
    const result = await db.delete(reviews).where(eq(reviews.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Discount Code methods
  async getDiscountCodes(): Promise<DiscountCode[]> {
    return await db.select().from(discountCodes);
  }

  async getDiscountCode(id: number): Promise<DiscountCode | undefined> {
    const [discount] = await db.select().from(discountCodes).where(eq(discountCodes.id, id));
    return discount || undefined;
  }

  async getDiscountCodeByCode(code: string): Promise<DiscountCode | undefined> {
    const [discount] = await db.select().from(discountCodes).where(eq(discountCodes.code, code));
    return discount || undefined;
  }

  async createDiscountCode(insertDiscount: InsertDiscountCode): Promise<DiscountCode> {
    const [discount] = await db
      .insert(discountCodes)
      .values(insertDiscount)
      .returning();
    return discount;
  }

  async updateDiscountCode(id: number, updates: Partial<InsertDiscountCode>): Promise<DiscountCode | undefined> {
    const [discount] = await db
      .update(discountCodes)
      .set(updates)
      .where(eq(discountCodes.id, id))
      .returning();
    return discount || undefined;
  }

  async deleteDiscountCode(id: number): Promise<boolean> {
    const result = await db.delete(discountCodes).where(eq(discountCodes.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Discount Usage methods
  async getDiscountUsage(discountCodeId: number): Promise<DiscountUsage[]> {
    return await db.select().from(discountUsage).where(eq(discountUsage.discountCodeId, discountCodeId));
  }

  async getDiscountUsageByClient(clientId: number, discountCodeId: number): Promise<DiscountUsage[]> {
    return await db
      .select()
      .from(discountUsage)
      .where(and(eq(discountUsage.clientId, clientId), eq(discountUsage.discountCodeId, discountCodeId)));
  }

  async createDiscountUsage(insertUsage: InsertDiscountUsage): Promise<DiscountUsage> {
    const [usage] = await db
      .insert(discountUsage)
      .values(insertUsage)
      .returning();
    return usage;
  }

  // Reminder Template methods
  async getReminderTemplates(): Promise<ReminderTemplate[]> {
    return await db.select().from(reminderTemplates);
  }

  async getReminderTemplate(id: number): Promise<ReminderTemplate | undefined> {
    const [template] = await db.select().from(reminderTemplates).where(eq(reminderTemplates.id, id));
    return template || undefined;
  }

  async createReminderTemplate(insertTemplate: InsertReminderTemplate): Promise<ReminderTemplate> {
    const [template] = await db
      .insert(reminderTemplates)
      .values(insertTemplate)
      .returning();
    return template;
  }

  async updateReminderTemplate(id: number, updates: Partial<InsertReminderTemplate>): Promise<ReminderTemplate | undefined> {
    const [template] = await db
      .update(reminderTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(reminderTemplates.id, id))
      .returning();
    return template || undefined;
  }

  async deleteReminderTemplate(id: number): Promise<boolean> {
    const result = await db.delete(reminderTemplates).where(eq(reminderTemplates.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Reminder Log methods
  async getReminderLogs(): Promise<ReminderLog[]> {
    return await db.select().from(reminderLogs);
  }

  async getReminderLogsByBooking(bookingId: number): Promise<ReminderLog[]> {
    return await db.select().from(reminderLogs).where(eq(reminderLogs.bookingId, bookingId));
  }

  async createReminderLog(insertLog: InsertReminderLog): Promise<ReminderLog> {
    const [log] = await db
      .insert(reminderLogs)
      .values(insertLog)
      .returning();
    return log;
  }

  async updateReminderLog(id: number, updates: Partial<InsertReminderLog>): Promise<ReminderLog | undefined> {
    const [log] = await db
      .update(reminderLogs)
      .set(updates)
      .where(eq(reminderLogs.id, id))
      .returning();
    return log || undefined;
  }

  // Staff Break methods
  async getStaffBreaks(): Promise<StaffBreak[]> {
    return await db.select().from(staffBreaks);
  }

  async getStaffBreaksByBarber(barberId: number, date?: string): Promise<StaffBreak[]> {
    if (date) {
      return await db
        .select()
        .from(staffBreaks)
        .where(and(eq(staffBreaks.barberId, barberId), eq(staffBreaks.date, date)));
    }
    return await db.select().from(staffBreaks).where(eq(staffBreaks.barberId, barberId));
  }

  async createStaffBreak(insertBreak: InsertStaffBreak): Promise<StaffBreak> {
    const [staffBreak] = await db
      .insert(staffBreaks)
      .values(insertBreak)
      .returning();
    return staffBreak;
  }

  async updateStaffBreak(id: number, updates: Partial<InsertStaffBreak>): Promise<StaffBreak | undefined> {
    const [staffBreak] = await db
      .update(staffBreaks)
      .set(updates)
      .where(eq(staffBreaks.id, id))
      .returning();
    return staffBreak || undefined;
  }

  async deleteStaffBreak(id: number): Promise<boolean> {
    const result = await db.delete(staffBreaks).where(eq(staffBreaks.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Client by email
  async getClientByEmail(email: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.email, email));
    return client || undefined;
  }
}

export const storage = new DatabaseStorage();