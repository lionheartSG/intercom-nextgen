export interface OnlineUser {
  userId: string;
  lastSeen: number;
  isOnline: boolean;
}

export interface SiteSettings {
  channel: string;
  targetUserIds: string[];
  siteName: string;
  logo?: string; // Base64 encoded logo image
  customButtonTexts?: { [key: string]: string }; // Custom button text for each target user
}
