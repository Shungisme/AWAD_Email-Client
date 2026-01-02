import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";
import tokenStore from "./tokenStore";

/**
 * Gmail Service
 *
 * Handles all Gmail API operations using OAuth2 authentication.
 * Manages token refresh automatically and provides a clean interface for email operations.
 */

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/userinfo.email", // Access user email
  "openid", // OpenID Connect for user identity
];

class GmailService {
  /**
   * Get authorization URL for OAuth2 flow
   */
  getAuthUrl(): string {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    return oauth2Client.generateAuthUrl({
      access_type: "offline", // Request refresh token
      scope: SCOPES,
      prompt: "consent", // Force consent screen to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string): Promise<any> {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  }

  /**
   * Get authenticated Gmail client for a user
   */
  private async getGmailClient(userId: string) {
    const tokenData = tokenStore.getToken(userId);

    if (!tokenData) {
      throw new Error("No Gmail tokens found for user");
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Set credentials
    oauth2Client.setCredentials({
      refresh_token: tokenData.refreshToken,
      access_token: tokenData.accessToken,
      expiry_date: tokenData.expiryDate,
    });

    // Check if token needs refresh
    if (tokenData.expiryDate && tokenData.expiryDate < Date.now()) {
      const { credentials } = await oauth2Client.refreshAccessToken();

      // Update stored tokens
      if (credentials.access_token && credentials.expiry_date) {
        tokenStore.updateAccessToken(
          userId,
          credentials.access_token,
          credentials.expiry_date
        );
      }
    }

    return google.gmail({ version: "v1", auth: oauth2Client as any });
  }

  /**
   * List Gmail labels (mailboxes)
   */
  async listLabels(userId: string) {
    const gmail = await this.getGmailClient(userId);
    const response = await gmail.users.labels.list({ userId: "me" });

    return response.data.labels || [];
  }

  /**
   * List messages in a label/mailbox
   */
  async listMessages(
    userId: string,
    labelId: string = "INBOX",
    maxResults: number = 50,
    pageToken?: string
  ) {
    const gmail = await this.getGmailClient(userId);

    const response = await gmail.users.messages.list({
      userId: "me",
      labelIds: [labelId],
      maxResults,
      pageToken,
    });

    return {
      messages: response.data.messages || [],
      nextPageToken: response.data.nextPageToken,
      resultSizeEstimate: response.data.resultSizeEstimate,
    };
  }

  /**
   * Get a specific message with full details
   */
  async getMessage(userId: string, messageId: string) {
    const gmail = await this.getGmailClient(userId);

    const response = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    return response.data;
  }

  /**
   * Get message attachments
   */
  async getAttachment(userId: string, messageId: string, attachmentId: string) {
    const gmail = await this.getGmailClient(userId);

    const response = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId,
      id: attachmentId,
    });

    return response.data;
  }

  /**
   * Modify message labels (mark read/unread, star, delete)
   */
  async modifyMessage(
    userId: string,
    messageId: string,
    addLabelIds?: string[],
    removeLabelIds?: string[]
  ) {
    const gmail = await this.getGmailClient(userId);

    const response = await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody: {
        addLabelIds,
        removeLabelIds,
      },
    });

    return response.data;
  }

  /**
   * Send an email
   */
  async sendMessage(userId: string, rawMessage: string) {
    const gmail = await this.getGmailClient(userId);

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: rawMessage,
      },
    });

    return response.data;
  }

  /**
   * Create a draft
   */
  async createDraft(userId: string, rawMessage: string) {
    const gmail = await this.getGmailClient(userId);

    const response = await gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: {
          raw: rawMessage,
        },
      },
    });

    return response.data;
  }

  /**
   * Trash a message
   */
  async trashMessage(userId: string, messageId: string) {
    const gmail = await this.getGmailClient(userId);

    const response = await gmail.users.messages.trash({
      userId: "me",
      id: messageId,
    });

    return response.data;
  }

  /**
   * Delete a message permanently
   */
  async deleteMessage(userId: string, messageId: string) {
    const gmail = await this.getGmailClient(userId);

    await gmail.users.messages.delete({
      userId: "me",
      id: messageId,
    });

    return { success: true };
  }

  /**
   * Search messages
   */
  async searchMessages(userId: string, query: string, maxResults: number = 50) {
    const gmail = await this.getGmailClient(userId);

    const response = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults,
    });

    return {
      messages: response.data.messages || [],
      resultSizeEstimate: response.data.resultSizeEstimate,
    };
  }

  /**
   * Get user's Gmail profile
   */
  async getProfile(userId: string) {
    const gmail = await this.getGmailClient(userId);

    const response = await gmail.users.getProfile({
      userId: "me",
    });

    return response.data;
  }

  /**
   * Set up Gmail push notifications
   */
  async watch(userId: string, topicName: string) {
    const gmail = await this.getGmailClient(userId);
    const response = await gmail.users.watch({
      userId: "me",
      requestBody: {
        topicName: topicName,
      },
    });

    return response.data;
  }

  /**
   * Stop Gmail push notifications
   */
  async stopWatch(userId: string) {
    const gmail = await this.getGmailClient(userId);
    await gmail.users.stop({ userId: "me" });
  }

  /**
   * Get history of changes
   */
  async getHistory(userId: string, startHistoryId: string) {
    const gmail = await this.getGmailClient(userId);
    const response = await gmail.users.history.list({
      userId: "me",
      startHistoryId: startHistoryId,
    });
    return response.data.history || [];
  }
}

// Singleton instance
const gmailService = new GmailService();

export default gmailService;
