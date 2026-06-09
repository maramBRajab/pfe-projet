export interface Notification {
  type: string;
  titre: string;
  message: string;
  niveau: string;
  dateCreation: string;
  id?: number;
  notificationKey?: string;
  lu?: boolean;
}
