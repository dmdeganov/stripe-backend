const express = require("express");
const app = express();
var cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const PORT = process.env.PORT || 3001;

const weekPriceId = "price_1NIo1WGrObk6yhznZL7LkQaL"; // можно достать из дошборда руками, можно запросить по апи https://stripe.com/docs/api/products/list
const monthPriceId = "price_1NdWJAGrObk6yhznOhz82scs";

const stripe = require("stripe")(
  "sk_test_51NIFEMGrObk6yhznZxX7tNyXzuZEJd8vhrgTox7CUFx5CgiYoGCdnYTwujqQgMjxHlvm9jW7acUz090Y518Hx4cP00ZgTIHkzl",
); // <-- change the key here
app.use(cors());
app.use(express.static("public"));

app.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"],
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      console.log(err);
      console.log(
        `⚠️  Check the env file and enter the correct webhook secret.`,
      );
      return res.sendStatus(400);
    }
    // Extract the object from the event.
    // https://stripe.com/docs/billing/webhooks
        const dataObject = event.data.object;
    console.log(event.type);

    if (event.type === "setup_intent.succeeded") {
      console.log(event)
      const customerId = event.data.object.customer;
      const paymentMethodId = event.data.object.payment_method;
      console.log(customerId, paymentMethodId)

      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
      const updatedCustomer = await stripe.customers.update(customerId,
        {
          invoice_settings: {
            default_payment_method: paymentMethodId
          }
        })
      // const customer = await stripe.customers.retrieve(customerId, {expand: ['invoice_settings.default_payment_method']});
      // console.log(customer);
    }

    res.sendStatus(200);
  },
);

app.use(express.json());

(async () => {})();

//////////////////////////// the way to upgrade subscription manually
// (async()=>{
//   const subscriptions = await stripe.subscriptions.list({
//     customer: 'cus_OQNJeeCvUTYlna',
//   });
//  const idOfSubscriptionToUpdate = subscriptions.data[0].id;
//  const subscriptionItem = subscriptions.data[0].items.data[0].id
//
//
//   const subscription = await stripe.subscriptions.update(
//     idOfSubscriptionToUpdate,
//     {
//       proration_behavior: 'always_invoice',
//       items: [
//         {
//           deleted: true,
//           id: subscriptionItem,
//         },
//         {
//           price: monthPriceId,
//         },
//       ],
//     }
//   );
//
// })();
/////////////////////////////////////////////////////////////////

app.post("/create-customer-and-setup-intent", async (req, res) => {
  const customer = await stripe.customers.create({
    name: req.body.name,
  });
  const setupIntent = await stripe.setupIntents.create({
    customer: customer.id,
  });
  res.send({
    customer_id: customer.id,
    client_secret: setupIntent.client_secret,
  });
});

app.post("/buy-subscription", async (req, res) => {
  const customerId = req.body.customerId;
  console.log({})
  const subscriptionSchedule = await stripe.subscriptionSchedules.create({
    customer: customerId,
    start_date: "now",
    end_behavior: "release",
    expand: ["subscription.latest_invoice.payment_intent"],
    default_settings: {
      collection_method: "charge_automatically",
      // payment_behavior: "default_incomplete",
    },
    phases: [
      {
        items: [
          {
            price: weekPriceId,
            quantity: 1,
          },
        ],
        iterations: 1,
      },
      {
        items: [
          {
            price: monthPriceId,
            quantity: 1,
          },
        ],
      },
    ],
  });
  const latestInvoiceId = subscriptionSchedule.subscription.latest_invoice.id;
  const invoice = await stripe.invoices.pay(latestInvoiceId);
  res.sendStatus(200);

});

app.listen(PORT, () => {
  console.log(`app is listening on port ~${PORT}`);
});
