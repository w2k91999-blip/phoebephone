#!/usr/bin/env node

import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error('Error: STRIPE_SECRET_KEY environment variable is not set.');
  process.exit(1);
}

const stripe = new Stripe(secretKey);

const PLANS = [
  { name: 'Phone Phoebe Basic',        amount: 3900  },
  { name: 'Phone Phoebe Professional', amount: 8900  },
  { name: 'Phone Phoebe Premium',      amount: 18900 },
];

async function main() {
  const links = [];

  for (const plan of PLANS) {
    console.log(`Creating product: ${plan.name}...`);
    const product = await stripe.products.create({ name: plan.name });

    const price = await stripe.prices.create({
      product:    product.id,
      unit_amount: plan.amount,
      currency:   'gbp',
      recurring:  { interval: 'month' },
    });

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      subscription_data: { trial_period_days: 7 },
      after_completion: {
        type:     'redirect',
        redirect: { url: 'https://phonephoebe.co.uk' },
      },
    });

    links.push({ name: plan.name, url: paymentLink.url });
    console.log(`  ✓ ${plan.name}: ${paymentLink.url}`);
  }

  console.log('\n--- Payment Links ---');
  links.forEach(({ name, url }) => console.log(`${name}: ${url}`));
}

main().catch((err) => {
  console.error('Stripe error:', err.message);
  process.exit(1);
});
