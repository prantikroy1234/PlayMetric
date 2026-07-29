# PlayMetric — Every API Call, in Plain English

A companion to the [README](README.md), written for explaining the system out loud. No prior
knowledge assumed.

---

## First — what is an API?

An **API** is how one piece of software asks another piece of software to do something.

> Think of a restaurant. You don't walk into the kitchen and cook. You tell a **waiter** what you
> want, the waiter takes it to the kitchen, and brings food back. The waiter is the API — a
> defined way to ask for things, with rules about what you're allowed to order.

PlayMetric has three "waiters":

| # | The waiter | What it handles |
|---|---|---|
| 1 | **Supabase Auth** | Who you are — signing up, signing in, staying signed in |
| 2 | **Supabase Database** | Everything the product stores — bookings, money, clients… |
| 3 | **Our own 3 endpoints** | Talking to outside booking websites (Hudle, Playo) |

That's it. Everything else is built in-house.

---

## The big picture

```
   You (browser)                          Supabase (the backend)
        │                                        │
        │  "Is this person who they say?"        │
        ├───────────  Auth API  ─────────────────┤
        │                                        │
        │  "Give me this academy's bookings"     │
        ├───────────  Database API  ─────────────┤   ← a guard checks
        │                                        │      every request
        │                                        │
        │  "Any new bookings from Hudle?"        │
        ├──────  Our own API (Express) ──────────┤
```

**The unusual thing about this design:** most apps put a middle server between the browser and
the database. We don't. The browser talks to the database *directly*, and the database itself
decides what each person may see. Less code to write, fewer places for bugs to hide.

---

## API #1 — Supabase Auth (the bouncer)

Handles identity only. Think of a bouncer checking ID at a door.

| What the code calls | In plain English | When it happens |
|---|---|---|
| `signUp()` | "Create an account for this academy." | Someone fills in the sign-up form |
| `signInWithPassword()` | "Here's an email and password — is this correct?" | Someone clicks Sign In |
| `getSession()` | "Is anyone already signed in here?" | Every time the console loads |
| `onAuthStateChange()` | "Tap me on the shoulder if they sign in or out." | Runs constantly in the background |
| `signOut()` | "Forget this person." | Someone clicks Sign Out |

### What actually happens when someone signs up

1. They type their academy name, their name, email and password.
2. `signUp()` sends it to Supabase, which creates the account.
3. **A trap door fires automatically.** We wrote a rule in the database that says: *whenever a
   new account is created with an academy name attached, immediately create that academy, create
   their staff record, and make them its owner.*
4. So they land in a working console instead of an empty one. Nobody sets this up by hand.

That trap door is a **database trigger** — a rule the database runs by itself. It lives in
`supabase/migrations/0003_onboarding.sql`.

### What "staying signed in" means

After signing in, Supabase hands the browser a **pass** (a long string of text). The browser
keeps it and shows it with every future request. The pass expires on its own, and it's stored
per-website — which is why the marketing site and the console **must live on the same web
address**. Sign in on one, and the other already knows you. That's the whole reason the console
sits at `yoursite.com/app` instead of on its own address.

---

## API #2 — Supabase Database (the filing clerk)

This is where 95% of the app's activity happens. Every screen you click uses it.

> Picture a filing clerk in a records room. You ask for a folder; they fetch it. But they have a
> strict rulebook: **they will only hand you folders belonging to your own academy.** Ask for a
> competitor's files and they'll come back empty-handed — not an error, just nothing.

That rulebook is called **Row-Level Security**, and it's the single most important idea in the
system.

### There are only five things you can ask the clerk

| Code | Plain English | Example in the app |
|---|---|---|
| `.select()` | "Show me…" | Loading the bookings calendar |
| `.insert()` | "File this new one." | Creating a booking |
| `.update()` | "Change this one." | Editing a client's phone number |
| `.delete()` | "Throw this away." | Deleting a contract |
| `.upsert()` | "Update it, or create it if it's not there." | Ticking a permission checkbox |

Every single screen in the console is built from those five verbs. Nothing more exotic.

### What's in the filing cabinet — 16 drawers

| Drawer (table) | What's inside |
|---|---|
| `organisations` | The academies themselves — **this is the tenant** |
| `venues` · `courts` · `sports` · `time_slots` | The physical setup: sites, playing surfaces, what's played, when |
| `bookings` | Court reservations |
| `finance_entries` | Money in and money out |
| `clients` | Players, teams, corporate accounts |
| `contracts` | Leases, sponsorships, memberships |
| `reviews` | Customer feedback and star ratings |
| `tickets` | Support and maintenance requests |
| `staff` · `org_members` | Who can log in, and which academy they belong to |
| `roles` · `actions` · `role_permissions` | Who is allowed to open which screens |
| `leads` | "Book a Demo" enquiries from the public website |

### The one clever bit: the app doesn't know where data lives

Every screen says the same thing, regardless of backend:

```js
data.bookings.list()      // "get me the bookings"
data.bookings.create({…}) // "save this booking"
```

Behind that sits a switch. In normal mode it talks to the real Supabase database. In **demo
mode** it talks to the browser's own storage instead — same commands, no internet, no login.

**Why this matters:** you can demo the entire product on a laptop with no setup and nothing to
break. And when we add a new feature, we change one line in one file rather than every screen.

---

## API #3 — Our own API (the delivery door)

Three endpoints, and they exist for **one job**: connecting to outside booking websites like
Hudle, Playo and District, where customers might also book your courts.

There are two ways to move that data, and we built both:

### 🡸 Pulling — "go and check for new bookings"

**`GET /api/mock/partner/bookings`**

Right now this is a **stand-in**. We don't have Hudle's real credentials yet, so we wrote a fake
version that returns realistic made-up bookings. It lets us build and test the entire pipeline
today, and swap in the real address later.

> Like rehearsing a play with a stand-in actor. The staging, timing and lines are all real — only
> the actor changes on opening night.

In the console, **Booking Management → "Sync from partner"** does this:

1. Asks the feed: *"any bookings?"*
2. Gets back 4 bookings with customer names, courts, times and amounts.
3. **Matches the court names to your courts** ("Badminton Court 1" → your actual court).
4. Saves them as normal bookings.
5. Posts the revenue into Financials automatically.

**The important safety feature:** press the button twice and you don't get 8 bookings — you get
the same 4, updated. Each booking carries the partner's own reference number, and we check it
before saving. Real integrations retry constantly, so without this you'd get duplicates all day.

### 🡺 Pushing — "they tell us the moment it happens"

**`POST /api/webhooks/bookings`**

This is a **webhook**: instead of us asking repeatedly, the partner calls *us* the instant
someone books.

> Pulling is checking your postbox every hour. A webhook is the postman ringing your doorbell.

Two protections:

1. **A password in the request.** The caller must include a secret code. Wrong code → rejected
   immediately. Otherwise anyone on the internet could invent bookings.
2. **It runs on our server, not in the browser.** This one needs a *master key* to the database,
   and a master key must never be sent to somebody's browser — anyone could read it. So this is
   the single piece of the system that runs server-side.

Responses in plain terms:

| Reply | Meaning |
|---|---|
| `200` | Saved. |
| `401` | Wrong password — rejected. |
| `400` | You forgot to say which academy. |
| `503` | Our server hasn't been given its database key yet. |

### **`GET /api/integrations/health`**

A "is everything plugged in?" check. Tells you whether the keys are configured — **without ever
showing the keys themselves**, so it's safe to open in a browser.

---

## The two keys (worth understanding)

| Key | Like… | Who may see it |
|---|---|---|
| **anon key** | A **visitor pass** — gets you in the building, but every door still checks your badge | Public. It's in the website's code on purpose. Safe, because the filing clerk's rulebook still applies. |
| **service_role key** | A **master key** — opens everything, ignores all rules | Never leaves our server. Never in the browser, never in GitHub. |

This is why exactly one feature (the webhook) runs on a server: it's the only thing that needs
the master key.

---

## Walk-throughs: what happens when you click

**Creating a booking**
```
Click "New Booking" → fill the form → Save
   └─ .insert() into bookings          "file this reservation"
   └─ .select() finance_entries         "is there already a money record for it?"
   └─ .insert() into finance_entries    "no — record the income"
   └─ reload the calendar
```

**Cancelling that booking**
```
Open it → status "Cancelled" → Save
   └─ .update() the booking             "mark it cancelled"
   └─ .insert() a refund entry          "record money going back out"
```
The income line stays and a refund line is added, so the books show what actually happened
rather than quietly erasing history. Net effect: zero.

**Loading the Dashboard**
```
   └─ .select() bookings
   └─ .select() finance_entries
   └─ .select() venues, courts, sports
   └─ all the totals and charts are calculated in the browser
```
There's no "dashboard" stored anywhere — it's worked out fresh from existing records each time.
Same for Analytics.

---

## What we deliberately do NOT use

Worth saying out loud, because it's a design choice, not an oversight:

- **No charting library.** Every graph is hand-drawn. Keeps the app small and the security policy
  strict.
- **No tracking or analytics SDKs.** Nothing phones home.
- **No payment API** (yet) — amounts are recorded, not charged.
- **No CDNs.** Everything is served from our own server, so an outside outage can't break the site.
- **No custom data API.** Most apps build one; we let the database handle it.

The only outside service the website contacts at all is **Google Fonts**.

---

## Quick reference

| API | Calls | Where it runs | Needs a key? |
|---|---|---|---|
| Supabase Auth | 5 | Browser | Visitor pass |
| Supabase Database | 5 verbs × 16 tables | Browser | Visitor pass |
| Our integration API | 3 endpoints | Our server | Master key (webhook only) |

---

## Likely questions

**"Isn't it dangerous to let the browser talk to the database?"**
It would be, without the rulebook. Every table has rules attached that run inside the database
itself. The browser can *ask* for anything; the database decides what to return. Security lives
in the database, not in the app — so a bug in the app can't leak another academy's data.

**"What if two academies have a booking at the same time?"**
They never see each other. Every record is stamped with its academy, and every request is
filtered by it automatically. There's no code path that returns another academy's rows.

**"Is the Hudle integration real?"**
The *plumbing* is real and tested end-to-end — receiving, mapping, duplicate protection, saving.
The *source* is currently a stand-in, because we don't have Hudle's credentials yet. Swapping it
for the real feed means changing an address and their authentication, not rebuilding anything.

**"What happens if the partner sends the same booking twice?"**
Nothing bad. We match on their reference number and update the existing booking instead of
creating a second one. Tested by sending the same booking repeatedly.

**"Could someone fake a webhook?"**
They'd need the secret code, which isn't published anywhere. Without it the request is rejected
before it touches the database.
