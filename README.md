# SplitSettle

SplitSettle is a full-stack bill-splitting and expense-sharing web application built with **React (Vite)** on the frontend and **Node.js + Express + MySQL** on the backend.

---

## 🏗️ Architecture & Tech Stack

- **Frontend:** React 19 (JSX), CSS3, JavaScript ES6+, Vite, npm (runs on `http://localhost:8080`)
- **Backend:** Node.js, Express.js in `/server` folder (runs on `http://localhost:5000`)
- **Database:** MySQL 8+ connected via `mysql2` connection pool
- **Authentication:** JWT (JSON Web Tokens) + `bcryptjs` password hashing
- **Security:** `helmet()`, `cors()` restricted to `http://localhost:8080`, `express-rate-limit` (with stricter limits on auth endpoints), parameterized SQL queries to prevent SQL injection, and `dotenv` for environment variable configuration.

---

## 📁 Project Structure

```text
splitsettle/
├── public/                     # Static assets (favicons, icons)
├── src/                        # React frontend
│   ├── api/
│   │   └── client.js           # API client with automatic JWT Bearer header attachment
│   ├── components/
│   │   └── Toast.jsx           # Toast notification system
│   ├── App.css                 # Responsive stylesheet matching SaaS theme
│   ├── App.jsx                 # Main React App (Auth, Groups, Expenses, Balances, Modals)
│   ├── index.css
│   └── main.jsx
├── server/                     # Backend API server
│   ├── config/
│   │   └── db.js               # mysql2 connection pool
│   ├── controllers/
│   │   ├── authController.js   # register, login, getMe
│   │   ├── groupController.js  # createGroup, getGroups, getGroupById, addMember
│   │   ├── expenseController.js# createExpense, getExpenses, updateExpense, deleteExpense
│   │   └── settlementController.js # getBalances, settleUp
│   ├── middleware/
│   │   └── auth.js             # JWT verification middleware
│   ├── routes/
│   │   ├── auth.js             # /api/auth
│   │   ├── groups.js           # /api/groups
│   │   ├── expenses.js         # /api/expenses
│   │   └── settlements.js      # /api/settlements
│   ├── schema.sql              # All MySQL CREATE TABLE definitions with constraints
│   ├── server.js               # Express application entrypoint
│   ├── .env.example            # Environment variables example for server
│   └── package.json            # Server package with "dev": "nodemon server.js"
├── .env.example                # Frontend environment variables example (VITE_API_URL)
├── .gitignore                  # Git ignore rules for node_modules, .env, etc.
├── index.html                  # HTML entrypoint
├── package.json                # Frontend package configuration
├── vite.config.js              # Vite configuration (port 8080)
└── README.md
```

---

## 🚀 Running Locally (PowerShell-Friendly Steps)

### 1. Database Setup
Ensure MySQL is running on your machine. Open MySQL Workbench or your MySQL terminal and execute the `server/schema.sql` script:

```powershell
mysql -u root -p < server/schema.sql
```

*(Or open `server/schema.sql` inside MySQL Workbench and click Execute).*

### 2. Configure & Start Backend Server

```powershell
cd server
Copy-Item .env.example .env
# Open .env and adjust DB_USER, DB_PASSWORD, and JWT_SECRET if needed
npm install
npm run dev
```
The backend API will start on **http://localhost:5000**.

### 3. Configure & Start Frontend Client

In the project root (open a new PowerShell tab or terminal):

```powershell
cd ..
Copy-Item .env.example .env
npm install
npm run dev
```

### 4. Open Application
Navigate to **http://localhost:8080** in your browser.

---

## 💡 Key Features & Logic

1. **Authentication:**
   - Sign up with name, email, password (hashed with `bcryptjs`).
   - Sign in returns a signed JWT stored in `localStorage`.
   - Protected views redirect unauthenticated users to the login/register screen.
2. **Groups & Members:**
   - Logged-in users can create groups (name, description, currency).
   - Add members to a group by their registered email address.
   - User dashboard lists all groups the member belongs to.
   - Group detail page shows members, expenses, and real-time balances.
3. **Expenses:**
   - Any member of a group can record an expense: title, amount, category, payer, date.
   - **Equal Split Logic:** The expense is automatically split equally among all current group members.
   - **Exact Rounding Protection:** Stored as integer paise / decimals with remainder distribution, guaranteeing split shares always sum exactly to the expense total.
   - **Creator Control:** Only the creator of an expense can edit or delete it.
4. **Balances & Settlements:**
   - **Per-Member Balances:** Displays Total Paid, Total Owed, and Net Balance for each member.
   - **Simplified "Settle Up" Summary:** Calculates the minimum number of transactions to balance all debts (e.g. *"Alice owes Bob ₹500.00"*).
   - **Mark as Settled:** 1-click settlement recording that immediately clears outstanding debts.

---

## 📬 Postman-Ready API Endpoints

All protected routes require the header:
```http
Authorization: Bearer <your_jwt_token>
Content-Type: application/json
```

### 1. Authentication

#### Register New User
- **Method:** `POST`
- **URL:** `http://localhost:5000/api/auth/register`
- **Body:**
```json
{
  "name": "Ragul Rajapathy",
  "email": "ragul@example.com",
  "password": "password123"
}
```
- **Response (201 Created):**
```json
{
  "message": "Account registered successfully.",
  "token": "eyJhbGciOiJIUzI1NiIsIn...",
  "user": {
    "id": 1,
    "name": "Ragul Rajapathy",
    "email": "ragul@example.com"
  }
}
```

#### Login User
- **Method:** `POST`
- **URL:** `http://localhost:5000/api/auth/login`
- **Body:**
```json
{
  "email": "ragul@example.com",
  "password": "password123"
}
```
- **Response (200 OK):**
```json
{
  "message": "Login successful.",
  "token": "eyJhbGciOiJIUzI1NiIsIn...",
  "user": {
    "id": 1,
    "name": "Ragul Rajapathy",
    "email": "ragul@example.com"
  }
}
```

#### Get Current User Profile
- **Method:** `GET`
- **URL:** `http://localhost:5000/api/auth/me`
- **Response (200 OK):**
```json
{
  "user": {
    "id": 1,
    "name": "Ragul Rajapathy",
    "email": "ragul@example.com",
    "created_at": "2026-11-03T05:40:00.000Z"
  }
}
```

---

### 2. Groups

#### Create Group
- **Method:** `POST`
- **URL:** `http://localhost:5000/api/groups`
- **Body:**
```json
{
  "name": "Weekend Goa Trip",
  "description": "Cabin & beach expenses",
  "currency": "INR"
}
```
- **Response (201 Created):**
```json
{
  "message": "Group created successfully.",
  "group": {
    "id": 1,
    "name": "Weekend Goa Trip",
    "description": "Cabin & beach expenses",
    "currency": "INR",
    "created_by": 1,
    "role": "owner",
    "member_count": 1
  }
}
```

#### List User's Groups
- **Method:** `GET`
- **URL:** `http://localhost:5000/api/groups`
- **Response (200 OK):**
```json
{
  "groups": [
    {
      "id": 1,
      "name": "Weekend Goa Trip",
      "description": "Cabin & beach expenses",
      "currency": "INR",
      "created_by": 1,
      "role": "owner",
      "member_count": 2
    }
  ]
}
```

#### Get Group Details
- **Method:** `GET`
- **URL:** `http://localhost:5000/api/groups/1`
- **Response (200 OK):**
```json
{
  "group": {
    "id": 1,
    "name": "Weekend Goa Trip",
    "description": "Cabin & beach expenses",
    "currency": "INR",
    "created_by": 1,
    "userRole": "owner"
  },
  "members": [
    { "id": 1, "name": "Ragul", "email": "ragul@example.com", "role": "owner" },
    { "id": 2, "name": "Alex", "email": "alex@example.com", "role": "member" }
  ],
  "expenses": []
}
```

#### Add Member by Email
- **Method:** `POST`
- **URL:** `http://localhost:5000/api/groups/1/members`
- **Body:**
```json
{
  "email": "alex@example.com"
}
```
- **Response (201 Created):**
```json
{
  "message": "Member added successfully.",
  "member": {
    "id": 2,
    "name": "Alex",
    "email": "alex@example.com",
    "role": "member"
  }
}
```

---

### 3. Expenses

#### Create Expense in Group (Equal Split)
- **Method:** `POST`
- **URL:** `http://localhost:5000/api/groups/1/expenses`
- **Body:**
```json
{
  "title": "Dinner at Fisherman's Wharf",
  "description": "Seafood & drinks",
  "amount": 1500.00,
  "category": "Food & Dining",
  "paidBy": 1,
  "expenseDate": "2026-11-03"
}
```
- **Response (201 Created):**
```json
{
  "message": "Expense created successfully.",
  "expense": {
    "id": 1,
    "group_id": 1,
    "paid_by": 1,
    "created_by": 1,
    "title": "Dinner at Fisherman's Wharf",
    "description": "Seafood & drinks",
    "category": "Food & Dining",
    "amount": "1500.00",
    "amount_paise": 150000,
    "expense_date": "2026-11-03",
    "splits": [
      { "userId": 1, "share": "750.00", "sharePaise": 75000 },
      { "userId": 2, "share": "750.00", "sharePaise": 75000 }
    ]
  }
}
```

#### List Group Expenses
- **Method:** `GET`
- **URL:** `http://localhost:5000/api/groups/1/expenses`
- **Response (200 OK):**
```json
{
  "expenses": [
    {
      "id": 1,
      "group_id": 1,
      "paid_by": 1,
      "created_by": 1,
      "title": "Dinner at Fisherman's Wharf",
      "category": "Food & Dining",
      "amount": "1500.00",
      "expense_date": "2026-11-03",
      "payer_name": "Ragul",
      "splits": [
        { "user_id": 1, "name": "Ragul", "share": "750.00" },
        { "user_id": 2, "name": "Alex", "share": "750.00" }
      ]
    }
  ]
}
```

#### Update Expense (Creator Only)
- **Method:** `PUT`
- **URL:** `http://localhost:5000/api/expenses/1`
- **Body:**
```json
{
  "title": "Dinner & Drinks",
  "amount": 1600.00,
  "category": "Food & Dining",
  "paidBy": 1,
  "expenseDate": "2026-11-03"
}
```
- **Response (200 OK):**
```json
{
  "message": "Expense updated successfully.",
  "expense": {
    "id": 1,
    "title": "Dinner & Drinks",
    "amount": "1600.00"
  }
}
```

#### Delete Expense (Creator Only)
- **Method:** `DELETE`
- **URL:** `http://localhost:5000/api/expenses/1`
- **Response (200 OK):**
```json
{
  "message": "Expense deleted successfully."
}
```

---

### 4. Balances & Settle Up

#### Get Group Balances & Settle Up Summary
- **Method:** `GET`
- **URL:** `http://localhost:5000/api/groups/1/balances`
- **Response (200 OK):**
```json
{
  "groupId": 1,
  "balances": [
    {
      "id": 1,
      "name": "Ragul",
      "email": "ragul@example.com",
      "total_paid": "1500.00",
      "total_owed": "750.00",
      "net": "750.00"
    },
    {
      "id": 2,
      "name": "Alex",
      "email": "alex@example.com",
      "total_paid": "0.00",
      "total_owed": "750.00",
      "net": "-750.00"
    }
  ],
  "debts": [
    {
      "fromUserId": 2,
      "fromName": "Alex",
      "toUserId": 1,
      "toName": "Ragul",
      "amount": "750.00",
      "text": "Alex owes Ragul ₹750.00"
    }
  ],
  "settlements": []
}
```

#### Settle Debt
- **Method:** `POST`
- **URL:** `http://localhost:5000/api/groups/1/settle`
- **Body:**
```json
{
  "payeeId": 1,
  "payerId": 2,
  "amount": 750.00,
  "note": "Paid via UPI"
}
```
- **Response (201 Created):**
```json
{
  "message": "Settlement recorded successfully. Debt marked as settled!",
  "settlement": {
    "id": 1,
    "groupId": 1,
    "payerId": 2,
    "payeeId": 1,
    "amount": "750.00",
    "status": "confirmed",
    "note": "Paid via UPI"
  }
}
```
