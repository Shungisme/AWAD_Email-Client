import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import {
  User,
  UserResponse,
  LoginRequest,
  GoogleAuthRequest,
  RefreshTokenRequest,
  AuthResponse,
  RefreshResponse,
  JwtPayload,
} from "../types";
import usersData from "../data/users.json";
import gmailService from "../services/gmail";
import tokenStore from "../services/tokenStore";
import UserModel from "../models/User";
import notificationManager from "../services/notification/NotificationManager";

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Cookie configuration
const COOKIE_NAME = "auth_session";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// Helper function to parse cookies from request
const parseCookies = (cookieHeader?: string): Record<string, string> => {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...rest] = cookie.split("=");
    const value = rest.join("=").trim();
    if (name && value) {
      cookies[name.trim()] = decodeURIComponent(value);
    }
  });

  return cookies;
};

// Helper function to set auth cookie
const setAuthCookie = (res: Response, userId: string): void => {
  res.cookie(COOKIE_NAME, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
  });
};

// Helper function to get userId from cookie
const getUserIdFromCookie = (req: Request): string | null => {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE_NAME] || null;
};

// Helper function to generate tokens
const generateTokens = (userId: string, email: string) => {
  const SECRET = process.env.JWT_SECRET!;
  const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
  const ACCESS_EXPIRY = "15m";
  const REFRESH_EXPIRY = "7d";

  const accessToken = jwt.sign({ userId, email }, SECRET, {
    expiresIn: ACCESS_EXPIRY,
  });

  const refreshToken = jwt.sign({ userId, email }, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRY,
  });

  return { accessToken, refreshToken };
};

// Helper function to sanitize user data
const sanitizeUser = (user: User): UserResponse => {
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

// POST /api/auth/login - Email/Password Login
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password }: LoginRequest = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
      return;
    }

    // // Find user by email in MongoDB
    // const userDoc = await UserModel.findOne({ email: email.toLowerCase() });

    // Try to find user in MongoDB first
    let userDoc = null;
    try {
      userDoc = await UserModel.findOne({ email: email.toLowerCase() });
    } catch (dbError) {
      console.warn("MongoDB not available, falling back to demo data");
    }

    let user: User;

    // if (!userDoc) {
    //   res.status(401).json({
    //     success: false,
    //     message: "Invalid email or password",
    //   });
    //   return;
    // }

    if (userDoc) {
      // Use MongoDB user
      // Verify password
      if (!userDoc.password) {
        res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
        return;
      }

      const isValidPassword = await bcrypt.compare(password, userDoc.password);

      if (!isValidPassword) {
        res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
        return;
      }

      // Convert to User type for response
      //
      user = {
        id: userDoc._id.toString(),
        email: userDoc.email,
        password: userDoc.password,
        name: userDoc.name,
        googleId: userDoc.googleId || null,
        createdAt: userDoc.createdAt.toISOString(),
      };
    } else {
      // Fallback to demo data
      const demoUser = usersData.find(
        (u) => u.email.toLowerCase() === email.toLowerCase(),
      );

      if (!demoUser) {
        res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
        return;
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, demoUser.password);

      if (!isValidPassword) {
        res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
        return;
      }

      // Convert demo user to User type
      user = {
        id: demoUser.id,
        email: demoUser.email,
        password: demoUser.password,
        name: demoUser.name,
        googleId: demoUser.googleId,
        createdAt: demoUser.createdAt,
      };
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id, user.email);

    // Store refresh token server-side
    tokenStore.setAppRefreshToken(user.id, refreshToken);

    // Set httpOnly cookie for session management
    setAuthCookie(res, user.id);

    const response: AuthResponse = {
      success: true,
      accessToken,
      refreshToken: "", // Don't send refresh token to frontend
      user: sanitizeUser(user),
    };

    res.json(response);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// GET /api/auth/google/url - Get Google OAuth URL (OAuth2 Authorization Code Flow)
router.get("/google/url", (req: Request, res: Response): void => {
  try {
    const authUrl = gmailService.getAuthUrl();

    res.json({
      success: true,
      url: authUrl,
    });
  } catch (error) {
    console.error("Error generating OAuth URL:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate OAuth URL",
    });
  }
});

// GET /api/auth/google/callback - Handle Google OAuth callback (OAuth2 Authorization Code Flow)
router.get(
  "/google/callback",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { code, error } = req.query;

      // Handle OAuth error
      if (error) {
        res.redirect(`${process.env.FRONTEND_URL}/login?error=${error}`);
        return;
      }

      if (!code || typeof code !== "string") {
        res.redirect(`${process.env.FRONTEND_URL}/login?error=no_code`);
        return;
      }

      // Exchange code for tokens
      const tokens = await gmailService.getTokensFromCode(code);

      if (!tokens.refresh_token || !tokens.access_token) {
        res.redirect(
          `${process.env.FRONTEND_URL}/login?error=no_refresh_token`,
        );
        return;
      }

      // Get user's email from OAuth2 userinfo endpoint
      // Use axios directly with Bearer token instead of oauth2Client.request()
      // to avoid credential attachment issues
      const axios = await import("axios");
      const userInfoResponse = await axios.default.get(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        },
      );

      const email = userInfoResponse.data.email;

      if (!email) {
        res.redirect(`${process.env.FRONTEND_URL}/login?error=no_email`);
        return;
      }

      // Find or create user in MongoDB
      let userDoc = await UserModel.findOne({ email: email.toLowerCase() });

      if (!userDoc) {
        // Create new user
        userDoc = new UserModel({
          email: email.toLowerCase(),
          name: userInfoResponse.data.name || email.split("@")[0],
          googleId: userInfoResponse.data.id || email,
        });
        await userDoc.save();
      } else if (!userDoc.googleId) {
        // Link Google account to existing user
        userDoc.googleId = userInfoResponse.data.id || email;
        await userDoc.save();
      }

      // Convert to User type
      const user: User = {
        id: userDoc._id.toString(),
        email: userDoc.email,
        password: userDoc.password || "",
        name: userDoc.name,
        googleId: userDoc.googleId || null,
        createdAt: userDoc.createdAt.toISOString(),
      };

      // Store Gmail refresh token
      tokenStore.setToken(
        user.id,
        email,
        tokens.refresh_token,
        tokens.access_token,
        tokens.expiry_date ?? undefined,
      );

      // Start watching for email updates
      notificationManager
        .startWatch(user.id)
        .catch((err) => console.error("Failed to start watch:", err));

      // Generate app tokens
      const { accessToken, refreshToken } = generateTokens(user.id, user.email);

      // Store refresh token server-side
      tokenStore.setAppRefreshToken(user.id, refreshToken);

      // Set httpOnly cookie for session management
      setAuthCookie(res, user.id);

      // Redirect to frontend with only access token (refresh token stays server-side)
      const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?accessToken=${accessToken}`;
      res.redirect(redirectUrl);
    } catch (error) {
      console.error("Google OAuth callback error:", error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    }
  },
);

// POST /api/auth/google - Google OAuth Login (Legacy - client-side token verification)
router.post("/google", async (req: Request, res: Response): Promise<void> => {
  try {
    const { credential }: GoogleAuthRequest = req.body;

    if (!credential) {
      res.status(400).json({
        success: false,
        message: "Google credential is required",
      });
      return;
    }

    // Verify Google token
    let googleUser;

    try {
      // Check if Google Client ID is configured
      if (
        !process.env.GOOGLE_CLIENT_ID ||
        process.env.GOOGLE_CLIENT_ID === "mock_google_client_id"
      ) {
        res.status(500).json({
          success: false,
          message:
            "Google OAuth is not properly configured. Please set GOOGLE_CLIENT_ID in .env file. Get your Client ID from https://console.cloud.google.com/",
        });
        return;
      }

      // Verify with Google
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      if (!payload) {
        throw new Error("No payload received from Google");
      }

      googleUser = {
        sub: payload.sub,
        email: payload.email || "",
        name: payload.name || "Google User",
        picture: payload.picture,
      };
    } catch (error: any) {
      console.error("Google verification error:", error);
      res.status(401).json({
        success: false,
        message: error.message || "Invalid Google credential",
      });
      return;
    }

    // Find or create user in MongoDB
    let userDoc = await UserModel.findOne({
      $or: [
        { googleId: googleUser.sub },
        { email: googleUser.email.toLowerCase() },
      ],
    });

    if (!userDoc) {
      // Create new user
      userDoc = new UserModel({
        email: googleUser.email.toLowerCase(),
        name: googleUser.name,
        googleId: googleUser.sub,
      });
      await userDoc.save();
    } else if (!userDoc.googleId) {
      // Link Google account to existing user
      userDoc.googleId = googleUser.sub;
      await userDoc.save();
    }

    // Convert to User type
    const user: User = {
      id: userDoc._id.toString(),
      email: userDoc.email,
      password: userDoc.password || "",
      name: userDoc.name,
      googleId: userDoc.googleId || null,
      createdAt: userDoc.createdAt.toISOString(),
    };

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id, user.email);

    // Store refresh token server-side
    tokenStore.setAppRefreshToken(user.id, refreshToken);

    // Set httpOnly cookie for session management
    setAuthCookie(res, user.id);

    const response: AuthResponse = {
      success: true,
      accessToken,
      refreshToken: "", // Don't send refresh token to frontend
      user: sanitizeUser(user),
    };

    res.json(response);
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// POST /api/auth/refresh - Refresh Access Token
router.post("/refresh", async (req: Request, res: Response): Promise<void> => {
  try {
    // Get userId from cookie (not from request body)
    const userId = getUserIdFromCookie(req);

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "No active session found",
      });
      return;
    }

    // Get stored refresh token from server-side storage
    const storedRefreshToken = tokenStore.getAppRefreshToken(userId);

    if (!storedRefreshToken) {
      res.status(401).json({
        success: false,
        message: "No refresh token found for user",
      });
      return;
    }

    // Verify refresh token signature
    try {
      const decoded = jwt.verify(
        storedRefreshToken,
        process.env.JWT_REFRESH_SECRET as string,
      ) as JwtPayload;

      // Verify the token belongs to the user in the cookie
      if (decoded.userId !== userId) {
        res.status(401).json({
          success: false,
          message: "Token mismatch",
        });
        return;
      }

      // Generate new access token
      const SECRET = process.env.JWT_SECRET!;
      const ACCESS_EXPIRY = "15m";

      const accessToken = jwt.sign(
        { userId: decoded.userId, email: decoded.email },
        SECRET,
        { expiresIn: ACCESS_EXPIRY },
      );

      // Refresh the cookie
      setAuthCookie(res, userId);

      const response: RefreshResponse = {
        success: true,
        accessToken,
      };

      res.json(response);
    } catch (error) {
      // Token invalid or expired, remove stored token
      tokenStore.setAppRefreshToken(userId, "");

      res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
    }
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// POST /api/auth/logout - Logout
router.post("/logout", async (req: Request, res: Response): Promise<void> => {
  try {
    // Get userId from cookie
    const userId = getUserIdFromCookie(req);

    if (userId) {
      // Remove app refresh token
      tokenStore.setAppRefreshToken(userId, "");
    }

    // Also try to get userId from access token if available
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET as string,
        ) as JwtPayload;

        // Remove app refresh token
        tokenStore.setAppRefreshToken(decoded.userId, "");
      } catch (error) {
        // Token invalid or expired, ignore
      }
    }

    // Clear the cookie
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;
