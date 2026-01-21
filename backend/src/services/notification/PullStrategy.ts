import { PubSub, Message } from '@google-cloud/pubsub';
import { NotificationStrategy } from './types';
import User from '../../models/User';
import gmailService from '../gmail';
import socketService from '../socketService';
import { parseGmailMessage } from '../../utils/emailParser';

export class PullStrategy implements NotificationStrategy {
  private pubSubClient: PubSub;
  private subscriptionName: string;
  private subscription: any;

  constructor() {
    // Load credentials from environment variable
    let credentials;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      try {
        // Parse the JSON string from environment variable
        credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        console.log('✓ Google Cloud service account credentials loaded from environment');
      } catch (error) {
        console.error('❌ Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY:', error);
      }
    }

    this.pubSubClient = new PubSub({
      projectId: process.env.GOOGLE_PROJECT_ID,
      ...(credentials && { credentials })
    });
    this.subscriptionName = process.env.GMAIL_SUBSCRIPTION_NAME || 'gmail-updates-sub';
  }

  async start(userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) return;

    const topicName = process.env.GMAIL_TOPIC_NAME || 'projects/my-project/topics/gmail-updates';
    try {
        const response = await gmailService.watch(userId, topicName);
        console.log(`Watch set up for user ${userId}:`, response);
        if (response.historyId) {
            user.latestHistoryId = response.historyId;
            await user.save();
        }
    } catch (error) {
        console.error(`Failed to watch user ${userId}:`, error);
    }
  }

  async stop(userId: string): Promise<void> {
    try {
        await gmailService.stopWatch(userId);
    } catch (error) {
        console.error(`Failed to stop watch for user ${userId}:`, error);
    }
  }

  async handleNotification(data: any): Promise<void> {
    const { emailAddress, historyId } = data;
    const newHistoryId = historyId.toString();

    const user = await User.findOne({ email: emailAddress });
    if (!user || !user.latestHistoryId) return;

    // If the notification is older or same as what we have, ignore
    // Note: String comparison for historyId might be tricky if lengths differ, 
    // but usually they are large numbers. BigInt comparison is safer.
    if (BigInt(newHistoryId) <= BigInt(user.latestHistoryId)) return;

    try {
        console.log(`Processing history for user ${user.email} from ${user.latestHistoryId} to ${newHistoryId}`);
        const history = await gmailService.getHistory(user.id, user.latestHistoryId);
        if (history && history.length > 0) {
            for (const record of history) {
                if (record.messagesAdded) {
                    for (const msgAdded of record.messagesAdded) {
                        if (msgAdded.message && msgAdded.message.id) {
                            const fullMessage = await gmailService.getMessage(user.id, msgAdded.message.id);
                            // We assume it's INBOX for simplicity, but we could check labels
                            const parsedEmail = parseGmailMessage(fullMessage, user.id, 'INBOX'); 
                            socketService.emitToUser(user.id, 'email:new', parsedEmail);
                        }
                    }
                }
            }
        }

        user.latestHistoryId = newHistoryId;
        await user.save();
    } catch (error) {
        console.error(`Error processing history for user ${user.email}:`, error);
    }
  }
  
  startListening() {
      console.log(`Listening for Pub/Sub messages on ${this.subscriptionName}...`);
      this.subscription = this.pubSubClient.subscription(this.subscriptionName);
      
      this.subscription.on('message', async (message: Message) => {
          try {
              const data = JSON.parse(message.data.toString());
              await this.handleNotification(data);
              message.ack();
          } catch (error) {
            //   console.error('Error processing message:', error);
            //   message.nack();
            // Ignore for now
            console.log('Cannot process message:', message.data.toString());
          }
      });

      this.subscription.on('error', (error: any) => {
          console.error('Pub/Sub subscription error:', error);
      });
  }
}
