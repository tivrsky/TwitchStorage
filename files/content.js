// Twitchページから配信情報を取得するコンテンツスクリプト

let streamInfo = {};
let hlsUrl = null;

// ページロード時の初期化
function initialize() {
  // 配信情報の取得
  extractStreamInfo();
  
  // HLS URLの監視
  interceptNetworkRequests();
  
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
    // チャンネル名
    const channelNameEl = document.querySelector('[data-a-target="channel-name"]') || 
                          document.querySelector('h1[data-a-target="stream-title"]');
    streamInfo.channelName = channelNameEl ? channelNameEl.textContent.trim() : '';
    
    // 配信タイトル
    const titleEl = document.querySelector('[data-a-target="stream-title"]');
    streamInfo.title = titleEl ? titleEl.textContent.trim() : '';
    
    // 視聴者数
    const viewerEl = document.querySelector('[data-a-target="animated-channel-viewers-count"]');
    streamInfo.viewerCount = viewerEl ? viewerEl.textContent.trim() : '';
    
    // カテゴリ
    const categoryEl = document.querySelector('[data-a-target="stream-game-link"]');
    streamInfo.category = categoryEl ? categoryEl.textContent.trim() : '';
    
    // 配信者のアバター
    const avatarEl = document.querySelector('[data-a-target="channel-header-avatar"] img');
    streamInfo.avatar = avatarEl ? avatarEl.src : '';
    
  } catch (error) {
    console.error('配信情報の取得に失敗:', error);
  }
}

// ネットワークリクエストの監視
function interceptNetworkRequests() {
  // XHRとfetchの監視
  const originalXHR = window.XMLHttpRequest;
  const originalFetch = window.fetch;
  
  // XHRの監視
  window.XMLHttpRequest = function() {
    const xhr = new originalXHR();
    const originalOpen = xhr.open;
    
    xhr.open = function(method, url, ...args) {
      if (url.includes('usher.ttvnw.net') || url.includes('.m3u8')) {
        xhr.addEventListener('load', function() {
          if (this.responseText && this.responseText.includes('#EXTM3U')) {
            hlsUrl = url;
            console.log('HLS URL detected:', hlsUrl);
          }
        });
      }
      return originalOpen.apply(this, [method, url, ...args]);
    };
    
    return xhr;
  };
  
  // fetchの監視
  window.fetch = function(url, ...args) {
    if (url.includes('usher.ttvnw.net') || url.includes('.m3u8')) {
      return originalFetch(url, ...args).then(response => {
        if (response.ok) {
          hlsUrl = url;
          console.log('HLS URL detected via fetch:', hlsUrl);
        }
        return response;
      });
    }
    return originalFetch(url, ...args);
  };
}

// HLS URLの取得
async function getHLSUrl(quality = 'best') {
  try {
    const channelName = window.location.pathname.split('/')[1];
    if (!channelName) return null;
    
    // Twitch APIからHLS URLを取得
    const tokenResponse = await fetch(`https://id.twitch.tv/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'client_id': 'kd1unb4b3q4t58fwlpcbzcbnm76a8fp',
        'client_secret': 'x8f2w8y6z9a5b7c3d1e4f6g8h0i2j4k6',
        'grant_type': 'client_credentials'
      })
    });
    
    if (!tokenResponse.ok) {
      throw new Error('トークンの取得に失敗');
    }
    
    const tokenData = await tokenResponse.json();
    
    // 配信情報の取得
    const streamResponse = await fetch(`https://api.twitch.tv/helix/streams?user_login=${channelName}`, {
      headers: {
        'Client-ID': 'kd1unb4b3q4t58fwlpcbzcbnm76a8fp',
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });
    
    if (!streamResponse.ok) {
      throw new Error('配信情報の取得に失敗');
    }
    
    const streamData = await streamResponse.json();
    
    if (streamData.data && streamData.data.length > 0) {
      // HLS URLを構築
      const playlistUrl = `https://usher.ttvnw.net/api/channel/hls/${channelName}.m3u8`;
      return {
        url: playlistUrl,
        channelName: channelName,
        streamData: streamData.data[0]
      };
    }
    
    return null;
  } catch (error) {
    console.error('HLS URLの取得エラー:', error);
    return null;
  }
}

// メッセージリスナー
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'getStreamInfo') {
    extractStreamInfo();
    sendResponse({streamInfo: streamInfo});
  } else if (request.action === 'captureStream') {
    getHLSUrl(request.quality).then(result => {
      if (result) {
        sendResponse({
          success: true,
          streamData: result
        });
      } else {
        sendResponse({success: false});
      }
    }).catch(error => {
      console.error('配信キャプチャエラー:', error);
      sendResponse({success: false});
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