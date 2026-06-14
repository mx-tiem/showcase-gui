export interface Notification {
  id: number;
  title: string;
  short_description: string;
  long_description?: string;
  read: boolean;
  icon: string;
  created_at: string;
}
