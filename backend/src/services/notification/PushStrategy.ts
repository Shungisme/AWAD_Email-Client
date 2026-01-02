import { NotificationStrategy } from './types';

export class PushStrategy implements NotificationStrategy {
  async start(userId: string): Promise<void> {
    console.log('Push strategy start not implemented yet');
  }

  async stop(userId: string): Promise<void> {
    console.log('Push strategy stop not implemented yet');
  }

  async handleNotification(data: any): Promise<void> {
    console.log('Push strategy handleNotification not implemented yet');
  }
}
