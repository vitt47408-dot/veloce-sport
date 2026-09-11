# Veloce Sport product scaffold

## Database model

The PostgreSQL schema in `backend/db/schema.sql` uses these core entities:

```text
users
  ├── carts ── cart_items ── products ── categories
  ├── orders ── order_details ── products
  └── reviews ── products

orders ── vouchers
```

- `users` stores customer, staff, and admin accounts.
- Each user can have one active `cart`; `cart_items` connects products to that cart.
- `orders` belongs to a user and contains immutable `order_details` snapshots of purchased products.
- `products` belongs to a category and can be reviewed by users through `reviews`.
- `vouchers` can be attached to orders and supports percentage, fixed amount, and shipping discounts.

## Runtime flow

```text
Zalo Mini App (index.html)
  -> API Backend (/api/products, /api/orders, /api/ai/chat)
     -> PostgreSQL (products, customers, orders, order_items)
     -> AI Agent (size advice, product search, sales chatbot)
     -> ZaloPay adapter (create payment, callback)
```

## API contract

- `GET /api/health`: health check.
- `GET /api/products?q=giày&category=running`: product catalog with optional search/filter.
- `POST /api/ai/chat`: `{ message, customer: { height, weight } }` -> `{ reply, products, intent }`.
- `POST /api/orders`: `{ customerId, shipping: { name, phone, address }, coupon, paymentMethod, items: [{ productId, quantity, unitPriceVnd, selectedSize }] }` -> pending order.
- `GET /api/orders/:orderId`: returns order status and shipping information.
- `POST /api/payments/zalopay/:orderId`: creates a payment request when credentials are configured.
- `POST /api/ai/chat`: `{ message, customer: { height, weight } }` -> `{ reply, products, intent, provider }` for AI customer care.

## AI customer care

The storefront's `CSKH AI` button uses the backend `/api/ai/chat` endpoint. The API keeps provider credentials on the server and supports:

- `AI_PROVIDER=gemini` with `AI_MODEL=gemini-3.6-flash`.
- `AI_PROVIDER=openai` with `AI_MODEL=gpt-4o-mini` or another compatible chat-completions model.
- `AI_API_URL` for a compatible custom endpoint.

When `AI_API_KEY` is empty or the provider is unavailable, the backend returns a local Vietnamese product and size advisor instead of exposing an error to the customer.

## Run backend

```powershell
cd backend
npm start
```

Set `PORT`, `ZALOPAY_APP_ID`, `ZALOPAY_KEY1`, and `ZALOPAY_KEY2` through environment variables before production use. The current adapter deliberately returns `pending_configuration` until the merchant credentials and official ZaloPay signing flow are added.

The AI endpoint supports Gemini native API and OpenAI-compatible providers, and runs only on the backend. For Gemini set `AI_PROVIDER=gemini`, `AI_MODEL=gemini-2.5-flash`, and `AI_API_KEY`, then restart the API. Never put the key in `app.js` or browser code.
