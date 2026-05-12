
import Geolocation from 'react-native-geolocation-service';
import BackgroundGeolocation from 'react-native-background-geolocation';

/**
 * GPS位置情報を取得・管理するモジュール
 */

export interface GPSLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
}

export interface DistanceData {
  distance: number;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
}

interface BGLocation {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
}

interface BGError {
  message: string;
  code?: number;
}

export class GPSTrackingManager {
  private homeLatitude: number;
  private homeLongitude: number;
  private onLocationUpdate: (location: DistanceData) => void;
  private onError: (error: string) => void;

  constructor(
    homeLatitude: number,
    homeLongitude: number,
    onLocationUpdate: (location: DistanceData) => void,
    onError: (error: string) => void
  ) {
    this.homeLatitude = homeLatitude;
    this.homeLongitude = homeLongitude;
    this.onLocationUpdate = onLocationUpdate;
    this.onError = onError;
  }

  /**
   * Haversine公式を使用した距離計算（単位：メートル）
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * バックグラウンド位置情報取得を開始
   */
  async start(): Promise<void> {
    try {
      // @ts-ignoreを使って型チェックを無視
      await BackgroundGeolocation.ready({
        desiredAccuracy: -1, // High = -1
        stationaryRadius: 50,
        distanceFilter: 20,
        interval: 30000,
        fastestInterval: 10000,
        notificationTitle: '照明自動制御',
        notificationText: '位置情報を監視中...',
        startOnBoot: true,
        stopOnTerminate: false,
        enableHeadless: true,
        foregroundService: true,

        onLocation: (location: BGLocation) => {
          const distance = this.calculateDistance(
            this.homeLatitude,
            this.homeLongitude,
            location.coords.latitude,
            location.coords.longitude
          );

          this.onLocationUpdate({
            distance,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || 0,
            timestamp: new Date().toISOString(),
          });
        },

        onError: (error: BGError) => {
          this.onError(`GPS Error: ${error.message}`);
        },
      } as any); // as any で型チェックをスキップ

      await BackgroundGeolocation.start();
    } catch (error) {
      this.onError(
        `Failed to start GPS tracking: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * 位置情報取得を停止
   */
  async stop(): Promise<void> {
    try {
      await BackgroundGeolocation.stop();
    } catch (error) {
      this.onError(
        `Failed to stop GPS tracking: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * 現在の位置情報を1回取得
   */
  async getCurrentLocation(): Promise<DistanceData> {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const distance = this.calculateDistance(
            this.homeLatitude,
            this.homeLongitude,
            position.coords.latitude,
            position.coords.longitude
          );

          resolve({
            distance,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || 0,
            timestamp: new Date().toISOString(),
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });
  }

  /**
   * ホーム座標を更新
   */
  updateHomeLocation(latitude: number, longitude: number): void {
    this.homeLatitude = latitude;
    this.homeLongitude = longitude;
  }
}

export default GPSTrackingManager;
