/**
 * Authentication API
 * Handles all authentication-related API calls
 */

import apiClient from "./axios";
import type {
  AuthResponse,
  LoginCredentials,
  GoogleAuthRequest,
  RefreshTokenRequest,
  User,
} from "../types";

// API Response wrapper
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * Login with email and password
 */
export const loginWithEmail = async (
  credentials: LoginCredentials
): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>(
    "/auth/login",
    credentials
  );
  return response.data;
};

/**
 * Register a new user account
 */
export const registerUser = async (data: {
  email: string;
  password: string;
  name: string;
}): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>("/auth/register", data);
  return response.data;
};

/**
 * Authenticate with Google OAuth
 */
export const loginWithGoogle = async (
  googleData: GoogleAuthRequest
): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>(
    "/auth/google",
    googleData
  );
  return response.data;
};

/**
 * Get Google OAuth authorization URL
 */
export const getGoogleAuthUrl = async (): Promise<{ url: string }> => {
  const response = await apiClient.get<ApiResponse<{ url: string }>>(
    "/auth/google/url"
  );
  return response.data.data!;
};

/**
 * Handle Google OAuth callback
 */
export const handleGoogleCallback = async (
  code: string
): Promise<AuthResponse> => {
  const response = await apiClient.get<AuthResponse>(
    `/auth/google/callback?code=${code}`
  );
  return response.data;
};

/**
 * Refresh access token using refresh token
 */
export const refreshAccessToken = async (
  refreshTokenData: RefreshTokenRequest
): Promise<{ accessToken: string; refreshToken: string }> => {
  const response = await apiClient.post<
    ApiResponse<{ accessToken: string; refreshToken: string }>
  >("/auth/refresh", refreshTokenData);
  return response.data.data!;
};

/**
 * Get current authenticated user
 */
export const getCurrentUser = async (): Promise<User> => {
  const response = await apiClient.get<ApiResponse<User>>("/auth/me");
  return response.data.data!;
};

/**
 * Logout current user
 */
export const logout = async (): Promise<void> => {
  await apiClient.post("/auth/logout");
};

/**
 * Verify email address
 */
export const verifyEmail = async (token: string): Promise<ApiResponse<void>> => {
  const response = await apiClient.get<ApiResponse<void>>(
    `/auth/verify-email?token=${token}`
  );
  return response.data;
};

/**
 * Request password reset
 */
export const requestPasswordReset = async (
  email: string
): Promise<ApiResponse<void>> => {
  const response = await apiClient.post<ApiResponse<void>>(
    "/auth/forgot-password",
    { email }
  );
  return response.data;
};

/**
 * Reset password with token
 */
export const resetPassword = async (
  token: string,
  newPassword: string
): Promise<ApiResponse<void>> => {
  const response = await apiClient.post<ApiResponse<void>>(
    "/auth/reset-password",
    { token, newPassword }
  );
  return response.data;
};