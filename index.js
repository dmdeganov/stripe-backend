const express = require("express");
const app = express();
var cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const PORT = process.env.PORT || 5000;

const weekPriceId = "price_1OJyCjFjVxX7cuN3eot7xg2e"; // можно достать из дошборда руками, можно запросить по апи https://stripe.com/docs/api/products/list
const monthPriceId = "price_1OJyD2FjVxX7cuN3U2Xi81Hn";

const stripe = require("stripe")(
  "sk_test_51KpuJFFjVxX7cuN3DnctPbGQUaePoq0i5aGQtgmZCMyajXe8YU88zdhdxu58wMYzu5Gd5sv3ohocFLRZJPgGuV3F00j3YchjkY",
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
      console.log(event);
      const customerId = event.data.object.customer;
      const paymentMethodId = event.data.object.payment_method;
      console.log(customerId, paymentMethodId);

      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
      const updatedCustomer = await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
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

app.post("/customer_and_intent", async (req, res) => {
  const customer = await stripe.customers.create({
    name: req.body.name,
  });
  const setupIntent = await stripe.setupIntents.create({
    customer: customer.id,
  });
  res.send({
    customerId: customer.id,
    clientSecret: setupIntent.client_secret,
  });
});

app.post("/buy_subscription", async (req, res) => {
  const customerId = req.body.customerId;
  try {
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
  } catch (err) {
    console.log(err);
    res.send({ error: true });
    return;
  }

  res.send({ success: true });
});

app.get("/", async (req, res) => {
  // const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
  //   customer: "cus_PBw26Gv7cDxKnP",
  // });

  // const invoice = await stripe.invoices.retrieve('in_1ONYLjFjVxX7cuN3YU1yf5Ay');
  //
  // const invoice = await stripe.invoices.update("in_1ONYLjFjVxX7cuN3YU1yf5Ay", {
  //   auto_advance: false,
  // });

  const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
    customer: 'cus_PBwDiSmLGaNNiY',
  });

  res.send(upcomingInvoice);
});

app.get("/cancel-subscription", async (req, res) => {

  const subscription = await stripe.subscriptions.cancel(
    'sub_1ONYLjFjVxX7cuN32RO3co5g'
  );
  res.send(subscription)
});

app.listen(PORT, () => {
  console.log(`app is listening on port ~${PORT}`);
});
