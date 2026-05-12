export default class NatureRemoLightController {
  private accessToken: string;
  private initialized = false;
  private applianceId: string | null = null;
  private readonly API_BASE_URL = 'https://api.nature.global/1';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  // 登録されているデバイス（照明）を探して初期化する
  async initializeLightDevice(): Promise<boolean> {
    try {
      console.log('🔄 Nature Remoから家電リストを取得中...');
      const response = await fetch(`${this.API_BASE_URL}/appliances`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const appliances = await response.json();
      
      // 'LIGHT' (照明) タイプの家電を探す
      const lightAppliance = appliances.find((app: any) => app.type === 'LIGHT' || app.type === 'IR');
      
      if (lightAppliance) {
        this.applianceId = lightAppliance.id;
        this.initialized = true;
        console.log(`✓ 照明デバイスを発見: ${lightAppliance.nickname} (ID: ${this.applianceId})`);
        return true;
      } else {
        console.warn('⚠ 照明タイプのデバイスが見つかりませんでした。');
        return false;
      }
    } catch (error) {
      console.error('✗ Nature Remoデバイスの初期化に失敗:', error);
      return false;
    }
  }

  async debugPrintLightSignals(): Promise<void> {
    console.log('Nature Remo API接続準備完了');
  }

  async turnLightOn(): Promise<void> {
    if (!this.initialized || !this.applianceId) throw new Error('デバイスが初期化されていません');
    
    console.log('💡 Nature Remo経由で照明をONにしています...');
    await fetch(`${this.API_BASE_URL}/appliances/${this.applianceId}/light`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'button=on' // またはお使いの照明に合わせたボタン名 ('on', 'on-100' など)
    });
  }

  async turnLightOff(): Promise<void> {
    if (!this.initialized || !this.applianceId) throw new Error('デバイスが初期化されていません');
    
    console.log('🌙 Nature Remo経由で照明をOFFにしています...');
    await fetch(`${this.API_BASE_URL}/appliances/${this.applianceId}/light`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'button=off' // 照明を消すボタン名
    });
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}