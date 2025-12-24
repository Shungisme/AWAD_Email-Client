# 📧 Email Kanban Workflow Manager - AI-Powered Email Productivity

## 📹 Demo & Repository

- **Video Demo**: https://drive.google.com/drive/folders/18HjXqy1Oo_eVOO6u1e7L2fgOwF8kW3Q3?usp=drive_link
- **GitHub Repository**: https://github.com/Shungisme/AWAD_G_03-react-authentication/
- **Live Frontend**: https://awad-react-authentication.vercel.app
- **Live Backend**: https://awad-react-authentication.onrender.com

A production-ready email productivity tool with **AI summarization** and **Kanban workflow management**, built with **React**, **TypeScript**, **Gmail API**, **Google Gemini AI**, and **MongoDB**.

![Tech Stack](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Gmail API](https://img.shields.io/badge/Gmail_API-v1-red)
![Google Gemini](https://img.shields.io/badge/Google_Gemini-1.5--flash-green)
![MongoDB](https://img.shields.io/badge/MongoDB-7.0-green)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)

## 🎯 What's New - Kanban Workflow System

This project focuses on **AI-powered productivity features** rather than replicating standard email clients:

### 🆕 Core Features

- ✅ **Advanced Search System** - Dual-mode intelligent search with AI-powered relevance
  - **Fuzzy Search (Fuse.js)**: Typo-tolerant keyword matching across subject, sender, and body
  - **Semantic Search**: Vector embedding-based conceptual search using Google text-embedding-004
  - Auto-complete suggestions from contacts and keywords
  - Exact match prioritization with substring fallback
  - Smart HTML stripping for clean preview text
- ✅ **Kanban Board Interface** - Visual workflow with 4 columns (Inbox, To Do, Done, Snoozed)
  - Drag-and-drop emails between columns with smooth animations
  - Real-time status updates persisted to MongoDB
  - Each column shows email count and scrolls independently
- ✅ **AI Email Summarization** - Google Gemini 1.5-flash generates intelligent summaries
  - On-demand generation via button click (not auto-generated)
  - Ephemeral summaries (not persisted to database)
  - Smart handling of empty or HTML-only email bodies
  - Loading states and error handling
- ✅ **Smart Snooze System** - Intelligent email postponement
  - Drag to Snoozed column = auto-snooze for 1 hour
  - Manual snooze options: 1h, 3h, 1 day, 3 days
  - Auto-expire: Emails automatically return to Inbox when time's up
  - Backend checks expired snoozes every API call
- ✅ **Dual View Modes** - Toggle between Kanban and traditional list view
- ✅ **Real-time Synchronization** - All changes persist to MongoDB immediately
- ✅ **Custom Scrollbars** - Beautiful, smooth scrolling throughout the app
- ✅ **No Page Reloads** - Pure React state management for instant UI updates

### 📋 Traditional Features

- ✅ **OAuth2 Authorization Code Flow** - Secure server-side token exchange
- ✅ **Real Gmail Integration** - Read, send, and manage your Gmail
- ✅ **Automatic Token Refresh** - Seamless user experience
- ✅ **Email Operations** - Star, delete, mark read/unread, compose, reply
- ✅ **Attachment Support** - View and download attachments
- ✅ **Protected Routes** - JWT-based authentication

## 🏗️ Architecture

- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS
- **Backend**: Express.js + TypeScript + Gmail API
- **Database**: MongoDB (Mongoose ODM) for email persistence and user data
- **Search Engine**: Fuse.js (fuzzy search) + Google text-embedding-004 (semantic search)
- **AI Services**:
  - Google Gemini 1.5-flash API (@google/generative-ai) for summarization
  - Google text-embedding-004 for vector embeddings (768 dimensions)
- **Auth**: OAuth2 Authorization Code Flow + JWT
- **Deployment**: Vercel (Frontend) + Render (Backend) + MongoDB Atlas

## 🚀 Quick Start

### Two Ways to Use This App

#### Option 1: Real Gmail Integration (Recommended)

Access your actual Gmail account with full OAuth2 security:

1. **[Follow the complete Gmail setup guide →](GMAIL_INTEGRATION_GUIDE.md)**

   - Set up Google Cloud Project
   - Enable Gmail API
   - Configure OAuth credentials
   - Takes ~10 minutes

2. Sign in with your Gmail account
3. Grant permissions
4. Access your real inbox!

#### Option 2: Demo Mode (Mock Data)

Quick start without Google Cloud setup:

```bash
# Demo credentials
Email: demo@example.com
Password: password123
```

Uses mock email data for testing the UI.

### Prerequisites

- Node.js 18+ and npm
- Git
- Google Cloud Account (for Gmail integration)

### 1. Clone Repository

```bash
cd d:\HK7_2025_2026\AWAD\G_03
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Edit .env and add required credentials:
# - MONGODB_URI (get from MongoDB Atlas)
# - GEMINI_API_KEY (get from Google AI Studio)
# - GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET (for Gmail OAuth)
# - JWT_SECRET & JWT_REFRESH_SECRET

# Start backend server
npm run dev
```

Backend runs on: `http://localhost:5000`

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Start frontend development server
npm run dev
```

Frontend runs on: `http://localhost:5173`

### 4. Login

Open `http://localhost:5173` and either:

- **Click "Sign in with Gmail"** (requires Google Cloud setup)

## 🔐 Authentication Flow

### Login Process

1. User enters credentials → Frontend sends to backend
2. Backend verifies password → Generates JWT tokens
3. Access token stored in-memory, refresh token in localStorage
4. Redirect to dashboard

### Token Refresh Flow

1. API request with expired token → Backend returns 401
2. Frontend checks refresh queue (concurrency lock)
3. Single refresh request → Backend returns new access token
4. Update token in-memory → Retry all queued requests

### Google OAuth Flow

1. Click "Sign in with Google" → Google consent screen
2. User grants permission → Google returns credential
3. Frontend sends to backend → Backend verifies with Google
4. Backend generates app tokens → Redirect to dashboard

## 🛡️ Security Design

### Token Management

| Token Type        | Storage              | Lifetime   | Purpose                  | Security                                   |
| ----------------- | -------------------- | ---------- | ------------------------ | ------------------------------------------ |
| **Access Token**  | Memory (React state) | 15 minutes | API authentication       | XSS protected (not in localStorage)        |
| **Refresh Token** | localStorage         | 7 days     | Obtain new access tokens | HttpOnly cookie recommended for production |

### Why This Approach?

#### ✅ Access Token in Memory

- **Protection**: Not accessible via JavaScript injection (XSS)
- **Trade-off**: Lost on page refresh, but immediately recovered
- **Best Practice**: Recommended by OAuth 2.0 security guidelines

#### ✅ Refresh Token in localStorage

- **Convenience**: Persists across sessions
- **Recovery**: Automatically obtains new access token
- **Risk Mitigation**: Short access token lifetime limits exposure
- **Production**: Should use HttpOnly cookies (see stretch goals)

### Concurrency Lock Pattern

**Implementation**: `frontend/src/api/axios.ts` uses `isRefreshing` flag and `failedQueue` to ensure:

- ✅ Only ONE refresh request for multiple concurrent 401 errors
- ✅ All failed requests queued and retried with new token
- ✅ Prevents token exhaustion and multiple auth prompts

## 📊 API Reference

### Backend Endpoints

#### Authentication

```typescript
POST / api / auth / login; // Email/password login
POST / api / auth / google; // Google OAuth login
POST / api / auth / refresh; // Refresh access token
```

#### Mailboxes

```typescript
GET    /api/mailboxes       // Get all mailboxes
GET    /api/mailboxes/:id/emails  // Get emails in mailbox
```

#### Emails

```typescript
GET    /api/emails/:id              // Get email details
PATCH  /api/emails/:id              // Update email (read, star, status)
DELETE /api/emails/:id              // Delete email
GET    /api/emails/by-status/:status // Get emails by workflow status (Kanban)
POST   /api/emails/:id/summarize    // Generate AI summary (ephemeral)
POST   /api/emails/:id/snooze       // Snooze email with timestamp
```

#### Search

```typescript
GET    /api/search?q=query          // Fuzzy search with typo tolerance
POST   /api/search/semantic         // Semantic search via embeddings
       Body: { query: string, limit?: number }
GET    /api/search/suggestions?q=query // Auto-complete suggestions
```

### Frontend API Client

```typescript
// Automatic token injection
import apiClient from "./api/axios";

// All requests include: Authorization: Bearer <token>
const emails = await apiClient.get("/mailboxes/inbox-1/emails");

// 401 errors trigger automatic refresh
// Original request retries with new token
```

## 🔍 Search System

### Dual-Mode Search Architecture

#### 1. Fuzzy Search (Fuse.js)

**Best for**: Keyword matching with typo tolerance

- **Algorithm**: Bitap algorithm with configurable threshold (0.3)
- **Searchable fields**: Subject (weight: 3), From name/email (weight: 2), Body (weight: 1)
- **Features**:
  - Typo tolerance (e.g., "outliar" finds "Outlier")
  - Partial matching (e.g., "pass" finds "password")
  - Exact match prioritization (bonus scoring)
  - Fallback to substring search if no fuzzy results
- **Performance**: O(n) where n = total emails in MongoDB

**Implementation**: `backend/src/routes/emails.ts` - GET `/api/search`

#### 2. Semantic Search (Vector Embeddings)

**Best for**: Conceptual/meaning-based search

- **Model**: Google text-embedding-004 (768 dimensions)
- **Storage**: MongoDB with vector fields (embedding, embeddingModel, embeddingDim)
- **Similarity**: Cosine similarity with threshold > 0.2
- **Features**:
  - Finds emails by meaning, not just keywords
  - Example: "urgent" finds "immediate action required", "ASAP"
  - Model-specific filtering prevents dimension mismatches
  - Embeddings generated on email sync, cached in DB
- **Performance**: O(n × 768) similarity computation

**Implementation**: `backend/src/services/embeddingService.ts` + POST `/api/search/semantic`

### Search Flow Diagram

```
User Types Query
       ↓
   ┌───────────┐
   │ Frontend  │
   │ SearchBar │
   └─────┬─────┘
         │
    ┌────┴────┐
    │ Fuzzy   │  Semantic
    ↓         ↓
┌───────┐  ┌──────────┐
│Fuse.js│  │Embedding │
│ Match │  │Similarity│
└───┬───┘  └────┬─────┘
    │           │
    └─────┬─────┘
          ↓
    ┌──────────┐
    │ MongoDB  │
    │  Filter  │
    └─────┬────┘
          ↓
      Results
```

## 🎨 UI Components

### 3-Column Dashboard Layout

```
┌────────────────────────────────────────────────────┐
│  Header: Logo, User Info, Sign Out                │
├───────────┬────────────────────┬───────────────────┤
│           │                    │                   │
│ Mailboxes │    Email List      │   Email Detail    │
│  (~20%)   │     (~40%)         │      (~40%)       │
│           │                    │                   │
│ • Inbox   │ ┌────────────────┐ │ Subject          │
│ • Starred │ │ Search         │ │ From: ...        │
│ • Sent    │ │ [    ][Refresh]│ │ To: ...          │
│ • Drafts  │ └────────────────┘ │                  │
│ • Archive │                    │ Email Body...    │
│ • Trash   │ ☐ ⭐ From         │                  │
│           │    Subject...      │ Attachments      │
│   [3]     │    Preview...      │ [Reply] [Delete] │
│           │    2h ago          │                  │
└───────────┴────────────────────┴───────────────────┘
```

## 🌐 Deployed Public URLs

- **Frontend**: https://awad-react-authentication.vercel.app
- **Backend**: https://awad-react-authentication.onrender.com
- **Demo Account**: `demo@example.com` / `demo123`

## 🔐 Google OAuth Setup Guide

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Select a project"** → **"New Project"**
3. Enter project name: `Email Dashboard App`
4. Click **"Create"**

### Step 2: Enable Gmail API (if using Gmail integration)

1. In the left sidebar, go to **"APIs & Services"** → **"Library"**
2. Search for **"Gmail API"**
3. Click **"Enable"**

### Step 3: Configure OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Select **"External"** user type
3. Fill in required fields:
   - **App name**: Email Dashboard
   - **User support email**: your-email@gmail.com
   - **Developer contact**: your-email@gmail.com
4. Click **"Save and Continue"**
5. **Scopes** (optional for now, add if using Gmail API):
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.send`
6. **Test users**: Add your Gmail address
7. Click **"Save and Continue"**

### Step 4: Create OAuth 2.0 Client ID

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** → **"OAuth 2.0 Client IDs"**
3. Select **"Web application"**
4. Configure:
   - **Name**: `Email Dashboard OAuth Client`
   - **Authorized JavaScript origins**:
     ```
     http://localhost:5173
     https://awad-react-authentication.vercel.app
     ```
   - **Authorized redirect URIs**:
     ```
     http://localhost:5173
     http://localhost:5000/api/auth/google/callback
     https://awad-react-authentication.vercel.app
     https://awad-react-authentication.onrender.com/api/auth/google/callback
     ```
5. Click **"Create"**
6. **Copy** the `Client ID` and `Client Secret`

### Step 5: Update Environment Variables

**Backend `.env`:**

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
```

**Frontend `.env`:**

```env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

### Step 6: Restart Servers

```bash
# Backend
cd backend
npm run dev

# Frontend (new terminal)
cd frontend
npm run dev
```

### Important Notes

- **Production**: Update redirect URIs to use production URLs
- **Security**: Never commit `.env` files to Git
- **OAuth Consent**: For production, submit for Google verification
- **Scopes**: Request minimal scopes needed for your app

## 🔒 Token Storage & Security Considerations

### Access Token: In-Memory Storage

- ✅ **XSS Protection**: Not in localStorage/sessionStorage
- ✅ **OAuth 2.0 Best Practice**: Industry standard
- ✅ **Short Lifetime**: 15 minutes limits exposure
- Implementation: `frontend/src/api/axios.ts`

### Refresh Token: localStorage (Dev) → HttpOnly Cookie (Prod)

**Current (Development)**:

- Location: `localStorage.setItem('refreshToken', token)`
- ✅ Persistence across sessions
- ⚠️ XSS vulnerability

**Production Recommendation**:

- HttpOnly Secure Cookie with `SameSite=Strict`
- ✅ XSS protection
- ✅ CSRF protection
- See code in `backend/src/routes/auth.ts` (commented)

### Comparison Table

| Storage Method      | XSS Risk | CSRF Risk   | Persistence | Complexity |
| ------------------- | -------- | ----------- | ----------- | ---------- |
| **In-Memory**       | ✅ Low   | ✅ N/A      | ❌ No       | ✅ Simple  |
| **localStorage**    | ❌ High  | ✅ N/A      | ✅ Yes      | ✅ Simple  |
| **HttpOnly Cookie** | ✅ Low   | ⚠️ Medium\* | ✅ Yes      | ⚠️ Medium  |
| **SessionStorage**  | ❌ High  | ✅ N/A      | ⚠️ Tab-only | ✅ Simple  |

\*Mitigated with `SameSite` attribute

### Security Measures Implemented

1. **Short-Lived Access Tokens**: 15 minutes → limits exposure if leaked
2. **Refresh Token Rotation**: Each refresh generates new tokens (optional)
3. **Token Revocation**: Logout clears refresh token from server store
4. **HTTPS Only**: Production enforces SSL/TLS
5. **CORS Configuration**: Restricted origins
6. **Input Validation**: Client and server-side
7. **Password Hashing**: bcrypt with salt rounds
8. **Rate Limiting**: Prevent brute-force attacks (recommended for production)

### Justification for Current Approach

For this **academic project**, we use:

- Access token: **In-memory** (secure, industry standard)
- Refresh token: **localStorage** (convenient for development/demo)

For **production deployment**, migrate to:

- Access token: **In-memory** (unchanged)
- Refresh token: **HttpOnly Secure Cookie** with `SameSite=Strict`

This balances **security**, **usability**, and **implementation complexity** for learning objectives.

## 🧪 Simulating Token Expiry for Demo

### Method 1: Shorten Token Lifetime (Recommended for Testing)

**Backend `.env`:**

```env
ACCESS_TOKEN_EXPIRY=1m   # 1 minute instead of 15m
REFRESH_TOKEN_EXPIRY=5m  # 5 minutes instead of 7d
```

**Test Steps**:

1. Login to app
2. Wait 1 minute (access token expires)
3. Click any email or mailbox → Backend returns 401
4. Frontend automatically refreshes → User sees no interruption
5. Wait 5 minutes (refresh token expires)
6. Click any action → Forced logout

### Method 2: Manual Token Manipulation (Browser DevTools)

**Access Token Expiry**:

```javascript
// In browser console
// Delete access token from memory (simulates expiry)
// Then make any API call - should trigger refresh

// Open DevTools → Console
localStorage.getItem("refreshToken"); // Verify exists
// Make an API call - frontend will auto-refresh
```

**Refresh Token Expiry**:

```javascript
// In browser console
localStorage.removeItem("refreshToken");
// Next API call will fail and force logout
```

### Method 3: Backend Debug Endpoint (Development Only)

**Add to `backend/src/routes/auth.ts`:**

```typescript
// REMOVE IN PRODUCTION
router.post("/debug/expire-token", (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  // Remove from store to simulate expiry
  refreshTokenStore.delete(refreshToken);

  res.json({ message: "Refresh token expired" });
});
```

**Frontend test**:

```bash
curl -X POST http://localhost:5000/api/auth/debug/expire-token \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$(localStorage.getItem('refreshToken'))\"}"
```

### Method 4: Modify JWT Expiry Time Manually

**Create expired token for testing**:

```typescript
// backend/src/routes/auth.ts
const testExpiredToken = jwt.sign(
  { userId, email },
  SECRET,
  { expiresIn: "-1m" } // Already expired
);
```

### Demo Video Steps

1. **Show Normal Flow**:

   - Login
   - Browse emails
   - Check localStorage for refresh token

2. **Simulate Access Token Expiry**:

   - Wait 1 minute (with `ACCESS_TOKEN_EXPIRY=1m`)
   - Open email → Show network tab: 401 → automatic refresh → 200 OK
   - User sees no interruption

3. **Simulate Refresh Token Expiry**:

   - Clear `localStorage.removeItem('refreshToken')`
   - Click any action
   - Show: Forced logout, redirected to `/login`
   - Show: Tokens cleared from storage

4. **Re-login**:
   - Login again

## 🚀 Deployment

### Backend (Render/Railway)

```bash
Build: cd backend && npm install && npm run build
Start: cd backend && npm start
```

**Environment Variables**: JWT_SECRET, JWT_REFRESH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GEMINI_API_KEY, MONGODB_URI, NODE_ENV, FRONTEND_URL

### Frontend (Vercel/Netlify)

```bash
Build: cd frontend && npm install && npm run build
Publish: frontend/dist
```

**Environment Variables**: VITE_API_URL, VITE_GOOGLE_CLIENT_ID

## 🔧 Troubleshooting

- **Port in use**: `lsof -i :5000` or use different PORT
- **CORS errors**: Check FRONTEND_URL in backend .env
- **Google OAuth fails**: Verify Client ID and authorized origins
- **Token refresh fails**: Check JWT secrets match in .env

## 📚 Tech Stack Justification

### Why React?

- ✅ Component reusability
- ✅ Large ecosystem
- ✅ Virtual DOM performance
- ✅ Excellent TypeScript support

### Why Vite?

- ✅ 10-100x faster than Create React App
- ✅ Hot Module Replacement (HMR)
- ✅ Optimized production builds
- ✅ Modern development experience

### Why Tailwind CSS?

- ✅ Rapid UI development
- ✅ Consistent design system
- ✅ Small bundle size (purges unused CSS)
- ✅ Mobile-first responsive design

### Why Context API (not Redux)?

- ✅ Built into React (no extra dependencies)
- ✅ Simpler for this scale
- ✅ Less boilerplate
- ✅ Sufficient for authentication state

### Why Axios (not Fetch)?

- ✅ Interceptor support (crucial for token refresh)
- ✅ Request/response transformation
- ✅ Better error handling
- ✅ Automatic JSON parsing

## 🤝 Contributing

This is an academic project. For improvements:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - feel free to use for learning purposes.

## 🙏 Acknowledgments

- React team for excellent documentation
- Vite for blazing-fast tooling
- Tailwind CSS for utility-first approach
- OAuth 2.0 security best practices

## 📧 Contact

For questions or issues, please create an issue in the repository.

---

**Built with ❤️ for Advanced Web Application Development course**

**Production-Ready • Type-Safe • Secure • Modern**
