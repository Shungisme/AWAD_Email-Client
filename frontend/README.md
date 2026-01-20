# Email Dashboard - Frontend

Production-grade React application with TypeScript, OAuth authentication, and modern UI.

## ��� Features

- React 19 + TypeScript + Vite
- Tailwind CSS for styling
- React Router v7 for navigation
- Axios with automatic token refresh
- Google OAuth 2.0 integration
- Context API for state management
- DOMPurify for XSS protection
- Responsive 3-column layout

## ���️ Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## ��� Environment Variables

Create `.env` file:

```env
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

## �� Dependencies

### Core
- react, react-dom - UI library
- react-router-dom - Routing
- axios - HTTP client
- @react-oauth/google - Google OAuth

### Utilities
- date-fns - Date formatting
- dompurify - HTML sanitization
- lucide-react - Icon library

## ��� Deploy

See main project README for deployment instructions.


