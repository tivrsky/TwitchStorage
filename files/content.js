// Twitchページから配信情報を取得するコンテンツスクリプト

let streamInfo = {};
let hlsUrls = [];
let isMonitoring = false;

// ページロード時の初期化
function initialize() {
  extractStreamInfo();
  startHLSMonitoring();
  
  // DOM変更の監視
  const observer = new MutationObserver(() => {
    extractStreamInfo();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// 配信情報の抽出
function extractStreamInfo() {
  try {
    // チャンネル名（URLから取得）
    const pathParts = window.location.pathname.split('/');
    const channelName = pathParts[1];
    
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
        break;
      }
    }
    
    // Video要素の確認
    const videoElements = document.querySelectorAll('video');
    
    streamInfo = {
      channelName: channelName,
      title: document.querySelector('[data-a-target="stream-title"]')?.textContent.trim() || '',
      viewerCount: document.querySelector('[data-a-target="animated-channel-viewers-count"]')?.textContent.trim() || '',
      category: document.querySelector('[data-a-target="stream-game-link"]')?.textContent.trim() || '',
      isLive: isLive,
      hasVideo: videoElements.length > 0
    };
    
  } catch (error) {
    console.error('配信情報取得エラー:', error);
  }
}

// HLS URL監視の開始
function startHLSMonitoring() {
  if (isMonitoring) return;
  
  isMonitoring = true;
  
  // 注入スクリプトを追加
  const script = document.createElement('script');
  script.textContent = `
    (function() {
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
            this.addEventListener('readystatechange', function() {
              if (this.readyState === 4 && this.status === 200) {
                window.postMessage({
                  type: 'HLS_URL_DETECTED',
                  method: 'XHR',
                  url: url,
                  response: this.responseText,
                  status: this.status
                }, '*');
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
          return originalFetch(url, ...args).then(response => {
            if (response.ok) {
              response.clone().text().then(text => {
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
    })();
  `;
  
  document.head.appendChild(script);
  
  // メッセージリスナー
  window.addEventListener('message', function(event) {
    if (event.data.type === 'HLS_URL_DETECTED') {
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

// HLS URL生成
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

// HLS URLの取得
async function getHLSUrl(quality = 'best') {
  try {
    const channelName = streamInfo.channelName;
    
    if (!channelName) {
      throw new Error('チャンネル名が取得できません');
    }
    
    // 配信状態の確認
    if (!streamInfo.isLive && !streamInfo.hasVideo) {
      const videoCheck = document.querySelector('video');
      const liveCheck = document.querySelector('[data-a-target="animated-channel-viewers-count"]');
      
      if (!videoCheck && !liveCheck) {
        throw new Error('配信が行われていません');
      }
    }
    
    // 検出されたHLS URLがあるかチェック
    if (hlsUrls.length > 0) {
      const latestHLS = hlsUrls[hlsUrls.length - 1];
      
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
    
    return {
      url: generatedUrl,
      channelName: channelName,
      streamInfo: streamInfo,
      quality: quality,
      source: 'generated'
    };
    
  } catch (error) {
    throw error;
  }
}

// メッセージリスナー
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'getStreamInfo') {
    extractStreamInfo();
    sendResponse({streamInfo: streamInfo});
  } else if (request.action === 'captureStream') {
    getHLSUrl(request.quality).then(result => {
      sendResponse({
        success: true,
        streamData: result
      });
    }).catch(error => {
      sendResponse({
        success: false,
        error: error.message
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