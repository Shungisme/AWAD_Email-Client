import { NotificationStrategy, NotificationType } from './types';
import { PullStrategy } from './PullStrategy';
import { PushStrategy } from './PushStrategy';

class NotificationManager {
  private strategy: NotificationStrategy;

  constructor() {
    // Default to PULL for now, or load from config
    const type = process.env.NOTIFICATION_STRATEGY === 'PUSH' ? NotificationType.PUSH : NotificationType.PULL;
    
    if (type === NotificationType.PULL) {
      this.strategy = new PullStrategy();
      // If it's pull, we might need to start the global listener
      (this.strategy as PullStrategy).startListening();
    } else {
      this.strategy = new PushStrategy();
    }
  }

  async startWatch(userId: string) {
    return this.strategy.start(userId);
  }

  async stopWatch(userId: string) {
    return this.strategy.stop(userId);
  }
  
  // This might be used if we have a webhook endpoint for Push strategy
  async handleWebhook(data: any) {
      return this.strategy.handleNotification(data);
  }
}

export default new NotificationManager();
