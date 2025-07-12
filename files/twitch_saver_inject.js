// Twitchページに注入されるスクリプト
// ページの実行コンテキストでネットワークリクエストを監視

(function() {
  'use strict';
  
  // HLS URLを検出するためのフック
  const originalXHR = window.XMLHttpRequest;
  const originalFetch = window.fetch;
  
  // 検出されたHLS URLを保存
  let detectedHLSUrls = [];
  
  // XMLHttpRequestの監視
  window.XMLHttpRequest = function() {
    const xhr = new originalXHR();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    
    xhr.open = function(method, url, ...args) {
      this._url = url;
      return originalOpen.apply(this, [method, url, ...args]);
    };
    
    xhr.send = function(...args) {
      const url = this._url;
      
      // HLS関連のURLを検出
      if (url && (url.includes('usher.ttvnw.net') || url.includes('.m3u8'))) {
        this.addEventListener('load', function() {
          if (this.status === 200) {
            const contentType = this.getResponseHeader('content-type');
            if (contentType && (contentType.includes('application/vnd.apple.mpegurl') || contentType.includes('application/x-mpegURL'))) {
              console.log('HLS Playlist detected:', url);
              detectedHLSUrls.push({
                url: url,
                response: this.responseText,
                timestamp: Date.now()
              });
              
              // カスタムイベントを発火
              window.dispatchEvent(new CustomEvent('hlsUrlDetected', {
                detail: {
                  url: url,
                  playlist: this.responseText
                }
              }));
            }
          }
        });
      }
      
      return originalSend.apply(this, args);
    };
    
    return xhr;
  };
  
  // fetchの監視
  window.fetch = function(url, ...args) {
    if (url && (url.includes('usher.ttvnw.net') || url.includes('.m3u8'))) {
      return originalFetch(url, ...args).then(response => {
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && (contentType.includes('application/vnd.apple.mpegurl') || contentType.includes('application/x-mpegURL'))) {
            console.log('HLS Playlist detected via fetch:', url);
            
            // レスポンスをクローンして読み取り
            const clonedResponse = response.clone();
            clonedResponse.text().then(text => {
              detectedHLSUrls.push({
                url: url,
                response: text,
                timestamp: Date.now()
              });
              
              // カスタムイベントを発火
              window.dispatchEvent(new CustomEvent('hlsUrlDetected', {
                detail: {
                  url: url,
                  playlist: text
                }
              }));
            });
          }
        }
        return response;
      });
    }
    return originalFetch(url, ...args);
  };
  
  // Twitch Player APIの監視
  function monitorTwitchPlayer() {
    // Twitch プレイヤーの存在を確認
    const checkPlayer = setInterval(() => {
      if (window.Twitch && window.Twitch.Player) {
        console.log('Twitch Player API detected');
        clearInterval(checkPlayer);
        
        // プレイヤーイベントの監視
        try {
          const playerContainer = document.querySelector('[data-a-target="player-overlay-click-handler"]');
          if (playerContainer) {
            const observer = new MutationObserver(() => {
              // プレイヤーの状態変更を監視
              checkForVideoElement();
            });
            observer.observe(playerContainer, {
              childList: true,
              subtree: true
            });
          }
        } catch (error) {
          console.error('プレイヤー監視エラー:', error);
        }
      }
    }, 1000);
    
    // 10秒後にタイムアウト
    setTimeout(() => {
      clearInterval(checkPlayer);
    }, 10000);
  }
  
  // videoエレメントの検出
  function checkForVideoElement() {
    const videoElements = document.querySelectorAll('video');
    videoElements.forEach(video => {
      if (video.src && !video.dataset.monitored) {
        video.dataset.monitored = 'true';
        console.log('Video element detected:', video.src);
        
        // video要素のイベントリスナー
        video.addEventListener('loadstart', () => {
          console.log('Video loadstart:', video.src);
        });
        
        video.addEventListener('canplay', () => {
          console.log('Video canplay:', video.src);
          
          // HLS URLの推定
          if (video.src.includes('blob:')) {
            // blob URLの場合、元のHLS URLを推定
            const channelName = window.location.pathname.split('/')[1];
            if (channelName) {
              const estimatedHLSUrl = `https://usher.ttvnw.net/api/channel/hls/${channelName}.m3u8`;
              window.dispatchEvent(new CustomEvent('hlsUrlDetected', {
                detail: {
                  url: estimatedHLSUrl,
                  playlist: null,
                  estimated: true
                }
              }));
            }
          }
        });
      }
    });
  }
  
  // 検出されたHLS URLを取得する関数
  window.getDetectedHLSUrls = function() {
    return detectedHLSUrls;
  };
  
  // 最新のHLS URLを取得する関数
  window.getLatestHLSUrl = function() {
    if (detectedHLSUrls.length > 0) {
      return detectedHLSUrls[detectedHLSUrls.length - 1];
    }
    return null;
  };
  
  // HLS URLをクリアする関数
  window.clearDetectedHLSUrls = function() {
    detectedHLSUrls = [];
  };
  
  // 配信情報を取得する関数
  window.getStreamInfo = function() {
    try {
      const info = {};
      
      // チャンネル名
      const channelEl = document.querySelector('[data-a-target="channel-name"]');
      info.channelName = channelEl ? channelEl.textContent.trim() : '';
      
      // 配信タイトル
      const titleEl = document.querySelector('[data-a-target="stream-title"]');
      info.title = titleEl ? titleEl.textContent.trim() : '';
      
      // 視聴者数
      const viewerEl = document.querySelector('[data-a-target="animated-channel-viewers-count"]');
      info.viewerCount = viewerEl ? viewerEl.textContent.trim() : '';
      
      // カテゴリ
      const categoryEl = document.querySelector('[data-a-target="stream-game-link"]');
      info.category = categoryEl ? categoryEl.textContent.trim() : '';
      
      // 配信開始時刻の推定
      const timeEl = document.querySelector('[data-a-target="player-streamtime"]');
      info.streamTime = timeEl ? timeEl.textContent.trim() : '';
      
      return info;
    } catch (error) {
      console.error('配信情報取得エラー:', error);
      return {};
    }
  };
  
  // 初期化
  monitorTwitchPlayer();
  checkForVideoElement();
  
  // 定期的にvideo要素をチェック
  setInterval(checkForVideoElement, 3000);
  
  console.log('Twitch Stream Saver inject script loaded');
  
})();