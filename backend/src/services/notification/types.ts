export interface NotificationStrategy {
  start(userId: string): Promise<void>;
  stop(userId: string): Promise<void>;
  handleNotification(data: any): Promise<void>;
}

export enum NotificationType {
  PULL = 'PULL',
  PUSH = 'PUSH'
}
