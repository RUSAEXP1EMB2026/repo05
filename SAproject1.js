import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import BackgroundGeolocation from 'react-native-background-geolocation';
import axios from 'axios';

const API_SERVER = 'http://YOUR_SERVER_IP:8000/api/location';  // バックエンドサーバーのURL
const UPDATE_INTERVAL = 30000;  // 30秒ごとに位置情報を送信

export default function App() {
  const [location, setLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState(null);

  // 位置情報を送信する関数
  const sendLocationToServer = async (lat, lon) => {
    try {
      const response = await axios.post(API_SERVER, {
        latitude: lat,
        longitude: lon,
        timestamp: new Date().toISOString(),
        userId: 'user_id_here',  // ユーザーID（要調整）
      });
      console.log('✓ 位���情報を送信しました:', response.data);
    } catch (err) {
      console.error('✗ サーバー送信失敗:', err);
    }
  };

  // フォアグラウンド位置情報取得（定期的）
  const startForegroundTracking = () => {
    const watchId = Geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setLocation({ latitude, longitude, accuracy });
        console.log(`📍 位置情報: ${latitude}, ${longitude} (精度: ${accuracy}m)`);
        
        // サーバーに送信
        sendLocationToServer(latitude, longitude);
      },
      (error) => {
        console.error('✗ 位置情報取得エラー:', error);
        setError(error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );

    return watchId;
  };

  // バックグラウンド位置情報取得（常時）
  const startBackgroundTracking = async () => {
    try {
      await BackgroundGeolocation.ready({
        desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
        stationaryRadius: 50,
        distanceFilter: 50,  // 50m 移動したら送信
        interval: UPDATE_INTERVAL,
        notificationTitle: '位置情報取得中',
        notificationText: '照明自動制御のため位置情報を取得しています',
        notificationSmallIcon: 'icon_0',
        notificationLargeIcon: 'icon_0',
        notificationColor: '#4287f5',
        startOnBoot: true,
        stopOnTerminate: false,  // アプリ終了後も動作
        enableHeadless: true,
        
        // バックグラウンド位置情報の送信
        onLocation: (location) => {
          console.log(`📍 バックグラウンド位置: ${location.coords.latitude}, ${location.coords.longitude}`);
          sendLocationToServer(location.coords.latitude, location.coords.longitude);
        },
      });

      await BackgroundGeolocation.start();
      setIsTracking(true);
      Alert.alert('✓', 'バックグラウンド位置情報取得を開始しました');
    } catch (error) {
      console.error('✗ バックグラウンド開始失敗:', error);
      setError(error.message);
    }
  };

  // トラッキング停止
  const stopTracking = async () => {
    try {
      await BackgroundGeolocation.stop();
      setIsTracking(false);
      Alert.alert('✓', 'トラッキングを停止しました');
    } catch (error) {
      console.error('✗ 停止失敗:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🏠 照明自動制御 GPS トラッキング</Text>

      {location && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>📍 現在位置</Text>
          <Text style={styles.coordText}>
            {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
          </Text>
          <Text style={styles.accuracyText}>精度: {location.accuracy.toFixed(1)}m</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠ エラー: {error}</Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <Button
          title={isTracking ? '🛑 トラッキング停止' : '▶ トラッキング開始'}
          onPress={isTracking ? stopTracking : startBackgroundTracking}
          color={isTracking ? '#d32f2f' : '#4287f5'}
        />
      </View>

      <Text style={styles.statusText}>
        {isTracking ? '🟢 トラッキング中...' : '🔴 停止中'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  infoBox: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    width: '100%',
  },
  infoText: {
    fontSize: 14,
    color: '#1976d2',
    marginBottom: 5,
  },
  coordText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  accuracyText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  errorBox: {
    backgroundColor: '#ffebee',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    width: '100%',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
  },
  buttonContainer: {
    marginBottom: 20,
    width: '100%',
  },
  statusText: {
    fontSize: 14,
    marginTop: 10,
    color: '#666',
  },
});