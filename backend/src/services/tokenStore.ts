import fs from "fs";
import path from "path";

/**
 * Token Store Service
 *
 * Securely stores Gmail refresh tokens for users.
 * In production, this should use a database (PostgreSQL, MongoDB) or secure key-value store (Redis).
 * For development, we use a JSON file with proper permissions.
 */

interface TokenData {
  userId: string;
  refreshToken: string; // Gmail OAuth refresh token
  accessToken?: string;
  expiryDate?: number;
  email: string;
  appRefreshToken?: string; // App JWT refresh token
  createdAt: string;
  updatedAt: string;
}

interface TokenStore {
  [userId: string]: TokenData;
}

class GmailTokenStore {
  private tokenFilePath: string;
  private tokens: TokenStore = {};

  constructor() {
    // Store tokens in a secure location (in production, use encrypted database)
    this.tokenFilePath = path.join(__dirname, "../../.tokens.json");
    this.loadTokens();
  }

  /**
   * Load tokens from file storage
   */
  private loadTokens(): void {
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        const data = fs.readFileSync(this.tokenFilePath, "utf-8");
        this.tokens = JSON.parse(data);
      }
    } catch (error) {
      console.error("Error loading tokens:", error);
      this.tokens = {};
    }
  }

  /**
   * Save tokens to file storage
   */
  private saveTokens(): void {
    try {
      fs.writeFileSync(
        this.tokenFilePath,
        JSON.stringify(this.tokens, null, 2),
        { mode: 0o600 }, // Secure file permissions (read/write for owner only)
      );
    } catch (error) {
      console.error("Error saving tokens:", error);
    }
  }

  /**
   * Store a Gmail refresh token for a user
   */
  setToken(
    userId: string,
    email: string,
    refreshToken: string,
    accessToken?: string,
    expiryDate?: number,
  ): void {
    const now = new Date().toISOString();

    this.tokens[userId] = {
      userId,
      email,
      refreshToken,
      accessToken,
      expiryDate,
      createdAt: this.tokens[userId]?.createdAt || now,
      updatedAt: now,
    };

    this.saveTokens();
  }

  /**
   * Get a user's Gmail refresh token
   */
  getToken(userId: string): TokenData | null {
    return this.tokens[userId] || null;
  }

  /**
   * Update access token and expiry (after refresh)
   */
  updateAccessToken(
    userId: string,
    accessToken: string,
    expiryDate: number,
  ): void {
    if (this.tokens[userId]) {
      this.tokens[userId].accessToken = accessToken;
      this.tokens[userId].expiryDate = expiryDate;
      this.tokens[userId].updatedAt = new Date().toISOString();
      this.saveTokens();
    }
  }

  /**
   * Delete a user's tokens (on logout or revocation)
   */
  deleteToken(userId: string): void {
    delete this.tokens[userId];
    this.saveTokens();
  }

  /**
   * Check if a user has a stored token
   */
  hasToken(userId: string): boolean {
    return !!this.tokens[userId];
  }

  /**
   * Get all user IDs with stored tokens (for admin purposes)
   */
  getAllUserIds(): string[] {
    return Object.keys(this.tokens);
  }

  /**
   * Store app refresh token for a user
   */
  setAppRefreshToken(userId: string, appRefreshToken: string): void {
    if (!this.tokens[userId]) {
      // Initialize token data if it doesn't exist
      const now = new Date().toISOString();
      this.tokens[userId] = {
        userId,
        email: "",
        refreshToken: "",
        appRefreshToken,
        createdAt: now,
        updatedAt: now,
      };
    } else {
      this.tokens[userId].appRefreshToken = appRefreshToken;
      this.tokens[userId].updatedAt = new Date().toISOString();
    }
    this.saveTokens();
  }

  /**
   * Get app refresh token for a user
   */
  getAppRefreshToken(userId: string): string | null {
    return this.tokens[userId]?.appRefreshToken || null;
  }
}

// Singleton instance
const tokenStore = new GmailTokenStore();

export default tokenStore;
