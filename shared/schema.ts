import { pgTable, text, serial, integer, timestamp, numeric, jsonb, index, varchar, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Admin users table for barber authentication
export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  orgId: text("org_id"), // SFS-Backend org UUID — null = legacy single-tenant
  username: text("username").notNull().unique(),
  password: text("password").notNull(), // hashed
  barberId: integer("barber_id").references(() => barbers.id),
  role: text("role").notNull().default("barber"), // barber, admin
  isActive: boolean("is_active").notNull().default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const barbers = pgTable("barbers", {
  id: serial("id").primaryKey(),
  orgId: text("org_id"), // SFS-Backend org UUID
  name: text("name").notNull(),
  title: text("title").notNull(),
  bio: text("bio"),
  experience: text("experience").notNull(),
  rating: text("rating").notNull(),
  avatar: text("avatar").notNull(),
  specialties: text("specialties").array(),
  phone: text("phone"),
  instagram: text("instagram"),
});

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  orgId: text("org_id"), // SFS-Backend org UUID
  name: text("name").notNull(),
  duration: integer("duration").notNull(), // in minutes
  price: integer("price").notNull(), // in cents
});

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  orgId: text("org_id"), // SFS-Backend org UUID
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  email: text("email"),
  password: text("password"), // hashed password for customer login
  emailVerified: boolean("email_verified").default(false),
  preferredBarberId: integer("preferred_barber_id"),
  preferences: text("preferences"),
  notes: text("notes"),
  totalVisits: integer("total_visits").default(0),
  loyaltyPoints: integer("loyalty_points").default(0),
  birthday: text("birthday"), // YYYY-MM-DD format
  anniversary: text("anniversary"), // YYYY-MM-DD format
  referredBy: integer("referred_by").references(() => clients.id),
  profilePhoto: text("profile_photo"),
  lastVisit: timestamp("last_visit"),
  totalSpent: integer("total_spent").default(0), // in cents
  notificationPreferences: jsonb("notification_preferences"), // email, sms preferences
  createdAt: timestamp("created_at").defaultNow(),
});

export const clientPhotos = pgTable("client_photos", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),
  photoUrl: text("photo_url").notNull(),
  serviceId: integer("service_id").references(() => services.id),
  description: text("description"),
  takenAt: timestamp("taken_at").defaultNow(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").references(() => bookings.id, { onDelete: "cascade" }).notNull(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  barberId: integer("barber_id").references(() => barbers.id).notNull(),
  amount: integer("amount").notNull(), // in cents
  tip: integer("tip").default(0), // in cents
  method: text("method").notNull(), // "stripe", "cash", "card"
  stripePaymentId: text("stripe_payment_id"),
  status: text("status").notNull().default("pending"), // "pending", "completed", "failed", "refunded"
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const packages = pgTable("packages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  serviceIds: text("service_ids").array(), // service IDs
  totalSessions: integer("total_sessions").notNull(),
  price: integer("price").notNull(), // in cents
  validityDays: integer("validity_days").default(365),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clientPackages = pgTable("client_packages", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),
  packageId: integer("package_id").references(() => packages.id).notNull(),
  sessionsUsed: integer("sessions_used").default(0),
  purchasedAt: timestamp("purchased_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export const analytics = pgTable("analytics", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(), // YYYY-MM-DD format
  revenue: integer("revenue").default(0), // in cents
  bookings: integer("bookings").default(0),
  newClients: integer("new_clients").default(0),
  mostPopularService: integer("most_popular_service"),
  averageTicket: integer("average_ticket").default(0), // in cents
  data: jsonb("data"), // flexible analytics data
  createdAt: timestamp("created_at").defaultNow(),
});

export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // "birthday", "anniversary", "referral", "review_follow_up"
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  isActive: boolean("is_active").default(true),
  sentCount: integer("sent_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const marketingLogs = pgTable("marketing_logs", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => marketingCampaigns.id).notNull(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  sentAt: timestamp("sent_at").defaultNow(),
  opened: boolean("opened").default(false),
  clicked: boolean("clicked").default(false),
});

export const staffSchedule = pgTable("staff_schedule", {
  id: serial("id").primaryKey(),
  barberId: integer("barber_id").references(() => barbers.id, { onDelete: "cascade" }).notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format
  startTime: text("start_time").notNull(), // HH:MM format
  endTime: text("end_time").notNull(), // HH:MM format
  isAvailable: boolean("is_available").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const timeOffRequests = pgTable("time_off_requests", {
  id: serial("id").primaryKey(),
  barberId: integer("barber_id").references(() => barbers.id, { onDelete: "cascade" }).notNull(),
  startDate: text("start_date").notNull(), // YYYY-MM-DD format
  endDate: text("end_date").notNull(), // YYYY-MM-DD format
  reason: text("reason"),
  status: text("status").notNull().default("pending"), // "pending", "approved", "rejected"
  approvedBy: integer("approved_by").references(() => adminUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(), // "product", "supply", "tool"
  currentStock: integer("current_stock").default(0),
  minimumStock: integer("minimum_stock").default(5),
  unitCost: integer("unit_cost").default(0), // in cents
  retailPrice: integer("retail_price").default(0), // in cents
  supplier: text("supplier"),
  lastRestocked: timestamp("last_restocked"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const inventoryUsage = pgTable("inventory_usage", {
  id: serial("id").primaryKey(),
  inventoryId: integer("inventory_id").references(() => inventory.id, { onDelete: "cascade" }).notNull(),
  bookingId: integer("booking_id").references(() => bookings.id),
  quantity: integer("quantity").notNull(),
  usedAt: timestamp("used_at").defaultNow(),
});

export const retailSales = pgTable("retail_sales", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  barberId: integer("barber_id").references(() => barbers.id).notNull(),
  inventoryId: integer("inventory_id").references(() => inventory.id, { onDelete: "cascade" }).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(), // in cents
  totalAmount: integer("total_amount").notNull(), // in cents
  paymentMethod: text("payment_method").notNull(),
  soldAt: timestamp("sold_at").defaultNow(),
});

export const googleTokens = pgTable("google_tokens", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiryDate: timestamp("expiry_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  orgId: text("org_id"), // SFS-Backend org UUID
  clientId: integer("client_id"),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email"),
  barberId: integer("barber_id").notNull(),
  serviceId: integer("service_id").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format
  time: text("time").notNull(), // HH:MM format
  status: text("status").notNull().default("confirmed"), // confirmed, completed, cancelled
  notes: text("notes"),
  reminderSent: timestamp("reminder_sent"),
  depositAmount: integer("deposit_amount").default(0),
  googleEventId: text("google_event_id"), // For calendar sync
  discountCode: text("discount_code"), // applied discount code
  discountAmount: integer("discount_amount").default(0), // discount amount in cents
  finalAmount: integer("final_amount"), // final amount after discount in cents
  createdAt: timestamp("created_at").defaultNow(),
});

// Reviews table for customer feedback
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  barberId: integer("barber_id").references(() => barbers.id, { onDelete: "cascade" }).notNull(),
  bookingId: integer("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
  serviceId: integer("service_id").references(() => services.id),
  rating: integer("rating").notNull(), // 1-5 stars
  comment: text("comment"),
  isAnonymous: boolean("is_anonymous").default(false),
  isApproved: boolean("is_approved").default(true),
  isPublished: boolean("is_published").default(true),
  adminResponse: text("admin_response"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Discount codes and promotions
export const discountCodes = pgTable("discount_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description"),
  type: text("type").notNull(), // "percentage", "fixed_amount", "service_discount"
  value: integer("value").notNull(), // percentage (0-100) or amount in cents
  minPurchase: integer("min_purchase").default(0), // minimum purchase amount in cents
  maxDiscount: integer("max_discount"), // max discount amount for percentage type
  usageLimit: integer("usage_limit"), // total usage limit
  usageCount: integer("usage_count").default(0),
  perClientLimit: integer("per_client_limit").default(1), // usage limit per client
  validFrom: timestamp("valid_from").defaultNow(),
  validUntil: timestamp("valid_until"),
  isActive: boolean("is_active").default(true),
  applicableServices: text("applicable_services").array(), // service IDs
  firstTimeOnly: boolean("first_time_only").default(false), // only for new clients
  createdBy: integer("created_by").references(() => adminUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Track discount code usage
export const discountUsage = pgTable("discount_usage", {
  id: serial("id").primaryKey(),
  discountCodeId: integer("discount_code_id").references(() => discountCodes.id, { onDelete: "cascade" }).notNull(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  bookingId: integer("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
  discountAmount: integer("discount_amount").notNull(), // in cents
  usedAt: timestamp("used_at").defaultNow(),
});

// Reminder settings and templates
export const reminderTemplates = pgTable("reminder_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // "email", "sms"
  triggerHours: integer("trigger_hours").notNull(), // hours before appointment (e.g., 24, 48)
  subject: text("subject"), // for email
  message: text("message").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Log of sent reminders
export const reminderLogs = pgTable("reminder_logs", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").references(() => bookings.id, { onDelete: "cascade" }).notNull(),
  templateId: integer("template_id").references(() => reminderTemplates.id),
  type: text("type").notNull(), // "email", "sms"
  recipient: text("recipient").notNull(), // email or phone
  status: text("status").notNull().default("pending"), // "pending", "sent", "failed", "delivered"
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Staff break times
export const staffBreaks = pgTable("staff_breaks", {
  id: serial("id").primaryKey(),
  barberId: integer("barber_id").references(() => barbers.id, { onDelete: "cascade" }).notNull(),
  scheduleId: integer("schedule_id").references(() => staffSchedule.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD format
  startTime: text("start_time").notNull(), // HH:MM format
  endTime: text("end_time").notNull(), // HH:MM format
  breakType: text("break_type").notNull(), // "lunch", "break", "custom"
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ==================================================
// POWERHOUSE FEATURES - Revenue & Growth
// ==================================================

// Gift Cards
export const giftCards = pgTable("gift_cards", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  initialAmount: integer("initial_amount").notNull(), // in cents
  currentBalance: integer("current_balance").notNull(), // in cents
  purchasedBy: integer("purchased_by").references(() => clients.id),
  purchaserEmail: text("purchaser_email"),
  recipientName: text("recipient_name"),
  recipientEmail: text("recipient_email"),
  message: text("message"),
  status: text("status").notNull().default("active"), // "active", "redeemed", "expired", "cancelled"
  expiresAt: timestamp("expires_at"),
  purchasedAt: timestamp("purchased_at").defaultNow(),
  redeemedAt: timestamp("redeemed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Gift Card Transactions
export const giftCardTransactions = pgTable("gift_card_transactions", {
  id: serial("id").primaryKey(),
  giftCardId: integer("gift_card_id").references(() => giftCards.id, { onDelete: "cascade" }).notNull(),
  bookingId: integer("booking_id").references(() => bookings.id),
  amount: integer("amount").notNull(), // in cents (negative for usage)
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  type: text("type").notNull(), // "purchase", "reload", "redemption", "refund"
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Referral Program
export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),
  referredId: integer("referred_id").references(() => clients.id, { onDelete: "cascade" }),
  referredEmail: text("referred_email"),
  referredPhone: text("referred_phone"),
  referralCode: text("referral_code").notNull(),
  status: text("status").notNull().default("pending"), // "pending", "completed", "rewarded"
  referrerReward: integer("referrer_reward").default(0), // in cents or points
  referredReward: integer("referred_reward").default(0), // in cents or points
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Memberships/Subscriptions
export const membershipTiers = pgTable("membership_tiers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull(), // in cents per month
  billingCycle: text("billing_cycle").notNull().default("monthly"), // "monthly", "quarterly", "yearly"
  benefits: jsonb("benefits"), // { cuts: number, discounts: number, priority: boolean, etc. }
  maxCutsPerMonth: integer("max_cuts_per_month"),
  discountPercentage: integer("discount_percentage").default(0),
  priorityBooking: boolean("priority_booking").default(false),
  freeProducts: jsonb("free_products"), // array of product IDs
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Client Memberships
export const clientMemberships = pgTable("client_memberships", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),
  tierId: integer("tier_id").references(() => membershipTiers.id).notNull(),
  status: text("status").notNull().default("active"), // "active", "paused", "cancelled", "expired"
  cutsUsedThisMonth: integer("cuts_used_this_month").default(0),
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"),
  nextBillingDate: timestamp("next_billing_date"),
  autoRenew: boolean("auto_renew").default(true),
  stripeSubscriptionId: text("stripe_subscription_id"),
  pausedAt: timestamp("paused_at"),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Virtual Queue
export const virtualQueue = pgTable("virtual_queue", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  barberId: integer("barber_id").references(() => barbers.id),
  serviceId: integer("service_id").references(() => services.id),
  position: integer("position").notNull(),
  estimatedWaitTime: integer("estimated_wait_time"), // in minutes
  status: text("status").notNull().default("waiting"), // "waiting", "called", "serving", "completed", "cancelled"
  joinedAt: timestamp("joined_at").defaultNow(),
  calledAt: timestamp("called_at"),
  completedAt: timestamp("completed_at"),
  notificationSent: boolean("notification_sent").default(false),
});

// AI Style Consultations
export const styleConsultations = pgTable("style_consultations", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),
  faceShapePhoto: text("face_shape_photo"),
  detectedFaceShape: text("detected_face_shape"), // "oval", "round", "square", "heart", "diamond"
  currentStyle: text("current_style"),
  desiredStyle: text("desired_style"),
  lifestyle: text("lifestyle"), // "professional", "casual", "athletic", etc.
  hairType: text("hair_type"),
  aiRecommendations: jsonb("ai_recommendations"), // array of style suggestions
  selectedStyle: text("selected_style"),
  barberId: integer("barber_id").references(() => barbers.id),
  bookingId: integer("booking_id").references(() => bookings.id),
  status: text("status").notNull().default("pending"), // "pending", "completed"
  createdAt: timestamp("created_at").defaultNow(),
});

// Product Marketplace
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // "hair_care", "styling", "grooming", "tools"
  brand: text("brand"),
  price: integer("price").notNull(), // in cents
  compareAtPrice: integer("compare_at_price"), // original price for discounts
  stock: integer("stock").default(0),
  lowStockThreshold: integer("low_stock_threshold").default(5),
  images: text("images").array(),
  isActive: boolean("is_active").default(true),
  isFeatured: boolean("is_featured").default(false),
  tags: text("tags").array(),
  barberRecommended: boolean("barber_recommended").default(false),
  recommendedBy: integer("recommended_by").references(() => barbers.id),
  affiliateUrl: text("affiliate_url"),
  commissionRate: integer("commission_rate"), // percentage
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Product Orders
export const productOrders = pgTable("product_orders", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),
  orderNumber: text("order_number").notNull().unique(),
  subtotal: integer("subtotal").notNull(), // in cents
  tax: integer("tax").default(0),
  shipping: integer("shipping").default(0),
  discount: integer("discount").default(0),
  total: integer("total").notNull(),
  status: text("status").notNull().default("pending"), // "pending", "processing", "shipped", "delivered", "cancelled"
  paymentStatus: text("payment_status").notNull().default("pending"), // "pending", "paid", "refunded"
  stripePaymentId: text("stripe_payment_id"),
  shippingAddress: jsonb("shipping_address"),
  trackingNumber: text("tracking_number"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  shippedAt: timestamp("shipped_at"),
  deliveredAt: timestamp("delivered_at"),
});

// Product Order Items
export const productOrderItems = pgTable("product_order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => productOrders.id, { onDelete: "cascade" }).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(), // in cents
  totalPrice: integer("total_price").notNull(), // in cents
});

// Multi-Location Support
export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  country: text("country").notNull().default("US"),
  phone: text("phone"),
  email: text("email"),
  latitude: numeric("latitude"),
  longitude: numeric("longitude"),
  timezone: text("timezone").default("America/New_York"),
  businessHours: jsonb("business_hours"), // { monday: { open: "09:00", close: "18:00" }, etc. }
  amenities: text("amenities").array(),
  photos: text("photos").array(),
  isActive: boolean("is_active").default(true),
  isFlagship: boolean("is_flagship").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Barber-Location Assignments
export const barberLocations = pgTable("barber_locations", {
  id: serial("id").primaryKey(),
  barberId: integer("barber_id").references(() => barbers.id, { onDelete: "cascade" }).notNull(),
  locationId: integer("location_id").references(() => locations.id, { onDelete: "cascade" }).notNull(),
  isPrimary: boolean("is_primary").default(false),
  schedule: jsonb("schedule"), // location-specific schedule
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"),
});

// Customer Gallery (Public Portfolio)
export const galleryPhotos = pgTable("gallery_photos", {
  id: serial("id").primaryKey(),
  barberId: integer("barber_id").references(() => barbers.id, { onDelete: "cascade" }).notNull(),
  clientId: integer("client_id").references(() => clients.id),
  serviceId: integer("service_id").references(() => services.id),
  beforePhoto: text("before_photo"),
  afterPhoto: text("after_photo").notNull(),
  description: text("description"),
  tags: text("tags").array(),
  productsUsed: text("products_used").array(), // product IDs
  isPublic: boolean("is_public").default(false),
  isFeatured: boolean("is_featured").default(false),
  likes: integer("likes").default(0),
  views: integer("views").default(0),
  clientConsent: boolean("client_consent").default(false),
  instagramUrl: text("instagram_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Gallery Likes
export const galleryLikes = pgTable("gallery_likes", {
  id: serial("id").primaryKey(),
  photoId: integer("photo_id").references(() => galleryPhotos.id, { onDelete: "cascade" }).notNull(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Achievements/Gamification
export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon"),
  category: text("category").notNull(), // "visits", "spending", "referrals", "reviews", "social"
  requirement: jsonb("requirement"), // { type: "visits", count: 5 }
  reward: jsonb("reward"), // { type: "points", value: 100 } or { type: "discount", value: 10 }
  points: integer("points").default(0),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Client Achievements
export const clientAchievements = pgTable("client_achievements", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),
  achievementId: integer("achievement_id").references(() => achievements.id, { onDelete: "cascade" }).notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
  progress: integer("progress").default(0),
  isCompleted: boolean("is_completed").default(false),
  sharedToSocial: boolean("shared_to_social").default(false),
});

// Wait List (for fully booked times)
export const waitList = pgTable("wait_list", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email"),
  barberId: integer("barber_id").references(() => barbers.id),
  serviceId: integer("service_id").references(() => services.id),
  preferredDate: text("preferred_date"), // YYYY-MM-DD
  preferredTime: text("preferred_time"), // HH:MM
  flexibleDates: text("flexible_dates").array(), // array of dates
  flexibleTimes: text("flexible_times").array(), // array of time ranges
  status: text("status").notNull().default("active"), // "active", "matched", "cancelled"
  notified: boolean("notified").default(false),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBarberSchema = createInsertSchema(barbers).omit({
  id: true,
});

export const insertServiceSchema = createInsertSchema(services).omit({
  id: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});

export const insertGoogleTokenSchema = createInsertSchema(googleTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
});

export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({
  id: true,
  createdAt: true,
  lastLogin: true,
});

export const insertClientPhotoSchema = createInsertSchema(clientPhotos).omit({
  id: true,
  takenAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export const insertPackageSchema = createInsertSchema(packages).omit({
  id: true,
  createdAt: true,
});

export const insertClientPackageSchema = createInsertSchema(clientPackages).omit({
  id: true,
  purchasedAt: true,
});

export const insertAnalyticsSchema = createInsertSchema(analytics).omit({
  id: true,
  createdAt: true,
});

export const insertMarketingCampaignSchema = createInsertSchema(marketingCampaigns).omit({
  id: true,
  createdAt: true,
});

export const insertStaffScheduleSchema = createInsertSchema(staffSchedule).omit({
  id: true,
  createdAt: true,
});

export const insertTimeOffRequestSchema = createInsertSchema(timeOffRequests).omit({
  id: true,
  createdAt: true,
});

export const insertInventorySchema = createInsertSchema(inventory).omit({
  id: true,
  createdAt: true,
  lastRestocked: true,
});

export const insertRetailSaleSchema = createInsertSchema(retailSales).omit({
  id: true,
  soldAt: true,
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDiscountCodeSchema = createInsertSchema(discountCodes).omit({
  id: true,
  createdAt: true,
});

export const insertDiscountUsageSchema = createInsertSchema(discountUsage).omit({
  id: true,
  usedAt: true,
});

export const insertReminderTemplateSchema = createInsertSchema(reminderTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReminderLogSchema = createInsertSchema(reminderLogs).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  deliveredAt: true,
});

export const insertStaffBreakSchema = createInsertSchema(staffBreaks).omit({
  id: true,
  createdAt: true,
});

export type InsertBarber = z.infer<typeof insertBarberSchema>;
export type Barber = typeof barbers.$inferSelect;

export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof services.$inferSelect;

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export type InsertGoogleToken = z.infer<typeof insertGoogleTokenSchema>;
export type GoogleToken = typeof googleTokens.$inferSelect;

export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;

export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;

export type InsertClientPhoto = z.infer<typeof insertClientPhotoSchema>;
export type ClientPhoto = typeof clientPhotos.$inferSelect;

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

export type InsertPackage = z.infer<typeof insertPackageSchema>;
export type Package = typeof packages.$inferSelect;

export type InsertClientPackage = z.infer<typeof insertClientPackageSchema>;
export type ClientPackage = typeof clientPackages.$inferSelect;

export type InsertAnalytics = z.infer<typeof insertAnalyticsSchema>;
export type Analytics = typeof analytics.$inferSelect;

export type InsertMarketingCampaign = z.infer<typeof insertMarketingCampaignSchema>;
export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;

export type InsertStaffSchedule = z.infer<typeof insertStaffScheduleSchema>;
export type StaffSchedule = typeof staffSchedule.$inferSelect;

export type InsertTimeOffRequest = z.infer<typeof insertTimeOffRequestSchema>;
export type TimeOffRequest = typeof timeOffRequests.$inferSelect;

export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type Inventory = typeof inventory.$inferSelect;

export type InsertRetailSale = z.infer<typeof insertRetailSaleSchema>;
export type RetailSale = typeof retailSales.$inferSelect;

export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;

export type InsertDiscountCode = z.infer<typeof insertDiscountCodeSchema>;
export type DiscountCode = typeof discountCodes.$inferSelect;

export type InsertDiscountUsage = z.infer<typeof insertDiscountUsageSchema>;
export type DiscountUsage = typeof discountUsage.$inferSelect;

export type InsertReminderTemplate = z.infer<typeof insertReminderTemplateSchema>;
export type ReminderTemplate = typeof reminderTemplates.$inferSelect;

export type InsertReminderLog = z.infer<typeof insertReminderLogSchema>;
export type ReminderLog = typeof reminderLogs.$inferSelect;

export type InsertStaffBreak = z.infer<typeof insertStaffBreakSchema>;
export type StaffBreak = typeof staffBreaks.$inferSelect;

// ==================================================
// POWERHOUSE FEATURES - Insert Schemas & Types
// ==================================================

// Gift Cards
export const insertGiftCardSchema = createInsertSchema(giftCards).omit({ id: true, createdAt: true, purchasedAt: true });
export type InsertGiftCard = z.infer<typeof insertGiftCardSchema>;
export type GiftCard = typeof giftCards.$inferSelect;

// Gift Card Transactions
export const insertGiftCardTransactionSchema = createInsertSchema(giftCardTransactions).omit({ id: true, createdAt: true });
export type InsertGiftCardTransaction = z.infer<typeof insertGiftCardTransactionSchema>;
export type GiftCardTransaction = typeof giftCardTransactions.$inferSelect;

// Referrals
export const insertReferralSchema = createInsertSchema(referrals).omit({ id: true, createdAt: true });
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referrals.$inferSelect;

// Membership Tiers
export const insertMembershipTierSchema = createInsertSchema(membershipTiers).omit({ id: true, createdAt: true });
export type InsertMembershipTier = z.infer<typeof insertMembershipTierSchema>;
export type MembershipTier = typeof membershipTiers.$inferSelect;

// Client Memberships
export const insertClientMembershipSchema = createInsertSchema(clientMemberships).omit({ id: true, createdAt: true });
export type InsertClientMembership = z.infer<typeof insertClientMembershipSchema>;
export type ClientMembership = typeof clientMemberships.$inferSelect;

// Virtual Queue
export const insertVirtualQueueSchema = createInsertSchema(virtualQueue).omit({ id: true, joinedAt: true });
export type InsertVirtualQueue = z.infer<typeof insertVirtualQueueSchema>;
export type VirtualQueue = typeof virtualQueue.$inferSelect;

// Style Consultations
export const insertStyleConsultationSchema = createInsertSchema(styleConsultations).omit({ id: true, createdAt: true });
export type InsertStyleConsultation = z.infer<typeof insertStyleConsultationSchema>;
export type StyleConsultation = typeof styleConsultations.$inferSelect;

// Products
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// Product Orders
export const insertProductOrderSchema = createInsertSchema(productOrders).omit({ id: true, createdAt: true, shippedAt: true, deliveredAt: true });
export type InsertProductOrder = z.infer<typeof insertProductOrderSchema>;
export type ProductOrder = typeof productOrders.$inferSelect;

// Product Order Items
export const insertProductOrderItemSchema = createInsertSchema(productOrderItems).omit({ id: true });
export type InsertProductOrderItem = z.infer<typeof insertProductOrderItemSchema>;
export type ProductOrderItem = typeof productOrderItems.$inferSelect;

// Locations
export const insertLocationSchema = createInsertSchema(locations).omit({ id: true, createdAt: true });
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locations.$inferSelect;

// Barber Locations
export const insertBarberLocationSchema = createInsertSchema(barberLocations).omit({ id: true });
export type InsertBarberLocation = z.infer<typeof insertBarberLocationSchema>;
export type BarberLocation = typeof barberLocations.$inferSelect;

// Gallery Photos
export const insertGalleryPhotoSchema = createInsertSchema(galleryPhotos).omit({ id: true, createdAt: true });
export type InsertGalleryPhoto = z.infer<typeof insertGalleryPhotoSchema>;
export type GalleryPhoto = typeof galleryPhotos.$inferSelect;

// Gallery Likes
export const insertGalleryLikeSchema = createInsertSchema(galleryLikes).omit({ id: true, createdAt: true });
export type InsertGalleryLike = z.infer<typeof insertGalleryLikeSchema>;
export type GalleryLike = typeof galleryLikes.$inferSelect;

// Achievements
export const insertAchievementSchema = createInsertSchema(achievements).omit({ id: true, createdAt: true });
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type Achievement = typeof achievements.$inferSelect;

// Client Achievements
export const insertClientAchievementSchema = createInsertSchema(clientAchievements).omit({ id: true, unlockedAt: true });
export type InsertClientAchievement = z.infer<typeof insertClientAchievementSchema>;
export type ClientAchievement = typeof clientAchievements.$inferSelect;

// Wait List
export const insertWaitListSchema = createInsertSchema(waitList).omit({ id: true, createdAt: true });
export type InsertWaitList = z.infer<typeof insertWaitListSchema>;
export type WaitList = typeof waitList.$inferSelect;
