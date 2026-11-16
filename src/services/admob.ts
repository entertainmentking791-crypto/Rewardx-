import { storage } from './storage';

export const DEFAULT_ADMOB_CONFIG = {
  appId: 'ca-app-pub-3246619602569680~4287491023',
  interstitialId: 'ca-app-pub-3246619602569680/3297842982',
  bannerId: 'ca-app-pub-3246619602569680/8358597975',
  rewardedId: 'ca-app-pub-3246619602569680/9474424430',
  rewardedInterstitialId: 'ca-app-pub-3246619602569680/8394256996',
  nativeAdvancedId: 'ca-app-pub-3246619602569680/4852653144',
  appOpenId: 'ca-app-pub-3246619602569680/2226489807',
  interstitialCooldownSec: 90,
};

interface CapacitorAdMobPlugin {
  initialize?: (opts: { initializeForTesting?: boolean }) => Promise<void>;
  showBanner?: (opts: {
    adId: string;
    adSize?: string;
    position?: string;
    margin?: number;
    isTesting?: boolean;
  }) => Promise<void>;
  hideBanner?: () => Promise<void>;
  prepareInterstitial?: (opts: { adId: string; isTesting?: boolean }) => Promise<void>;
  showInterstitial?: () => Promise<void>;
  prepareRewardInterstitialAd?: (opts: { adId: string; isTesting?: boolean }) => Promise<void>;
  showRewardInterstitialAd?: () => Promise<{ type?: string; amount?: number } | void>;
  prepareRewardVideoAd?: (opts: { adId: string; isTesting?: boolean }) => Promise<void>;
  showRewardVideoAd?: () => Promise<{ type?: string; amount?: number } | void>;
  prepareAppOpenAd?: (opts: { adId: string; isTesting?: boolean }) => Promise<void>;
  showAppOpenAd?: () => Promise<void>;
  prepareNativeAd?: (opts: { adId: string; placement?: string }) => Promise<void>;
  showNativeAd?: (opts: { adId: string; placement?: string }) => Promise<void>;
  hideNativeAd?: () => Promise<void>;
}

interface AndroidAdMobBridge {
  init?: (appId: string) => void;
  loadInterstitial?: (adUnitId: string) => void;
  showInterstitial?: (adUnitId: string) => void;
  showBanner?: (adUnitId: string, position?: string) => void;
  hideBanner?: () => void;
  loadRewarded?: (adUnitId: string) => void;
  showRewarded?: (adUnitId: string) => boolean | void;
  loadRewardedInterstitial?: (adUnitId: string) => void;
  showRewardedInterstitial?: (adUnitId: string) => boolean | void;
  loadAppOpen?: (adUnitId: string) => void;
  showAppOpen?: (adUnitId: string) => void;
  loadNativeAd?: (adUnitId: string) => void;
  showNativeAd?: (adUnitId: string, placement?: string) => void;
  hideNativeAd?: () => void;
}

interface CordovaAdMob {
  interstitial?: {
    config?: (opts: { id: string; autoShow?: boolean }) => void;
    prepare?: () => Promise<void> | void;
    show?: () => Promise<void> | void;
  };
  banner?: {
    config?: (opts: { id: string; autoShow?: boolean; position?: string }) => void;
    prepare?: () => Promise<void> | void;
    show?: () => Promise<void> | void;
    hide?: () => Promise<void> | void;
  };
  rewardvideo?: {
    config?: (opts: { id: string; autoShow?: boolean }) => void;
    prepare?: () => Promise<void> | void;
    show?: () => Promise<void> | void;
  };
}

declare global {
  interface Window {
    Capacitor?: {
      Plugins?: {
        AdMob?: CapacitorAdMobPlugin;
      };
    };
    AndroidAdMob?: AndroidAdMobBridge;
    AdMob?: AndroidAdMobBridge;
    admob?: CordovaAdMob;
    onAdMobRewarded?: (rewarded: boolean) => void;
  }
}

export type AdMobRuntime = 'capacitor' | 'android-webview' | 'cordova' | 'web';

export interface RewardedInterstitialResult {
  rewarded: boolean;
  status: 'rewarded' | 'dismissed' | 'unavailable';
}

const APP_OPEN_COOLDOWN_MS = 120_000;

class AdMobService {
  private initialized = false;
  private lastInterstitialAt = 0;
  private lastAppOpenAt = 0;
  private gamesCompletedSinceAd = 0;

  public detectRuntime(): AdMobRuntime {
    if (typeof window === 'undefined') return 'web';
    if (window.Capacitor?.Plugins?.AdMob) return 'capacitor';
    if (window.AndroidAdMob || window.AdMob) return 'android-webview';
    if (window.admob) return 'cordova';
    return 'web';
  }

  public isNativeBridgeAvailable(): boolean {
    return this.detectRuntime() !== 'web';
  }

  public async initialize(): Promise<void> {
    const config = storage.getAdMobConfig();
    const runtime = this.detectRuntime();

    // Ensure meta tag reflects active AdMob App ID
    if (typeof document !== 'undefined' && config.appId) {
      let meta = document.querySelector('meta[name="com.google.android.gms.ads.APPLICATION_ID"]') as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'com.google.android.gms.ads.APPLICATION_ID';
        document.head.appendChild(meta);
      }
      meta.content = config.appId;
    }

    if (runtime === 'capacitor') {
      try {
        const plugin = window.Capacitor?.Plugins?.AdMob;
        if (!this.initialized) {
          await plugin?.initialize?.({ initializeForTesting: false });
          this.initialized = true;
        }
        if (config.appOpenId) {
          await plugin?.prepareAppOpenAd?.({ adId: config.appOpenId });
        }
        if (config.interstitialId) {
          await plugin?.prepareInterstitial?.({ adId: config.interstitialId });
        }
        if (config.rewardedId) {
          await plugin?.prepareRewardVideoAd?.({ adId: config.rewardedId });
        }
        if (config.rewardedInterstitialId) {
          await plugin?.prepareRewardInterstitialAd?.({ adId: config.rewardedInterstitialId });
        }
        if (config.nativeAdvancedId) {
          await plugin?.prepareNativeAd?.({ adId: config.nativeAdvancedId, placement: 'feed' });
        }
        if (config.bannerId) {
          await plugin?.showBanner?.({
            adId: config.bannerId,
            adSize: 'ADAPTIVE_BANNER',
            position: 'BOTTOM_CENTER',
            margin: 60,
          });
        }
      } catch {
        // Silent fallback on bridge error
      }
      return;
    }

    if (runtime === 'android-webview') {
      try {
        const bridge = window.AndroidAdMob || window.AdMob;
        if (!this.initialized && config.appId) {
          bridge?.init?.(config.appId);
          this.initialized = true;
        }
        if (config.appOpenId) {
          bridge?.loadAppOpen?.(config.appOpenId);
        }
        if (config.interstitialId) {
          bridge?.loadInterstitial?.(config.interstitialId);
        }
        if (config.rewardedId) {
          bridge?.loadRewarded?.(config.rewardedId);
        }
        if (config.rewardedInterstitialId) {
          bridge?.loadRewardedInterstitial?.(config.rewardedInterstitialId);
        }
        if (config.nativeAdvancedId) {
          bridge?.loadNativeAd?.(config.nativeAdvancedId);
        }
        if (config.bannerId) {
          bridge?.showBanner?.(config.bannerId, 'bottom');
        }
      } catch {
        // Silent fallback
      }
      return;
    }

    if (runtime === 'cordova') {
      try {
        if (config.interstitialId) {
          window.admob?.interstitial?.config?.({ id: config.interstitialId, autoShow: false });
          await window.admob?.interstitial?.prepare?.();
        }
        const rewardUnit = config.rewardedId || config.rewardedInterstitialId;
        if (rewardUnit) {
          window.admob?.rewardvideo?.config?.({ id: rewardUnit, autoShow: false });
          await window.admob?.rewardvideo?.prepare?.();
        }
        if (config.bannerId) {
          window.admob?.banner?.config?.({ id: config.bannerId, autoShow: true, position: 'bottom' });
          await window.admob?.banner?.prepare?.();
        }
        this.initialized = true;
      } catch {
        // Silent fallback
      }
    }
  }

  public async showAppOpenIfReady(force: boolean = false): Promise<boolean> {
    const config = storage.getAdMobConfig();
    const runtime = this.detectRuntime();
    if (!config.appOpenId || runtime === 'web') return false;

    const now = Date.now();
    if (!force && this.lastAppOpenAt > 0 && now - this.lastAppOpenAt < APP_OPEN_COOLDOWN_MS) {
      return false;
    }

    try {
      if (runtime === 'capacitor') {
        const plugin = window.Capacitor?.Plugins?.AdMob;
        await plugin?.showAppOpenAd?.();
        this.lastAppOpenAt = now;
        void plugin?.prepareAppOpenAd?.({ adId: config.appOpenId });
        return true;
      }

      if (runtime === 'android-webview') {
        const bridge = window.AndroidAdMob || window.AdMob;
        bridge?.showAppOpen?.(config.appOpenId);
        this.lastAppOpenAt = now;
        bridge?.loadAppOpen?.(config.appOpenId);
        return true;
      }
    } catch {
      return false;
    }

    return false;
  }

  public async showNativeAd(placement: string = 'feed'): Promise<void> {
    const config = storage.getAdMobConfig();
    const runtime = this.detectRuntime();
    if (!config.nativeAdvancedId || runtime === 'web') return;

    try {
      if (runtime === 'capacitor') {
        await window.Capacitor?.Plugins?.AdMob?.showNativeAd?.({
          adId: config.nativeAdvancedId,
          placement,
        });
      } else if (runtime === 'android-webview') {
        (window.AndroidAdMob || window.AdMob)?.showNativeAd?.(config.nativeAdvancedId, placement);
      }
    } catch {
      // Ignore bridge error
    }
  }

  public async hideNativeAd(): Promise<void> {
    const runtime = this.detectRuntime();
    if (runtime === 'web') return;

    try {
      if (runtime === 'capacitor') {
        await window.Capacitor?.Plugins?.AdMob?.hideNativeAd?.();
      } else if (runtime === 'android-webview') {
        (window.AndroidAdMob || window.AdMob)?.hideNativeAd?.();
      }
    } catch {
      // Ignore bridge error
    }
  }

  public recordGameCompleted(): void {
    this.gamesCompletedSinceAd += 1;
  }

  public getInterstitialCooldownRemaining(): number {
    const config = storage.getAdMobConfig();
    if (this.lastInterstitialAt === 0) return 0;
    const elapsedSec = (Date.now() - this.lastInterstitialAt) / 1000;
    return Math.max(0, Math.ceil(config.interstitialCooldownSec - elapsedSec));
  }

  public async showInterstitialIfReady(force: boolean = false): Promise<boolean> {
    const config = storage.getAdMobConfig();
    if (!config.interstitialId) return false;

    if (!force) {
      if (this.gamesCompletedSinceAd < 1 || this.getInterstitialCooldownRemaining() > 0) {
        return false;
      }
    }

    const runtime = this.detectRuntime();
    if (runtime === 'web') {
      return false;
    }

    try {
      if (runtime === 'capacitor') {
        const plugin = window.Capacitor?.Plugins?.AdMob;
        await plugin?.showInterstitial?.();
        this.lastInterstitialAt = Date.now();
        this.gamesCompletedSinceAd = 0;
        void plugin?.prepareInterstitial?.({ adId: config.interstitialId });
        return true;
      }

      if (runtime === 'android-webview') {
        const bridge = window.AndroidAdMob || window.AdMob;
        bridge?.showInterstitial?.(config.interstitialId);
        this.lastInterstitialAt = Date.now();
        this.gamesCompletedSinceAd = 0;
        bridge?.loadInterstitial?.(config.interstitialId);
        return true;
      }

      if (runtime === 'cordova') {
        await window.admob?.interstitial?.show?.();
        this.lastInterstitialAt = Date.now();
        this.gamesCompletedSinceAd = 0;
        void window.admob?.interstitial?.prepare?.();
        return true;
      }
    } catch {
      return false;
    }

    return false;
  }

  public async showRewardedAd(): Promise<RewardedInterstitialResult> {
    const config = storage.getAdMobConfig();
    const runtime = this.detectRuntime();
    if (runtime === 'web') {
      return { rewarded: false, status: 'unavailable' };
    }

    if (config.rewardedId) {
      try {
        if (runtime === 'capacitor') {
          const plugin = window.Capacitor?.Plugins?.AdMob;
          if (plugin?.showRewardVideoAd) {
            const reward = await plugin.showRewardVideoAd();
            void plugin.prepareRewardVideoAd?.({ adId: config.rewardedId });
            return reward ? { rewarded: true, status: 'rewarded' } : { rewarded: false, status: 'dismissed' };
          }
        } else if (runtime === 'android-webview') {
          const bridge = window.AndroidAdMob || window.AdMob;
          if (bridge?.showRewarded) {
            return await new Promise<RewardedInterstitialResult>((resolve) => {
              let settled = false;
              const finish = (res: RewardedInterstitialResult) => {
                if (settled) return;
                settled = true;
                window.onAdMobRewarded = undefined;
                bridge.loadRewarded?.(config.rewardedId);
                resolve(res);
              };

              const timer = window.setTimeout(() => {
                finish({ rewarded: false, status: 'unavailable' });
              }, 45000);

              window.onAdMobRewarded = (rewarded: boolean) => {
                window.clearTimeout(timer);
                finish({ rewarded, status: rewarded ? 'rewarded' : 'dismissed' });
              };

              const immediate = bridge.showRewarded?.(config.rewardedId);
              if (immediate === false) {
                window.clearTimeout(timer);
                finish({ rewarded: false, status: 'unavailable' });
              }
            });
          }
        } else if (runtime === 'cordova') {
          await window.admob?.rewardvideo?.show?.();
          void window.admob?.rewardvideo?.prepare?.();
          return { rewarded: true, status: 'rewarded' };
        }
      } catch {
        // Fall through to rewarded interstitial if configured
      }
    }

    return this.showRewardedInterstitial();
  }

  public async showRewardedInterstitial(): Promise<RewardedInterstitialResult> {
    const config = storage.getAdMobConfig();
    const runtime = this.detectRuntime();

    if (!config.rewardedInterstitialId || runtime === 'web') {
      return { rewarded: false, status: 'unavailable' };
    }

    try {
      if (runtime === 'capacitor') {
        const plugin = window.Capacitor?.Plugins?.AdMob;
        if (plugin?.showRewardInterstitialAd) {
          const reward = await plugin.showRewardInterstitialAd();
          void plugin.prepareRewardInterstitialAd?.({ adId: config.rewardedInterstitialId });
          return reward ? { rewarded: true, status: 'rewarded' } : { rewarded: false, status: 'dismissed' };
        }
        if (plugin?.showRewardVideoAd) {
          const reward = await plugin.showRewardVideoAd();
          void plugin.prepareRewardVideoAd?.({ adId: config.rewardedInterstitialId });
          return reward ? { rewarded: true, status: 'rewarded' } : { rewarded: false, status: 'dismissed' };
        }
        return { rewarded: false, status: 'unavailable' };
      }

      if (runtime === 'android-webview') {
        const bridge = window.AndroidAdMob || window.AdMob;
        if (!bridge?.showRewardedInterstitial) {
          return { rewarded: false, status: 'unavailable' };
        }

        return await new Promise<RewardedInterstitialResult>((resolve) => {
          let settled = false;
          const finish = (res: RewardedInterstitialResult) => {
            if (settled) return;
            settled = true;
            window.onAdMobRewarded = undefined;
            bridge.loadRewardedInterstitial?.(config.rewardedInterstitialId);
            resolve(res);
          };

          const timer = window.setTimeout(() => {
            finish({ rewarded: false, status: 'unavailable' });
          }, 45000);

          window.onAdMobRewarded = (rewarded: boolean) => {
            window.clearTimeout(timer);
            finish({ rewarded, status: rewarded ? 'rewarded' : 'dismissed' });
          };

          const immediate = bridge.showRewardedInterstitial?.(config.rewardedInterstitialId);
          if (immediate === false) {
            window.clearTimeout(timer);
            finish({ rewarded: false, status: 'unavailable' });
          }
        });
      }

      if (runtime === 'cordova') {
        await window.admob?.rewardvideo?.show?.();
        void window.admob?.rewardvideo?.prepare?.();
        return { rewarded: true, status: 'rewarded' };
      }
    } catch {
      return { rewarded: false, status: 'unavailable' };
    }

    return { rewarded: false, status: 'unavailable' };
  }

  public async refreshBanner(): Promise<void> {
    const config = storage.getAdMobConfig();
    const runtime = this.detectRuntime();
    if (runtime === 'web') return;

    try {
      if (!config.bannerId) {
        if (runtime === 'capacitor') await window.Capacitor?.Plugins?.AdMob?.hideBanner?.();
        if (runtime === 'android-webview') (window.AndroidAdMob || window.AdMob)?.hideBanner?.();
        if (runtime === 'cordova') await window.admob?.banner?.hide?.();
        return;
      }

      if (runtime === 'capacitor') {
        await window.Capacitor?.Plugins?.AdMob?.showBanner?.({
          adId: config.bannerId,
          adSize: 'ADAPTIVE_BANNER',
          position: 'BOTTOM_CENTER',
          margin: 60,
        });
      } else if (runtime === 'android-webview') {
        (window.AndroidAdMob || window.AdMob)?.showBanner?.(config.bannerId, 'bottom');
      } else if (runtime === 'cordova') {
        window.admob?.banner?.config?.({ id: config.bannerId, autoShow: true, position: 'bottom' });
        await window.admob?.banner?.prepare?.();
      }
    } catch {
      // Ignore bridge errors
    }
  }
}

export const admobService = new AdMobService();
