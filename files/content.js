// デバッグ版 - Twitchページから配信情報を取得するコンテンツスクリプト

let streamInfo = {};
let hlsUrls = [];
let isMonitoring = false;
let debugInfo = [];

// デバッグログ関数
function debugLog(message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, message, data };
  debugInfo.push(logEntry);
  console.log(`[Twitch Saver Debug] ${message}`, data);
}

// ページロード時の初期化
function initialize() {
  debugLog('Initializing content script...');
  debugLog('Current URL:', window.location.href);
  debugLog('Page title:', document.title);
  
  // 配信情報の取得
  extractStreamInfo();
  
  // HLS URLの監視開始
  startHLSMonitoring();
  
  // DOM変更の監視
  const observer = new MutationObserver(() => {
    extractStreamInfo();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  debugLog('Initialization complete');
}

// 配信情報の抽出
function extractStreamInfo() {
  try {
    debugLog('Extracting stream info...');
    
    // チャンネル名（URLから取得）
    const pathParts = window.location.pathname.split('/');
    const channelName = pathParts[1];
    debugLog('Channel name from URL:', channelName);
    
    // DOM要素から情報を取得
    const selectors = {
      channelName: [
        '[data-a-target="channel-name"]',
        'h1[data-a-target="stream-title"]',
        '[data-a-target="user-display-name"]',
        '[data-a-target="channel-header-displayname"]'
      ],
      title: [
        '[data-a-target="stream-title"]',
        'h2[data-a-target="stream-title"]',
        '[data-a-target="channel-title"]'
      ],
      viewerCount: [
        '[data-a-target="animated-channel-viewers-count"]',
        '[data-a-target="channel-viewers-count"]',
        '.live-indicator-container [data-a-target="animated-channel-viewers-count"]'
      ],
      category: [
        '[data-a-target="stream-game-link"]',
        'a[data-a-target="stream-game-link"]'
      ]
    };
    
    // 各セレクターをテスト
    for (const [key, selectorList] of Object.entries(selectors)) {
      for (const selector of selectorList) {
        const element = document.querySelector(selector);
        if (element) {
          debugLog(`Found ${key} element:`, {
            selector: selector,
            text: element.textContent.trim()
          });
          break;
        }
      }
    }
    
    // 配信状態の確認
    const liveIndicators = [
      '[data-a-target="animated-channel-viewers-count"]',
      '[data-a-target="channel-viewers-count"]',
      '.live-indicator',
      '[data-test-selector="live-indicator"]',
      '[data-a-target="player-overlay-click-handler"]'
    ];
    
    let isLive = false;
    for (const selector of liveIndicators) {
      const element = document.querySelector(selector);
      if (element) {
        isLive = true;
        debugLog('Live indicator found:', selector);
        break;
      }
    }
    
    // Video要素の確認
    const videoElements = document.querySelectorAll('video');
    debugLog('Video elements found:', videoElements.length);
    videoElements.forEach((video, index) => {
      debugLog(`Video ${index}:`, {
        src: video.src,
        readyState: video.readyState,
        duration: video.duration,
        paused: video.paused
      });
    });
    
    streamInfo = {
      channelName: channelName,
      title: document.querySelector('[data-a-target="stream-title"]')?.textContent.trim() || '',
      viewerCount: document.querySelector('[data-a-target="animated-channel-viewers-count"]')?.textContent.trim() || '',
      category: document.querySelector('[data-a-target="stream-game-link"]')?.textContent.trim() || '',
      isLive: isLive,
      hasVideo: videoElements.length > 0
    };
    
    debugLog('Stream info extracted:', streamInfo);
    
  } catch (error) {
    debugLog('Error extracting stream info:', error);
  }
}

// HLS URL監視の開始
function startHLSMonitoring() {
  if (isMonitoring) return;
  
  isMonitoring = true;
  debugLog('Starting HLS monitoring...');
  
  // 注入スクリプトを追加
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      console.log('[Injected Script] Starting network monitoring...');
      
      const originalXHR = window.XMLHttpRequest;
      const originalFetch = window.fetch;
      
      // XMLHttpRequestの監視
      window.XMLHttpRequest = function() {
        const xhr = new originalXHR();
        const originalOpen = xhr.open;
        
        xhr.open = function(method, url, ...args) {
          this._url = url;
          this._method = method;
          
          if (url && (url.includes('usher.ttvnw.net') || url.includes('.m3u8') || url.includes('hls.ttvnw.net'))) {
            console.log('[Injected Script] HLS-related XHR detected:', method, url);
            
            this.addEventListener('readystatechange', function() {
              if (this.readyState === 4) {
                console.log('[Injected Script] XHR Response:', this.status, this.responseText?.substring(0, 200));
                if (this.status === 200) {
                  window.postMessage({
                    type: 'HLS_URL_DETECTED',
                    method: 'XHR',
                    url: url,
                    response: this.responseText,
                    status: this.status
                  }, '*');
                }
              }
            });
          }
          
          return originalOpen.apply(this, [method, url, ...args]);
        };
        
        return xhr;
      };
      
      // fetchの監視
      window.fetch = function(url, ...args) {
        if (url && (url.includes('usher.ttvnw.net') || url.includes('.m3u8') || url.includes('hls.ttvnw.net'))) {
          console.log('[Injected Script] HLS-related fetch detected:', url);
          
          return originalFetch(url, ...args).then(response => {
            console.log('[Injected Script] Fetch response:', response.status, response.statusText);
            if (response.ok) {
              response.clone().text().then(text => {
                console.log('[Injected Script] Fetch response text:', text.substring(0, 200));
                window.postMessage({
                  type: 'HLS_URL_DETECTED',
                  method: 'fetch',
                  url: url,
                  response: text,
                  status: response.status
                }, '*');
              });
            }
            return response;
          });
        }
        return originalFetch(url, ...args);
      };
      
      // 全てのネットワークリクエストをログ
      const originalSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function(...args) {
        if (this._url) {
          console.log('[Injected Script] All XHR:', this._method, this._url);
        }
        return originalSend.apply(this, args);
      };
      
      console.log('[Injected Script] Network monitoring setup complete');
    })();
  `;
  
  document.head.appendChild(script);
  debugLog('Injected script added');
  
  // メッセージリスナー
  window.addEventListener('message', function(event) {
    if (event.data.type === 'HLS_URL_DETECTED') {
      debugLog('HLS URL detected via message:', event.data);
      hlsUrls.push({
        url: event.data.url,
        response: event.data.response,
        method: event.data.method,
        status: event.data.status,
        timestamp: Date.now()
      });
    }
  });
}

// 簡単なHLS URL生成（テスト用）
function generateHLSUrl(channelName, quality = 'best') {
  const baseUrl = 'https://usher.ttvnw.net/api/channel/hls/' + channelName + '.m3u8';
  const params = new URLSearchParams({
    allow_source: 'true',
    allow_audio_only: 'true',
    allow_spectre: 'false',
    player: 'twitchweb',
    segment_preference: '4',
    sig: generateRandomHex(40),
    token: generateRandomHex(40),
    p: Math.floor(Math.random() * 999999).toString(),
    type: 'any',
    fast_bread: 'true'
  });
  
  return baseUrl + '?' + params.toString();
}

// ランダムHEX文字列生成
function generateRandomHex(length) {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// HLS URLの取得（改良版）
async function getHLSUrl(quality = 'best') {
  try {
    debugLog('Starting HLS URL capture...', { quality });
    
    const channelName = streamInfo.channelName;
    debugLog('Channel name:', channelName);
    
    if (!channelName) {
      throw new Error('チャンネル名が取得できません');
    }
    
    // 配信状態の確認
    debugLog('Stream info check:', streamInfo);
    
    if (!streamInfo.isLive && !streamInfo.hasVideo) {
      // より詳細なチェック
      const videoCheck = document.querySelector('video');
      const liveCheck = document.querySelector('[data-a-target="animated-channel-viewers-count"]');
      
      debugLog('Detailed live check:', {
        hasVideo: !!videoCheck,
        hasLiveIndicator: !!liveCheck,
        videoSrc: videoCheck?.src,
        videoReadyState: videoCheck?.readyState
      });
      
      if (!videoCheck && !liveCheck) {
        throw new Error('配信が行われていません');
      }
    }
    
    // 検出されたHLS URLがあるかチェック
    debugLog('Detected HLS URLs:', hlsUrls);
    
    if (hlsUrls.length > 0) {
      const latestHLS = hlsUrls[hlsUrls.length - 1];
      debugLog('Using detected HLS URL:', latestHLS);
      
      return {
        url: latestHLS.url,
        channelName: channelName,
        streamInfo: streamInfo,
        quality: quality,
        source: 'detected'
      };
    }
    
    // 生成されたHLS URLを使用
    const generatedUrl = generateHLSUrl(channelName, quality);
    debugLog('Generated HLS URL:', generatedUrl);
    
    return {
      url: generatedUrl,
      channelName: channelName,
      streamInfo: streamInfo,
      quality: quality,
      source: 'generated'
    };
    
  } catch (error) {
    debugLog('HLS URL capture error:', error);
    throw error;
  }
}

// デバッグ情報の取得
function getDebugInfo() {
  return {
    debugInfo: debugInfo,
    streamInfo: streamInfo,
    hlsUrls: hlsUrls,
    currentUrl: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString()
  };
}

// メッセージリスナー
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  debugLog('Message received:', request);
  
  if (request.action === 'getStreamInfo') {
    extractStreamInfo();
    sendResponse({streamInfo: streamInfo});
  } else if (request.action === 'getDebugInfo') {
    sendResponse(getDebugInfo());
  } else if (request.action === 'captureStream') {
    debugLog('Capturing stream with quality:', request.quality);
    
    getHLSUrl(request.quality).then(result => {
      debugLog('Stream capture successful:', result);
      sendResponse({
        success: true,
        streamData: result,
        debug: getDebugInfo()
      });
    }).catch(error => {
      debugLog('Stream capture error:', error);
      sendResponse({
        success: false,
        error: error.message,
        debug: getDebugInfo()
      });
    });
    
    return true; // 非同期レスポンスを示す
  }
});

// 初期化実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// ページが完全に読み込まれた後に再度初期化
window.addEventListener('load', () => {
  setTimeout(initialize, 2000);
});

debugLog('Content script loaded');