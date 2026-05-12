import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';

// GPS管理モジュール
import GPSTrackingManager, {
  LocationUpdatePayload,
} from './GPSTrackingModule';

// Nature Remo 照明制御モジュール
import NatureRemoLightController from './NatureRemoLightControl';

// API通信時に使う型
import {
  LightControlRequest,
  LineNotificationRequest,
  SheetLogRequest,
} from './interfaces';

/**
 * =========================
 * 自宅位置設定
 * =========================
 */

// 東京駅の緯度（実際には自宅に置き換える）
const HOME_LATITUDE = 35.6762;

// 東京駅の経度（実際には自宅に置き換える）
const HOME_LONGITUDE = 139.7674;

// この距離以内なら「家にいる」
const HOME_RADIUS = 30;

// この距離以上なら「外出中」
const AWAY_RADIUS = 100;

/**
 * Nature Remo アクセストークン
 */
const NATURE_REMO_ACCESS_TOKEN = 'Access Token Here';

export default function App() {
  /**
   * =========================
   * State管理
   * =========================
   */

  // GPS追跡中か
  const [isTracking, setIsTracking] = useState(false);

  // 現在位置
  const [location, setLocation] = useState<any>(null);

  // 照明状態
  const [lightState, setLightState] = useState(true);

  // エラー表示用
  const [error, setError] = useState<string | null>(null);

  // 初期化中フラグ
  const [isInitializing, setIsInitializing] = useState(true);

  // Nature Remo コントローラー
  const [remoController, setRemoController] =
    useState<NatureRemoLightController | null>(null);

  /**
   * useRef
   * 再レンダリングしても値を保持できる
   */

  // 前回の照明状態
  const lastStateRef = React.useRef(true);

  // GPSマネージャー本体
  const gpsManager = React.useRef<GPSTrackingManager | null>(null);

  /**
   * =========================
   * 初回起動時
   * =========================
   */

  useEffect(() => {
    initializeAll();
  }, []);

  /**
   * システム全体初期化
   */
  const initializeAll = async () => {
    try {
      console.log('🔄 システム初期化中...');

      /**
       * =========================
       * Nature Remo 初期化
       * =========================
       */

      const controller = new NatureRemoLightController(
        NATURE_REMO_ACCESS_TOKEN
      );

      // 利用可能な信号を表示
      await controller.debugPrintLightSignals();

      // 照明デバイス取得
      const remoInitialized = await controller.initializeLightDevice();

      // 初期化失敗
      if (!remoInitialized) {
        setError('Nature Remo3の初期化に失敗しました');
        setIsInitializing(false);
        return;
      }

      // stateへ保存
      setRemoController(controller);

      /**
       * =========================
       * GPS 初期化
       * =========================
       */

      const gps = new GPSTrackingManager(
        {
          homeLatitude: HOME_LATITUDE,
          homeLongitude: HOME_LONGITUDE,

          // GPS精度
          desiredAccuracy: 10,

          // 20m移動で更新
          distanceFilter: 20,

          // 30秒ごと更新
          updateInterval: 30000,
        },

        /**
         * GPS更新時
         */
        (payload: LocationUpdatePayload) => {
          handleLocationUpdate(payload);
        },

        /**
         * GPSエラー時
         */
        (errorMsg: string) => {
          setError(errorMsg);
        },

        /**
         * 権限拒否時
         */
        () => {
          Alert.alert('⚠', 'パーミッション拒否');
        }
      );

      // GPS側へNature API登録
      gps.initializeNatureRemoAPI(NATURE_REMO_ACCESS_TOKEN);

      // Refへ保存
      gpsManager.current = gps;

      Alert.alert('✓', 'システム初期化完了');

      setIsInitializing(false);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);

      setError(`初期化エラー: ${errorMessage}`);

      setIsInitializing(false);
    }
  };

  /**
   * =========================
   * GPS更新時処理
   * =========================
   */

  const handleLocationUpdate = async (
    payload: LocationUpdatePayload
  ) => {
    // 現在位置保存
    setLocation(payload.gpsData);

    // 距離から照明状態を判定
    const shouldLightBeOn = determineLightState(
      payload.gpsData.distance
    );

    /**
     * 状態変化時のみ実行
     * 無駄なON/OFFを防止
     */
    if (lastStateRef.current !== shouldLightBeOn) {
      lastStateRef.current = shouldLightBeOn;

      setLightState(shouldLightBeOn);

      try {
        // Nature Remo 未初期化
        if (!remoController) {
          throw new Error(
            'Nature Remo3がまだ初期化されていません'
          );
        }

        /**
         * =========================
         * 照明ON/OFF
         * =========================
         */

        if (shouldLightBeOn) {
          await remoController.turnLightOn();
        } else {
          await remoController.turnLightOff();
        }

        /**
         * =========================
         * 他モジュール連携
         * =========================
         */

        // ステータス送信
        await sendLightControlRequest({
          action: shouldLightBeOn ? 'on' : 'off',
          userId: 'user_id_here',
          timestamp: new Date().toISOString(),
          reason: shouldLightBeOn
            ? 'user_arrived_home'
            : 'user_left_home',
        });

        // LINE通知
        await sendLineNotification({
          userId: 'user_id_here',
          type: shouldLightBeOn
            ? 'light_turned_on'
            : 'light_turned_off',
          distance: payload.gpsData.distance,
          timestamp: new Date().toISOString(),
        });

        // スプレッドシート記録
        await sendSheetLog({
          userId: 'user_id_here',
          event: shouldLightBeOn ? 'light_on' : 'light_off',
          distance: payload.gpsData.distance,
          latitude: payload.gpsData.latitude,
          longitude: payload.gpsData.longitude,
          timestamp: new Date().toISOString(),
          accuracy: payload.gpsData.accuracy,
        });

        // 結果表示
        Alert.alert(
          shouldLightBeOn
            ? '💡 照明点灯'
            : '🌙 照明消灯',

          `距離: ${payload.gpsData.distance.toFixed(
            0
          )}m\nNature Remo3: ${
            payload.remoStatus?.deviceName
          }`
        );
      } catch (controlError) {
        const errorMessage =
          controlError instanceof Error
            ? controlError.message
            : String(controlError);

        setError(`照明制御失敗: ${errorMessage}`);

        console.error('✗ エラー:', controlError);
      }
    }
  };

  /**
   * =========================
   * 照明状態判定
   * =========================
   */

  const determineLightState = (
    distance: number
  ): boolean => {
    // 家に近い
    if (distance <= HOME_RADIUS) return true;

    // 家から離れた
    if (distance >= AWAY_RADIUS) return false;

    // 中間距離なら前回状態維持
    return lastStateRef.current;
  };

  /**
   * =========================
   * API通信
   * =========================
   */

  // サーバーへ照明状態送信
  const sendLightControlRequest = async (
    request: LightControlRequest
  ) => {
    try {
      await fetch(
        'http://YOUR_SERVER_IP:8000/api/light/control',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        }
      );

      console.log('✓ 照明制御ステータス報告完了');
    } catch (err) {
      console.error('✗ ステータス報告失敗:', err);
    }
  };

  // LINE通知API
  const sendLineNotification = async (
    request: LineNotificationRequest
  ) => {
    try {
      await fetch(
        'http://YOUR_SERVER_IP:8000/api/notify/line',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        }
      );

      console.log('✓ LINE通知完了');
    } catch (err) {
      console.error('✗ LINE通知失敗:', err);
    }
  };

  // スプレッドシート記録API
  const sendSheetLog = async (
    request: SheetLogRequest
  ) => {
    try {
      await fetch(
        'http://YOUR_SERVER_IP:8000/api/sheet/log',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        }
      );

      console.log('✓ シート記録完了');
    } catch (err) {
      console.error('✗ シート記録失敗:', err);
    }
  };

  /**
   * =========================
   * GPS開始
   * =========================
   */

  const startTracking = async () => {
    // Nature Remo未初期化
    if (!remoController?.isInitialized()) {
      Alert.alert(
        '⚠',
        'Nature Remo3がまだ初期化されていません'
      );
      return;
    }

    try {
      await gpsManager.current?.start();

      setIsTracking(true);

      Alert.alert('✓', 'トラッキング開始');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);

      setError(`開始失敗: ${errorMessage}`);
    }
  };

  /**
   * GPS停止
   */
  const stopTracking = async () => {
    try {
      await gpsManager.current?.stop();

      setIsTracking(false);

      Alert.alert('✓', 'トラッキング停止');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);

      setError(`停止失敗: ${errorMessage}`);
    }
  };

  /**
   * =========================
   * 初期化画面
   * =========================
   */

  if (isInitializing) {
    return (
      <View style={styles.container}>
        <ActivityIndicator
          size="large"
          color="#4287f5"
        />

        <Text style={styles.title}>
          システム初期化中...
        </Text>
      </View>
    );
  }

  /**
   * =========================
   * メインUI
   * =========================
   */

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        🏠 照明自動制御 GPS + Nature Remo3
      </Text>

      {/* 照明状態表示 */}
      <View
        style={[
          styles.statusBox,
          {
            backgroundColor: lightState
              ? '#c8e6c9'
              : '#ffccbc',
          },
        ]}
      >
        <Text style={styles.lightStatus}>
          {lightState
            ? '💡 照明: ON'
            : '🌙 照明: OFF'}
        </Text>
      </View>

      {/* GPS情報表示 */}
      {location && (
        <View style={styles.infoBox}>
          <Text>
            📍 位置: {location.latitude.toFixed(4)},
            {location.longitude.toFixed(4)}
          </Text>

          <Text>
            距離: {location.distance.toFixed(0)}m
          </Text>

          <Text>
            精度: {location.accuracy.toFixed(1)}m
          </Text>
        </View>
      )}

      {/* Nature Remo状態 */}
      {remoController && (
        <View style={styles.remoStatusBox}>
          <Text style={styles.remoStatusText}>
            ✓ Nature Remo3 接続済み
          </Text>
        </View>
      )}

      {/* エラー表示 */}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            ⚠ {error}
          </Text>

          <Button
            title="クリア"
            onPress={() => setError(null)}
            color="#d32f2f"
          />
        </View>
      )}

      {/* 開始停止ボタン */}
      <Button
        title={isTracking ? '🛑 停止' : '▶ 開始'}
        onPress={
          isTracking
            ? stopTracking
            : startTracking
        }
        color={isTracking ? '#d32f2f' : '#4287f5'}
      />
    </View>
  );
}

/**
 * =========================
 * Style定義
 * =========================
 */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },

  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },

  statusBox: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    width: '100%',
  },

  lightStatus: {
    fontSize: 16,
    fontWeight: 'bold',
  },

  infoBox: {
    padding: 10,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    marginBottom: 10,
    width: '100%',
  },

  remoStatusBox: {
    padding: 10,
    backgroundColor: '#c8e6c9',
    borderRadius: 8,
    marginBottom: 15,
    width: '100%',
  },

  remoStatusText: {
    color: '#2e7d32',
    fontWeight: 'bold',
  },

  errorBox: {
    padding: 12,
    backgroundColor: '#ffebee',
    borderRadius: 8,
    marginBottom: 15,
    width: '100%',
  },

  errorText: {
    color: '#d32f2f',
    marginBottom: 8,
  },
});