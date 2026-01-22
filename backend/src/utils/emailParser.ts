import { gmail_v1 } from "googleapis";
import { Email, EmailAddress, Attachment } from "../types";

/**
 * Email Parser Utilities
 *
 * Transforms Gmail API message format to our Email type
 */

/**
 * Decode MIME encoded-word format (RFC 2047)
 * Example: =?UTF-8?B?VGhheSDEkeG7lWk=?= -> Thay đổi
 * Handles multiple adjacent encoded-words properly
 */
function decodeMailHeader(header: string): string {
  if (!header) return "";

  try {
    // Check if header contains MIME encoded-words
    // If not, return as-is (Gmail API might have already decoded it)
    const mimeWordRegex = /=\?([^?]+)\?([BbQq])\?([^?]+)\?=/g;

    if (!mimeWordRegex.test(header)) {
      // No MIME encoding found, return as-is
      return header;
    }

    // Reset regex for actual decoding
    mimeWordRegex.lastIndex = 0;

    let decoded = header;
    let match;
    const replacements: Array<{ start: number; end: number; text: string }> =
      [];

    // Find all encoded-words and their positions
    while ((match = mimeWordRegex.exec(header)) !== null) {
      const [fullMatch, charset, encoding, encodedText] = match;
      try {
        let decodedText = "";

        if (encoding.toUpperCase() === "B") {
          // Base64 encoding
          decodedText = Buffer.from(encodedText, "base64").toString("utf-8");
        } else if (encoding.toUpperCase() === "Q") {
          // Quoted-printable encoding
          decodedText = encodedText
            .replace(/_/g, " ")
            .replace(/=([0-9A-F]{2})/gi, (_: string, hex: string) =>
              String.fromCharCode(parseInt(hex, 16)),
            );
        }

        replacements.push({
          start: match.index,
          end: match.index + fullMatch.length,
          text: decodedText,
        });
      } catch (e) {
        console.error("Failed to decode MIME word:", fullMatch, e);
      }
    }

    // Apply replacements in reverse order to maintain indices
    for (let i = replacements.length - 1; i >= 0; i--) {
      const { start, end, text } = replacements[i];
      decoded = decoded.substring(0, start) + text + decoded.substring(end);
    }

    // RFC 2047: Remove whitespace between adjacent decoded encoded-words
    // This handles cases like "=?UTF-8?B?part1?= =?UTF-8?B?part2?="
    decoded = decoded.replace(/\s+(?=[\p{L}\p{N}])/gu, " ").trim();

    return decoded;
  } catch (error) {
    console.error("Failed to decode mail header:", error);
    return header;
  }
}

/**
 * Strip HTML tags and decode entities from text
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "") // Remove style tags and content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "") // Remove script tags and content
    .replace(/<[^>]+>/g, "") // Remove all HTML tags
    .replace(/&nbsp;/gi, " ") // Replace &nbsp;
    .replace(/&lt;/gi, "<") // Decode HTML entities
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ") // Replace multiple whitespace with single space
    .trim();
}

/**
 * Parse Gmail message to Email format
 */
export function parseGmailMessage(
  message: gmail_v1.Schema$Message,
  userId: string,
  mailboxId: string,
): Email {
  const headers = message.payload?.headers || [];

  // Extract header values
  const getHeader = (name: string): string => {
    const header = headers.find(
      (h) => h.name?.toLowerCase() === name.toLowerCase(),
    );
    return header?.value || "";
  };

  const fromHeader = getHeader("From");
  const toHeader = getHeader("To");
  const ccHeader = getHeader("Cc");
  const subject = decodeMailHeader(getHeader("Subject"));
  const date = getHeader("Date");

  // Parse email addresses
  const from = parseEmailAddress(fromHeader);
  const to = parseEmailAddressList(toHeader);
  const cc = parseEmailAddressList(ccHeader);

  // Extract body
  const body = extractBody(message.payload);
  const preview = stripHtml(body).substring(0, 150); // Strip HTML first, then truncate

  // Extract attachments
  const attachments = extractAttachments(message.payload);

  // Check labels for read/starred status
  const labelIds = message.labelIds || [];
  const isRead = !labelIds.includes("UNREAD");
  const isStarred = labelIds.includes("STARRED");

  // Gmail web link
  const gmailLink = message.id
    ? `https://mail.google.com/mail/u/0/#inbox/${message.id}`
    : null;

  return {
    id: message.id!,
    mailboxId,
    userId,
    from,
    to,
    cc,
    subject,
    body,
    preview,
    isRead,
    isStarred,
    timestamp:
      date || new Date(parseInt(message.internalDate || "0")).toISOString(),
    attachments,
    status: mailboxId,
    snoozeUntil: null,
    summary: null,
    gmailLink,
  };
}

/**
 * Parse email address string to EmailAddress object
 */
function parseEmailAddress(addressStr: string): EmailAddress {
  if (!addressStr) {
    return { name: "", email: "" };
  }

  // Format: "Name <email@example.com>" or "email@example.com"
  const match =
    addressStr.match(/^(.+?)\s*<(.+?)>$/) || addressStr.match(/^(.+?)$/);

  if (!match) {
    return { name: "", email: "" };
  }

  if (match.length === 3) {
    return {
      name: match[1].trim().replace(/"/g, ""),
      email: match[2].trim(),
    };
  } else {
    const email = match[1].trim();
    return {
      name: email.split("@")[0],
      email,
    };
  }
}

/**
 * Parse comma-separated email address list
 */
function parseEmailAddressList(addressStr: string): EmailAddress[] {
  if (!addressStr) {
    return [];
  }

  // Split by comma, but not commas within quotes or brackets
  const addresses = addressStr.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  return addresses.map((addr) => parseEmailAddress(addr.trim()));
}

/**
 * Extract message body (prefer HTML, fallback to plain text)
 */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) {
    return "";
  }

  // If this part has body data
  if (payload.body?.data) {
    return decodeBase64(payload.body.data);
  }

  // If multipart, search for text/html or text/plain
  if (payload.parts) {
    // First try to find HTML
    const htmlPart = findPart(payload.parts, "text/html");
    if (htmlPart?.body?.data) {
      return decodeBase64(htmlPart.body.data);
    }

    // Fallback to plain text
    const textPart = findPart(payload.parts, "text/plain");
    if (textPart?.body?.data) {
      const text = decodeBase64(textPart.body.data);
      // Convert plain text to simple HTML
      return text.replace(/\n/g, "<br>");
    }
  }

  return "";
}

/**
 * Find a part by MIME type
 */
function findPart(
  parts: gmail_v1.Schema$MessagePart[],
  mimeType: string,
): gmail_v1.Schema$MessagePart | undefined {
  for (const part of parts) {
    if (part.mimeType === mimeType) {
      return part;
    }
    if (part.parts) {
      const found = findPart(part.parts, mimeType);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

/**
 * Extract attachments from message
 */
function extractAttachments(
  payload: gmail_v1.Schema$MessagePart | undefined,
): Attachment[] {
  if (!payload) {
    return [];
  }

  const attachments: Attachment[] = [];

  const extractFromParts = (
    parts: gmail_v1.Schema$MessagePart[] | undefined,
  ) => {
    if (!parts) return;

    for (const part of parts) {
      // Check if this part is an attachment
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          id: part.body.attachmentId,
          name: part.filename,
          size: formatBytes(part.body.size || 0),
          type: part.mimeType || "application/octet-stream",
        });
      }

      // Recursively check nested parts
      if (part.parts) {
        extractFromParts(part.parts);
      }
    }
  };

  extractFromParts(payload.parts);
  return attachments;
}

/**
 * Decode base64url string
 */
function decodeBase64(data: string): string {
  try {
    // Gmail uses base64url encoding (- instead of +, _ instead of /)
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(base64, "base64").toString("utf-8");
  } catch (error) {
    console.error("Error decoding base64:", error);
    return "";
  }
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * Create raw email message for sending
 */
export function createRawEmail(params: {
  to: string[];
  from: string;
  subject: string;
  body: string;
  cc?: string[];
  inReplyTo?: string;
  references?: string[];
}): string {
  const lines: string[] = [];

  lines.push(`From: ${params.from}`);
  lines.push(`To: ${params.to.join(", ")}`);

  if (params.cc && params.cc.length > 0) {
    lines.push(`Cc: ${params.cc.join(", ")}`);
  }

  lines.push(`Subject: ${params.subject}`);
  lines.push(`Content-Type: text/html; charset=utf-8`);
  lines.push(`MIME-Version: 1.0`);

  if (params.inReplyTo) {
    lines.push(`In-Reply-To: ${params.inReplyTo}`);
  }

  if (params.references && params.references.length > 0) {
    lines.push(`References: ${params.references.join(" ")}`);
  }

  lines.push("");
  lines.push(params.body);

  const email = lines.join("\r\n");

  // Encode to base64url
  return Buffer.from(email)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
