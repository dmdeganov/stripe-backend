const express = require("express");
const app = express();
var cors = require("cors");
const bodyParser = require('body-parser');
require('dotenv').config();

const PORT = process.env.PORT || 3001;

const stripe = require("stripe")("sk_test_51NIFEMGrObk6yhznZxX7tNyXzuZEJd8vhrgTox7CUFx5CgiYoGCdnYTwujqQgMjxHlvm9jW7acUz090Y518Hx4cP00ZgTIHkzl"); // <-- change the key here
app.use(cors());
app.use(express.static("public"));


app.post(
  '/webhook',
  bodyParser.raw({ type: 'application/json' }),
  async (req, res) => {
    // Retrieve the event by verifying the signature using the raw body and secret.
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers['stripe-signature'],
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log(err);
      console.log(
        `⚠️  Check the env file and enter the correct webhook secret.`
      );
      return res.sendStatus(400);
    }
    // Extract the object from the event.
    const dataObject = event.data.object;
    console.log(event.type)
    // Handle the event
    // Review important events for Billing webhooks
    // https://stripe.com/docs/billing/webhooks
    // Remove comment to see the various objects sent for this sample
    switch (event.type) {
      case 'invoice.paid':
        // Used to provision services after the trial has ended.
        // The status of the invoice will show up as paid. Store the status in your
        // database to reference when a user accesses your service to avoid hitting rate limits.
        break;
      case 'invoice.payment_failed':
        // If the payment fails or the customer does not have a valid payment method,
        //  an invoice.payment_failed event is sent, the subscription becomes past_due.
        // Use this webhook to notify your user that their payment has
        // failed and to retrieve new card details.
        break;
      case 'customer.subscription.deleted':
        if (event.request != null) {
          // handle a subscription canceled by your request
          // from above.
        } else {
          // handle subscription canceled automatically based
          // upon your subscription settings.
        }
        break;
      default:
      // Unexpected event type
    }
    res.sendStatus(200);
  }
);



app.use(express.json());

(async()=>{
  const subscriptions = await stripe.subscriptions.list({
    customer: 'cus_OQNJeeCvUTYlna',
  });
 const idOfSubscriptionToUpdate = subscriptions.data[0].id;
 const subscriptionItem = subscriptions.data[0].items.data[0].id


  const subscription = await stripe.subscriptions.update(
    idOfSubscriptionToUpdate,
    {
      proration_behavior: 'always_invoice',
      items: [
        {
          deleted: true,
          id: subscriptionItem,
        },
        {
          price: 'price_1NdWJAGrObk6yhznOhz82scs',
        },
      ],
    }
  );

})();



// Create a Payment Intent (returns the client with a temporary secret)
app.post("/create-customer", async (req, res) => {
  // const { price } = req.body;
  const customer = await stripe.customers.create({
    name: `Client-${Math.floor(new Date().getTime()/1000)}`
  })

  res.send({
    customerId: customer.id,
  });
});

app.post('/create-subscription', async (req, res) => {
  const customerId = req.body.customerId;
  const priceId = 'price_1NIo1WGrObk6yhznZL7LkQaL';

  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{
        price: priceId,
      }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });
    console.log(subscription.id)
    res.send({
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret,
    });
  } catch (error) {
    return res.status(400).send({ error: { message: error.message } });
  }
});



app.listen(PORT, () => {
  console.log(`app is listening on port ~${PORT}`);
});
