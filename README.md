# Restaurant Management System

A starter static web page for a Restaurant Management System.

## Features

- Sales catalog layout for web app menu items
- Category filtering for item selection
- Role-based authentication for Manager and Cashier
- Glassmorphic login page with inline password visibility toggle
- Manager and Cashier dashboard scaffolds

## Usage

1. Install dependencies:
   - `npm install`
2. Create a MySQL database and use `schema.sql` to create the tables and seed manager/cashier accounts.
3. Update `.env` with your MySQL credentials and `JWT_SECRET`.
4. Start the server:
   - `npm run dev` or `npm start`
5. Open `login.html` in your browser.

### Credentials

- Manager: `manager1` / `password123`
- Cashier: `cashier1` / `password123`

## Next steps

- Add real cashier dashboard features and order workflow
- Secure the login page for hosted deployments
- Connect the menu page to live product and order APIs
