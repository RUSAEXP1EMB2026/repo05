import { PermissionsAndroid, Platform } from 'react-native';

// GPS取得ライブラリ
import Geolocation from 'react-native-geolocation-service';

/**
 * =========================
 * 現在位置データ
 * =========================
 */
export interface LocationData {
  // 緯度
  latitude: number;

  // 経度
  longitude: number;

  // 自宅からの距離（m）
  distance: number;

  // GPS精度（m）
  accuracy: number;
}

/**
 * GPS更新時にApp側へ渡すデータ
 */
export interface LocationUpdatePayload {
  gpsData: LocationData;

  // Nature Remo情報
  remoStatus?: {
    deviceName: string;
  };
}

/**
 * GPS設定
 */
export interface GPSManagerConfig {
  // 自宅緯度
  homeLatitude: number;

  // 自宅経度
  homeLongitude: number;

  // GPS精度
  desiredAccuracy: number;

  // 何m移動したら更新するか
  distanceFilter: number;

  // 更新間隔(ms)
  updateInterval: number;
}

/**
 * =========================
 * GPS追跡マネージャー
 * =========================
 */
export default class GPSTrackingManager {
  // GPS設定
  private config: GPSManagerConfig;

  // GPS更新時コールバック
  private onLocationUpdate: (
    payload: LocationUpdatePayload
  ) => void;

  // エラー時コールバック
  private onError: (error: string) => void;

  // 権限拒否時コールバック
  private onPermissionDenied: () => void;

  // watchPosition の監視ID
  private watchId: number | null = null;

  // Nature Remoアクセストークン
  private remoToken: string | null = null;

  /**
   * コンストラクタ
   * クラス生成時に実行
   */
  constructor(
    config: GPSManagerConfig,

    onLocationUpdate: (
      payload: LocationUpdatePayload
    ) => void,

    onError: (error: string) => void,

    onPermissionDenied: () => void
  ) {
    this.config = config;

    this.onLocationUpdate = onLocationUpdate;

    this.onError = onError;

    this.onPermissionDenied = onPermissionDenied;
  }

  /**
   * =========================
   * Nature Remo API設定
   * =========================
   */
  initializeNatureRemoAPI(token: string): void {
    // アクセストークン保存
    this.remoToken = token;

    console.log(
      'Nature Remo連携の準備が完了しました'
    );
  }

  /**
   * =========================
   * 位置情報権限要求
   * =========================
   */
  private async requestPermissions(): Promise<boolean> {

    /**
     * iPhone(iOS)
     */
    if (Platform.OS === 'ios') {

      // 「常に許可」を要求
      const auth =
        await Geolocation.requestAuthorization(
          'always'
        );

      return auth === 'granted';
    }

    /**
     * Android
     */
    if (Platform.OS === 'android') {

      // Android権限ダイアログ表示
      const granted =
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS
            .ACCESS_FINE_LOCATION,

          {
            title: '位置情報の許可',

            message:
              '家に近づいた際に照明を操作するため、位置情報へのアクセスが必要です。',

            buttonNeutral: '後で',

            buttonNegative: 'キャンセル',

            buttonPositive: 'OK',
          }
        );

      return (
        granted ===
        PermissionsAndroid.RESULTS.GRANTED
      );
    }

    return false;
  }

  /**
   * =========================
   * GPS追跡開始
   * =========================
   */
  async start(): Promise<void> {

    // 権限確認
    const hasPermission =
      await this.requestPermissions();

    // 権限拒否
    if (!hasPermission) {
      this.onPermissionDenied();
      return;
    }

    // 既に起動中
    if (this.watchId !== null) {
      return;
    }

    console.log(
      '📍 実際のGPS追跡を開始します...'
    );

    /**
     * GPS監視開始
     */
    this.watchId = Geolocation.watchPosition(

      /**
       * GPS取得成功時
       */
      (position) => {

        // 現在位置取得
        const {
          latitude,
          longitude,
          accuracy,
        } = position.coords;

        /**
         * 自宅からの距離計算
         */
        const distance =
          this.calculateDistance(
            latitude,
            longitude,

            this.config.homeLatitude,
            this.config.homeLongitude
          );

        /**
         * App.tsx 側へ通知
         */
        this.onLocationUpdate({
          gpsData: {
            latitude,
            longitude,
            distance,
            accuracy,
          },

          // Nature Remo状態
          remoStatus: {
            deviceName: 'Nature Remo3',
          },
        });
      },

      /**
       * GPS取得失敗
       */
      (error) => {
        this.onError(
          `GPSエラー: ${error.message}`
        );
      },

      /**
       * GPS設定
       */
      {
        // 高精度GPS
        enableHighAccuracy: true,

        // 指定距離移動時のみ更新
        distanceFilter:
          this.config.distanceFilter,

        // 更新間隔
        interval: this.config.updateInterval,

        // 最短更新間隔
        fastestInterval: 10000,

        // GPS有効化ダイアログ表示
        showLocationDialog: true,
      }
    );
  }

  /**
   * =========================
   * GPS追跡停止
   * =========================
   */
  async stop(): Promise<void> {

    // GPS監視中
    if (this.watchId !== null) {

      // GPS監視停止
      Geolocation.clearWatch(this.watchId);

      // watchIdリセット
      this.watchId = null;

      console.log(
        '🛑 GPS追跡を停止しました'
      );
    }
  }

  /**
   * =========================
   * 距離計算
   * =========================
   *
   * Haversine公式を使用
   * 単位: メートル
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {

    // 地球半径(m)
    const R = 6371e3;

    // 緯度をラジアンへ変換
    const φ1 = (lat1 * Math.PI) / 180;

    const φ2 = (lat2 * Math.PI) / 180;

    // 緯度差
    const Δφ =
      ((lat2 - lat1) * Math.PI) / 180;

    // 経度差
    const Δλ =
      ((lon2 - lon1) * Math.PI) / 180;

    /**
     * Haversine公式
     */
    const a =
      Math.sin(Δφ / 2) *
        Math.sin(Δφ / 2) +

      Math.cos(φ1) *
        Math.cos(φ2) *

      Math.sin(Δλ / 2) *
        Math.sin(Δλ / 2);

    const c =
      2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      );

    // 距離(m)
    return R * c;
  }
}
