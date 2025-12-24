/**
 * SmartFlow Systems - BookFlow
 * Stripe Subscription Routes (SaaS Model)
 */

const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Load pricing config
const pricingConfig = require('../../../stripe-products-config.json').bookflow;

/**
 * POST /api/stripe/subscribe
 * Create a Stripe Checkout session for BookFlow subscription
 */
router.post('/subscribe', async (req, res) => {
  try {
    const { tier, userId, email, includeSetup } = req.body;

    if (!tier || !userId || !email) {
      return res.status(400).json({
        error: 'Missing required fields: tier, userId, email'
      });
    }

    // Find the pricing tier
    const pricingTier = pricingConfig.products.find(p => p.tier === tier);
    if (!pricingTier) {
      return res.status(400).json({ error: 'Invalid pricing tier' });
    }

    // Prepare line items
    const lineItems = [
      {
        price: pricingTier.price_id,
        quantity: 1
      }
    ];

    // Add setup fee if requested
    if (includeSetup) {
      const setupProduct = pricingConfig.products.find(p => p.tier === 'setup');
      if (setupProduct) {
        lineItems.push({
          price: setupProduct.price_id,
          quantity: 1
        });
      }
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: lineItems,
      customer_email: email,
      client_reference_id: userId,
      subscription_data: {
        trial_period_days: pricingTier.trial_days || 0,
        metadata: {
          userId: userId,
          tier: tier,
          app: 'bookflow',
          setupIncluded: includeSetup ? 'true' : 'false'
        }
      },
      metadata: {
        userId: userId,
        tier: tier,
        app: 'bookflow',
        setupIncluded: includeSetup ? 'true' : 'false'
      },
      success_url: `${process.env.APP_URL || 'http://localhost:5000'}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:5000'}/pricing?canceled=true`
    });

    res.json({
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      message: error.message
    });
  }
});

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhook events
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await handleCheckoutComplete(session);
        break;
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object;
        await handleSubscriptionCreated(subscription);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        await handlePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

/**
 * POST /api/stripe/add-location
 * Add an additional location to an existing subscription
 */
router.post('/add-location', async (req, res) => {
  try {
    const { subscriptionId, locationName } = req.body;

    if (!subscriptionId || !locationName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Retrieve current subscription
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Find the additional location price (£99/month)
    const additionalLocationPrice = 'price_bookflow_additional_location'; // TODO: Create this price

    // Add subscription item for additional location
    await stripe.subscriptionItems.create({
      subscription: subscriptionId,
      price: additionalLocationPrice,
      quantity: 1,
      metadata: {
        locationName: locationName
      }
    });

    res.json({
      success: true,
      message: 'Additional location added successfully'
    });

  } catch (error) {
    console.error('Add location error:', error);
    res.status(500).json({
      error: 'Failed to add location',
      message: error.message
    });
  }
});

/**
 * GET /api/stripe/customer-portal
 * Create a customer portal session
 */
router.get('/customer-portal', async (req, res) => {
  try {
    const { customerId } = req.query;

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID required' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.APP_URL || 'http://localhost:5000'}/dashboard`
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Customer portal error:', error);
    res.status(500).json({
      error: 'Failed to create customer portal session',
      message: error.message
    });
  }
});

// ============================================================================
// Webhook Event Handlers
// ============================================================================

async function handleCheckoutComplete(session) {
  const userId = session.metadata?.userId || session.client_reference_id;
  const tier = session.metadata?.tier;

  console.log('BookFlow - Checkout completed:', { userId, tier, sessionId: session.id });

  // TODO: Update user record in database
  // - Set subscription status to 'active'
  // - Apply tier limits (staff, locations, etc.)
  // - Send welcome email with setup instructions
  // - Schedule onboarding call if setup fee was included
}

async function handleSubscriptionCreated(subscription) {
  const userId = subscription.metadata?.userId;
  const tier = subscription.metadata?.tier;

  console.log('BookFlow - Subscription created:', { userId, tier, subscriptionId: subscription.id });

  // TODO: Set up BookFlow features based on tier
  // - Configure staff limits
  // - Enable/disable SMS notifications
  // - Set up Google Calendar integration quota
}

async function handleSubscriptionUpdated(subscription) {
  const userId = subscription.metadata?.userId;

  console.log('BookFlow - Subscription updated:', { userId, subscriptionId: subscription.id });

  // TODO: Handle subscription changes
  // - Update tier limits
  // - Handle upgrades/downgrades
  // - Adjust location count
}

async function handleSubscriptionDeleted(subscription) {
  const userId = subscription.metadata?.userId;

  console.log('BookFlow - Subscription deleted:', { userId, subscriptionId: subscription.id });

  // TODO: Handle cancellation
  // - Disable booking widget
  // - Stop calendar sync
  // - Send cancellation confirmation
  // - Export customer data for user
}

async function handlePaymentSucceeded(invoice) {
  console.log('BookFlow - Payment succeeded:', { invoiceId: invoice.id, amount: invoice.amount_paid });

  // TODO: Send receipt, log transaction
}

async function handlePaymentFailed(invoice) {
  console.log('BookFlow - Payment failed:', { invoiceId: invoice.id, attempt: invoice.attempt_count });

  // TODO: Send payment failure notification
  // - Email user to update payment method
  // - If max retries, suspend bookings
}

module.exports = router;
