NEXORA MARKETPLACE — A TO Z SETUP

1) REQUIREMENTS
- Node.js 18+ installed
- A hosting service that can run a Node/Express app
- For production: set SESSION_SECRET to a long random value.

2) LOCAL RUN
Open terminal in this project folder:
  npm install
  npm start

Then open:
  http://localhost:3000

3) DEMO ACCOUNTS
Admin:
  admin@nexora.local
  Admin123!

Agency:
  agency@nexora.local
  Agency123!

Seller:
  seller@nexora.local
  Seller123!

Change/remove these before production.

4) WHAT IS INCLUDED
- Responsive premium marketplace UI
- Registration/login/logout
- User, seller, agency and admin roles
- Listing creation with up to 3 image uploads
- Listing moderation
- Search and category filtering
- Platform order workflow
- Internal listing chat
- Chat filtering for common links, phone numbers, emails and off-platform contact handles
- Admin/agency dashboard
- JSON file persistence (good for testing/small demos)

5) IMPORTANT PRODUCTION NOTES
This is a starter marketplace, not a guaranteed anti-scam system.
Do NOT collect:
- Gmail/Google/Facebook/TikTok passwords
- OTPs or recovery codes
- payment card CVV
- private authentication tokens

Before real public launch, replace JSON storage with a real database, use HTTPS, a persistent session store, object storage for images, rate limiting, CSRF protection, validation, backups, moderation logs, proper payment/escrow integration, and a real domain.

6) HOSTING
Any Node.js hosting that supports:
  npm install
  npm start
can run this project.

Typical deployment:
- Upload/push the whole project
- Set build/install command: npm install
- Set start command: npm start
- Set environment variable:
    SESSION_SECRET = a-long-random-secret
- Use the platform's public URL.

Note: This project writes data to data/db.json and uploads to public/uploads.
Many serverless/free hosts have ephemeral filesystems. For production, use a database and cloud object storage instead.

7) SECURITY
The internal chat blocks several common off-platform contact formats, but filters can never be perfect. Keep admin moderation and transaction records.

8) CUSTOMIZATION
Edit:
  public/index.html
  public/css/style.css
  public/js/app.js
  server.js

The server uses PORT from the hosting provider or defaults to 3000.
