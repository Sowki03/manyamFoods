# Manyam Foods: setup guide

The website is plain HTML. Customer accounts, products, orders and the admin panel run on **Supabase** (free plan) with **Sign in with Google**.

| Page | Who | What |
|---|---|---|
| `index.html`, `products.html` | Everyone | Products load from the database |
| `cart.html` | Customers | Google sign-in → delivery details → Pay with UPI (QR) or Pay later |
| `orders.html` | Customers | Order history, status timeline, tracking, "Pay now", cancel |
| `admin.html` | Admins only | Orders, payment verification, products & prices, coupons, settings |

`admin.html` is not linked anywhere on the site. Bookmark it. Only emails in the `admins` table can use it; the database blocks everyone else.

---

## 1. Create the Supabase project

1. Go to https://supabase.com/dashboard. Create an organization (Free plan).
2. **New project**. Name: `manyamfoods`. Region: **South Asia (Mumbai)**. Save the database password somewhere safe.
3. Wait about 2 minutes for it to finish.

## 2. Create the database

1. Open `supabase/seed.sql` and replace `REPLACE_WITH_ADMIN_EMAIL@gmail.com` with the Google account(s) that will manage the shop.
2. Supabase → **SQL Editor** → **New query** → paste all of `supabase/schema.sql` → **Run**.
3. New query → paste all of `supabase/seed.sql` → **Run**.
4. Then run each file in `supabase/migrations/` in number order (e.g. `002_…sql`).

## 3. Connect the website

Supabase → **Project Settings → API** (or the **Connect** button). Copy:
- **Project URL** (looks like `https://abcd1234.supabase.co`)
- **anon / public** key

Put them in `js/config.js`. The anon key is designed to be public; the database security rules protect the data.

## 4. Turn on "Sign in with Google"

**a) Google Cloud Console** (https://console.cloud.google.com)
1. Create a project (e.g. "Manyam Foods").
2. **Google Auth Platform → Branding**: app name "Manyam Foods", your support email → Save.
3. **Audience**: User type **External** → then **Publish app** (otherwise only test users can sign in).
4. **Clients → Create client** → Application type **Web application**.
   - Authorized JavaScript origins: your site address(es), e.g. `https://sowki03.github.io` and `http://localhost:5173`
   - Authorized redirect URIs: `https://<your-project-ref>.supabase.co/auth/v1/callback`
     (Supabase shows this exact URL on its Google provider page)
5. Copy the **Client ID** and **Client secret**.

**b) Supabase**
1. **Authentication → Sign In / Providers → Google** → enable → paste Client ID and Client secret → Save.
2. **Authentication → URL Configuration**:
   - Site URL: your live site, e.g. `https://sowki03.github.io/manyamFoods/`
   - Redirect URLs: add `https://sowki03.github.io/manyamFoods/**` and `http://localhost:5173/**`

## 5. Daily use (admin)

1. Open `admin.html` → sign in with your admin Google account.
2. **Payments to verify**: open the order, check your bank/UPI app for the amount + UTR, click **Mark as paid** (this also confirms the order).
3. Move orders through **Confirmed → Packed → Shipped** (add the courier tracking number) **→ Delivered**. Customers see this in My Orders.
4. **Products**: add/edit items, sizes, prices, stock (blank = unlimited), photos, hide/show, home-page picks.
5. **Settings**: UPI ID, WhatsApp number, delivery fee and free-delivery limit.

## Notes

- **Free plan pause:** Supabase pauses free projects after about a week with no activity. Normal shop traffic keeps it awake; if it ever pauses, click **Restore** in the dashboard.
- **Payments are checked by a person.** A UTR typed by a customer is not proof of payment: always confirm the credit in your bank app before shipping.
- **Prices are calculated by the database** at checkout, so changing them in the browser does nothing.
