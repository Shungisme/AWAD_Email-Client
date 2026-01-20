# Project: React Email Client with Gmail Integration & AI-Powered Kanban

## Repository and Video demo
- **GitHub Repository**: https://github.com/AWAD-Email-Client/AWAD-Email-Client
- **Demo Video**: https://youtu.be/XtZQexrnrU4
- **Live Frontend**: https://awad-react-authentication.vercel.app
- **Live Backend**: https://awad-react-authentication.onrender.com

## Installation and Setup Guide

### Prerequisites

- Node.js 18+ and npm
- Git
- Google Cloud Account (for Gmail integration)
- MongoDB Atlas account

### Local Setup

#### 1. Clone Repository

```bash
git clone https://github.com/AWAD-Email-Client/AWAD-Email-Client.git
cd AWAD-React-Email-Client
```

#### 2. Backend Setup

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
# - FRONTEND_URL=http://localhost:5173
# - PORT=5000

# Start backend server
npm run dev
```

Backend runs on: `http://localhost:5000`

#### 3. Frontend Setup

```bash
cd ..
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Edit .env and add:
# - VITE_API_URL=http://localhost:5000
# - VITE_GOOGLE_CLIENT_ID=your-google-client-id

# Start frontend development server
npm run dev
```

Frontend runs on: `http://localhost:5173`

#### 4. Access Application

Open `http://localhost:5173` and either:
- **Click "Sign in with Gmail"** (requires Google Cloud setup - see OAuth Setup Guide below)
- **Use demo account**: Email: `demo@example.com` | Password: `password123`

### Deployment

#### Frontend Deployment (Vercel)

1. Push code to GitHub repository
2. Go to [Vercel Dashboard](https://vercel.com)
3. Click **"New Project"** -> Import your GitHub repository
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add Environment Variables:
   - `VITE_API_URL`: Your backend URL (e.g., `https://your-backend.onrender.com`)
   - `VITE_GOOGLE_CLIENT_ID`: Your Google Client ID
6. Click **"Deploy"**

#### Backend Deployment (Render)

1. Push code to GitHub repository
2. Go to [Render Dashboard](https://render.com)
3. Click **"New"** → **"Web Service"**
4. Connect your GitHub repository
5. Configure:
   - **Name**: email-client-backend
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
6. Add Environment Variables:
   - `MONGODB_URI`: Your MongoDB Atlas connection string
   - `GEMINI_API_KEY`: Your Google Gemini API key
   - `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID
   - `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret
   - `JWT_SECRET`: Random secure string
   - `JWT_REFRESH_SECRET`: Random secure string
   - `FRONTEND_URL`: Your Vercel frontend URL
   - `NODE_ENV`: `production`
7. Click **"Create Web Service"**

#### Database Setup (MongoDB Atlas)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster (free tier available)
3. Configure:
   - **Database User**: Create username/password
   - **Network Access**: Add `0.0.0.0/0` (allow from anywhere)
   - **Connection String**: Copy your connection string
4. Replace `<password>` in connection string with your password
5. Use this as `MONGODB_URI` in backend environment variables

### Google OAuth Setup (Required for Gmail Integration)

#### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Select a project"** → **"New Project"**
3. Enter project name: `Email Dashboard App`
4. Click **"Create"**

#### Step 2: Enable Gmail API

1. In the left sidebar, go to **"APIs & Services"** → **"Library"**
2. Search for **"Gmail API"**
3. Click **"Enable"**

#### Step 3: Configure OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Select **"External"** user type
3. Fill in required fields:
   - **App name**: Email Dashboard
   - **User support email**: your-email@gmail.com
   - **Developer contact**: your-email@gmail.com
4. Click **"Save and Continue"**
5. **Scopes**: Add these scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.send`
6. **Test users**: Add your Gmail address
7. Click **"Save and Continue"**

#### Step 4: Create OAuth 2.0 Client ID

1. Go to **"APIs & Services"** -> **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** -> **"OAuth 2.0 Client IDs"**
3. Select **"Web application"**
4. Configure:
   - **Name**: `Email Dashboard OAuth Client`
   - **Authorized JavaScript origins**:
     ```
     http://localhost:5173
     https://your-app.vercel.app
     ```
   - **Authorized redirect URIs**:
     ```
     http://localhost:5173
     http://localhost:5000/api/auth/google/callback
     https://your-app.vercel.app
     https://your-backend.onrender.com/api/auth/google/callback
     ```
5. Click **"Create"**
6. **Copy** the `Client ID` and `Client Secret`
7. Add these to your environment variables

## PROJECT SUMMARY

### System Overview

**React Email Client with Gmail Integration** is a web-based email client that transforms Gmail into a Kanban-style productivity tool:

- **Authentication**: Gmail OAuth2 authentication with secure token handling
- **Core UI**: Kanban board interface for email workflow management (Inbox, To Do, Done)
- **AI Integration**: AI-powered email summarization using LLM (Google Gemini)
- **Productivity**: Snooze mechanism to temporarily hide and auto-return emails
- **Search**: Fuzzy search with typo tolerance and Semantic search using vector embeddings
- **Customization**: Dynamic Kanban configuration with Gmail label mapping
- **Actions**: Full email actions: compose, reply, forward, delete, attachments

### Technology Stack

- **Architecture**: React SPA + Backend API (Node.js)
- **Frontend**: React 19, react-window (virtualization), drag-and-drop library, TypeScript, Vite, TailwindCSS
- **Backend**: Node.js with Express, TypeScript
- **Database**: MongoDB with vector support for embeddings
- **Authentication**: Google OAuth2 (Authorization Code flow)
- **AI/ML**: Google Gemini API (1.5-flash for summarization), Google text-embedding-004 (for semantic search)
- **Email**: Gmail REST API
- **Search**: Fuse.js (fuzzy search)
- **Deployment**: Frontend (Vercel), Backend (Render), Database (MongoDB Atlas)

### UI Components

- 3-Column Dashboard Layout:

```
┌─────────────────────────────────────────────────────┐
│  Header: Logo, User Info, Sign Out                  │
├───────────┬─────────────────────┬───────────────────┤
│           │                     │                   │
│ Mailboxes │    Email List       │   Email Detail    │
│  (~20%)   │     (~40%)          │      (~40%)       │
│           │                     │                   │
│ • Inbox   │ ┌─────────────────┐ │ Subject           │
│ • Starred │ │[Search][Refresh]│ │ From: ...         │
│ • Sent    │ └─────────────────┘ │ To: ...           │
│ • Drafts  │                     │                   │
│ • Archive │ ☐ ⭐ From          │ Email Body...     │
│ • Trash   │    Subject...       │                   │
│           │    Preview...       │ Attachments       │
│   [3]     │    2h ago           │ [Reply] [Delete]  │
│           │                     │                   │
└───────────┴─────────────────────┴───────────────────┘
```

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/google/callback` | Exchange Google auth code for tokens |
| `POST /api/auth/logout` | Clear all tokens and logout |
| `GET /api/mailboxes` | List Gmail labels/folders |
| `GET /api/mailboxes/:id/emails` | List emails in mailbox with pagination |
| `GET /api/emails/:id` | Get email detail |
| `POST /api/emails/send` | Send new email |
| `POST /api/emails/:id/reply` | Reply to email |
| `POST /api/emails/:id/modify` | Mark read/unread, star, delete |
| `GET /api/attachments/:id` | Stream attachment |
| `POST /api/search/fuzzy` | Fuzzy search emails |
| `POST /api/search/semantic` | Semantic search with embeddings |
| `GET /api/kanban/columns` | Get Kanban column configuration |
| `POST /api/kanban/columns` | Create/update columns |
| `POST /api/emails/:id/snooze` | Snooze email |

### Key User Flows

1. **Authentication**: Google Sign-In → Backend token exchange → Session created → Redirect to Kanban
2. **Email Sync**: Login → Fetch Gmail inbox → Display as Kanban cards → Real-time updates
3. **Kanban Workflow**: View cards → Drag to columns → Status synced → Gmail labels updated
4. **AI Summary**: Email synced → LLM summarizes → Summary displayed on card
5. **Semantic Search**: User types query → Embedding generated → Vector search → Related emails returned
6. **Snooze**: Select email → Choose snooze time → Email hidden → Auto-returns at scheduled time

### Development Timeline

| Week | Focus | Key Deliverables |
|------|-------|------------------|
| Week 1 | Basic Application | Gmail OAuth, email sync, Kanban interface with cards |
| Week 2 | Core Workflow & AI | Drag-and-drop, snooze mechanism, AI summarization |
| Week 3 | Fuzzy Search & Filter | Fuzzy search (BE+FE), sorting, filtering on Kanban |
| Week 4 | Semantic & Config | Vector embeddings, semantic search, dynamic Kanban config |
| Week 5 | Deployment | Testing, deployment, demo video |

### Security Considerations

- **Access Token**: Stored in-memory on frontend only
- **Refresh Token**: Stored server-side in secure datastore (never exposed to frontend)
- **OAuth Flow**: Authorization Code flow (not implicit)
- **Token Refresh**: Handled server-side with concurrency protection
- **Logout**: Clears all tokens and optionally revokes OAuth refresh token