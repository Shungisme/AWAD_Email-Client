// User Types
export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  googleId: string | null;
  createdAt: string;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  googleId: string | null;
  createdAt: string;
}

// Email Types
export interface EmailAddress {
  name: string;
  email: string;
}

export interface Attachment {
  id?: string;
  name: string;
  size: string;
  type: string;
}

export interface Email {
  id: string;
  mailboxId: string;
  userId: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  subject: string;
  body: string;
  preview: string;
  isRead: boolean;
  isStarred: boolean;
  timestamp: string;
  attachments: Attachment[];
}

// Mailbox Types
export interface Mailbox {
  id: string;
  name: string;
  userId: string;
  icon: string;
  unreadCount: number;
}

// Auth Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface GoogleAuthRequest {
  credential: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface AuthResponse {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  user: UserResponse;
}

export interface RefreshResponse {
  success: boolean;
  accessToken: string;
}

export interface ErrorResponse {
  success: false;
  message: string;
  code?: string;
}

// JWT Payload
export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

// Express Request Extension
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
