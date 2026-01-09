# Email Dashboard - Backend API

Production-grade Express.js backend with TypeScript, JWT authentication, Google OAuth, and mock email data.

## 🚀 Features

- **JWT Authentication** with access and refresh tokens
- **Google OAuth 2.0** integration
- **Token Refresh** with concurrency protection
- **Mock Email API** with realistic data
- **TypeScript** for type safety
- **Secure** token handling and password hashing

## 📁 Project Structure

```
backend/
├── src/
│   ├── data/
│   │   ├── users.json         # Mock user database
│   │   ├── mailboxes.json     # Mailbox configurations
│   │   └── emails.json        # Email messages
│   ├── middleware/
│   │   └── auth.ts           # JWT verification middleware
│   ├── routes/
│   │   ├── auth.ts           # Authentication endpoints
│   │   ├── mailboxes.ts      # Mailbox endpoints
│   │   └── emails.ts         # Email endpoints
│   ├── utils/
│   │   └── hashPassword.ts   # Password hashing utility
│   └── server.ts             # Main Express server
├── package.json
├── tsconfig.json
└── .env
```

## 🛠️ Installation

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup Steps

1. **Install dependencies:**

   ```bash
   cd backend
   npm install
   ```

2. **Configure environment variables:**

   ```bash
   cp .env.example .env
   ```

3. **Update `.env` file:**

   ```env
   PORT=5000
   JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
   JWT_REFRESH_SECRET=your_super_secret_refresh_key_change_this_in_production
   ACCESS_TOKEN_EXPIRY=15m
   REFRESH_TOKEN_EXPIRY=7d
   GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173
   ```

4. **Generate password hash (optional):**

   ```bash
   npx ts-node src/utils/hashPassword.ts your_password
   ```

5. **Start development server:**

   ```bash
   npm run dev
   ```

6. **Or build and run production:**
   ```bash
   npm run build
   npm start
   ```

## 📚 API Endpoints

### Authentication

#### POST `/api/auth/login`

Email/password login

**Request:**

```json
{
  "email": "demo@example.com",
  "password": "demo123"
}
```

**Response:**

```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-1",
    "email": "demo@example.com",
    "name": "Demo User"
  }
}
```

#### POST `/api/auth/google`

Google OAuth login

**Request:**

```json
{
  "credential": "google_jwt_credential_string"
}
```

**Response:** Same as login

#### POST `/api/auth/refresh`

Refresh access token

**Request:**

```json
{
  "refreshToken": "refresh_token_string"
}
```

**Response:**

```json
{
  "success": true,
  "accessToken": "new_access_token"
}
```

### Mailboxes

#### GET `/api/mailboxes`

Get all mailboxes for authenticated user

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
[
  {
    "id": "mailbox-1",
    "name": "Inbox",
    "userId": "user-1",
    "icon": "inbox",
    "unreadCount": 3
  }
]
```

#### GET `/api/mailboxes/:id/emails`

Get emails in a mailbox

**Response:**

```json
[
  {
    "id": "email-1",
    "mailboxId": "mailbox-1",
    "from": {
      "name": "Sarah Williams",
      "email": "sarah.williams@techcorp.com"
    },
    "to": [...],
    "subject": "Q4 Project Proposal Review",
    "preview": "Hi Demo, I hope this email finds you well...",
    "isRead": false,
    "isStarred": false,
    "timestamp": "2025-11-18T09:30:00.000Z",
    "attachments": [...]
  }
]
```

### Emails

#### GET `/api/emails/:id`

Get full email details

**Response:**

```json
{
  "id": "email-1",
  "mailboxId": "mailbox-1",
  "userId": "user-1",
  "from": {...},
  "to": [...],
  "cc": [...],
  "subject": "Q4 Project Proposal Review",
  "body": "<p>Full HTML email body...</p>",
  "preview": "Preview text...",
  "isRead": false,
  "isStarred": false,
  "timestamp": "2025-11-18T09:30:00.000Z",
  "attachments": [...]
}
```

#### PATCH `/api/emails/:id`

Update email properties

**Request:**

```json
{
  "isRead": true,
  "isStarred": false
}
```

#### DELETE `/api/emails/:id`

Delete an email

**Response:**

```json
{
  "success": true,
  "message": "Email deleted"
}
```

## 🔒 Security Features

### Token Strategy

1. **Access Token (15 minutes)**

   - Short-lived JWT token
   - Stored in memory (frontend)
   - Used for API authentication

2. **Refresh Token (7 days)**

   - Long-lived JWT token
   - Stored in localStorage (frontend)
   - Used to obtain new access tokens

3. **Password Hashing**
   - bcrypt with 10 salt rounds
   - Never stored in plain text

### CORS Configuration

- Configured for frontend URL
- Credentials allowed for cookie support

### JWT Verification

- All protected routes use auth middleware
- Expired tokens return 401 with error code
- Frontend automatically refreshes tokens

## 🧪 Demo Credentials

```
Email: demo@example.com
Password: demo123
```

The password hash in `users.json` corresponds to "demo123".

## 🐛 Development

### Hot Reload

Uses `nodemon` for automatic server restart:

```bash
npm run dev
```

### TypeScript Compilation

```bash
npm run build
```

### Password Hashing

To generate a hash for a new password:

```bash
npx ts-node src/utils/hashPassword.ts your_password
```

## 📦 Dependencies

### Production

- `express` - Web framework
- `cors` - CORS middleware
- `jsonwebtoken` - JWT handling
- `bcryptjs` - Password hashing
- `dotenv` - Environment variables
- `google-auth-library` - Google OAuth verification

### Development

- `typescript` - Type safety
- `@types/*` - TypeScript definitions
- `ts-node` - TypeScript execution
- `nodemon` - Auto-restart

## 🚀 Deployment

### Environment Variables

Set all variables from `.env.example` in your hosting platform.

### Build Command

```bash
npm install && npm run build
```

### Start Command

```bash
npm start
```

### Recommended Platforms

- **Render** - Free tier available
- **Railway** - Easy deployment
- **Heroku** - Reliable hosting
- **DigitalOcean App Platform**

### Production Checklist

- [ ] Change JWT secrets to strong random strings
- [ ] Set up real Google OAuth client ID
- [ ] Use proper database instead of JSON files
- [ ] Enable HTTPS
- [ ] Set up proper logging
- [ ] Implement rate limiting
- [ ] Add request validation
- [ ] Set up monitoring

## 📝 Notes

- This is a **mock API** for demonstration
- In production, replace JSON files with a real database
- Google OAuth currently accepts any credential (mock mode)
- Add proper error handling and logging for production
- Consider implementing refresh token rotation
- Add API rate limiting for security

## 🤝 Support

For issues or questions, please refer to the main project README.
