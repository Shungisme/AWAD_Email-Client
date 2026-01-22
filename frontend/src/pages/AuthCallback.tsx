import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { setAccessToken } from "../api/axios";
import { useAuth } from "../hooks/useAuth";

/**
 * OAuth Callback Page
 *
 * Handles the redirect from Google OAuth and stores tokens.
 * This page is shown briefly while processing the authentication.
 */

const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUserData } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("Processing authentication...");
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent multiple executions
    if (hasProcessed.current) {
      return;
    }

    const processAuth = async () => {
      try {
        // Mark as processed immediately
        hasProcessed.current = true;

        // Get tokens from URL parameters
        const accessToken = searchParams.get("accessToken");
        const error = searchParams.get("error");

        if (error) {
          setStatus("error");
          setMessage(`Authentication failed: ${error}`);
          setTimeout(() => navigate("/login", { replace: true }), 3000);
          return;
        }

        if (!accessToken) {
          setStatus("error");
          setMessage("Missing authentication token");
          setTimeout(() => navigate("/login", { replace: true }), 3000);
          return;
        }

        // Store access token (refresh token is in httpOnly cookie)
        setAccessToken(accessToken);

        // Decode JWT to get user info (simple base64 decode of payload)
        const payload = JSON.parse(atob(accessToken.split(".")[1]));
        const userData = {
          id: payload.userId,
          email: payload.email,
          name: payload.email.split("@")[0],
        };

        // Set user data in auth context
        setUserData(userData);

        setStatus("success");
        setMessage("Authentication successful! Redirecting...");

        // Navigate with replace to prevent back button issues
        setTimeout(() => {
          navigate("/inbox", { replace: true });
        }, 500);
      } catch (err) {
        console.error("Auth callback error:", err);
        setStatus("error");
        setMessage("An error occurred during authentication");
        setTimeout(() => navigate("/login", { replace: true }), 3000);
      }
    };

    processAuth();
  }, [searchParams, navigate, setUserData]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-md w-full p-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {status === "loading" && (
            <>
              <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Authenticating
              </h2>
              <p className="text-gray-600">{message}</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Success!
              </h2>
              <p className="text-gray-600">{message}</p>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
              <p className="text-gray-600 mb-4">{message}</p>
              <p className="text-sm text-gray-500">Redirecting to login...</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;
