const express = require("express");
const app = express();
var cors = require("cors");
const PORT = process.env.PORT || 3001;

const stripe = require("stripe")("sk_test_51NIFEMGrObk6yhznZxX7tNyXzuZEJd8vhrgTox7CUFx5CgiYoGCdnYTwujqQgMjxHlvm9jW7acUz090Y518Hx4cP00ZgTIHkzl"); // <-- change the key here

app.use(cors());
app.use(express.static("public"));
app.use(express.json());

// Create a Payment Intent (returns the client with a temporary secret)
app.post("/create-payment-intent", async (req, res) => {
  // const { price } = req.body;
const price = 14;
  const paymentIntent = await stripe.paymentIntents.create({
    amount: price,
    currency: "usd",
    // payment_method_types: ['card', 'paypal'],
    automatic_payment_methods: {
      enabled: true,
    },
  });

  res.send({
    clientSecret: paymentIntent.client_secret,
  });
});

app.listen(PORT, () => {
  console.log(`app is listening on port ~${PORT}`);
});
