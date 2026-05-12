export interface LightControlRequest {
  action: 'on' | 'off';
  userId: string;
  timestamp: string;
  reason: string;
}

export interface LineNotificationRequest {
  userId: string;
  type: 'light_turned_on' | 'light_turned_off';
  distance: number;
  timestamp: string;
}

export interface SheetLogRequest {
  userId: string;
  event: 'light_on' | 'light_off';
  distance: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy: number;
}