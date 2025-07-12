// バックグラウンドスクリプト - 録画処理とダウンロード管理

let recordingState = {
  isRecording: false,
  streamData: null,
  chunks: [],
  downloadId: null
};

// 拡張機能のインストール時
chrome.runtime.onInstalled.addListener(() => {
  console.log('Twitch Stream Saver installed');
});

// メッセージリスナー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'startRecording':
      startRecording(request.streamData);
      break;
    case 'stopRecording':
      stopRecording();
      break;
    case 'getRecordingStatus':
      sendResponse({
        isRecording: recordingState.isRecording,
        streamData: recordingState.streamData
      });
      break;
  }
});

// 録画開始
async function startRecording(streamData) {
  try {
    recordingState.isRecording = true;
    recordingState.streamData = streamData;
    recordingState.chunks = [];
    
    console.log('録画開始:', streamData);
    
    // HLS ストリームの処理
    if (streamData.url) {
      await downloadHLSStream(streamData);
    }
    
  } catch (error) {
    console.error('録画開始エラー:', error);
    recordingState.isRecording = false;
    notifyRecordingStatus('error');
  }
}

// 録画停止
function stopRecording() {
  recordingState.isRecording = false;
  
  if (recordingState.downloadId) {
    chrome.downloads.cancel(recordingState.downloadId);
  }
  
  console.log('録画停止');
  notifyRecordingStatus('stopped');
}

// HLS ストリームのダウンロード
async function downloadHLSStream(streamData) {
  try {
    const response = await fetch(streamData.url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const playlist = await response.text();
    const segments = parseM3U8(playlist);
    
    if (segments.length === 0) {
      throw new Error('セグメントが見つかりません');
    }
    
    // 最初のセグメントをダウンロード（テスト用）
    const firstSegment = segments[0];
    const segmentUrl = resolveURL(streamData.url, firstSegment);
    
    // ダウンロード開始
    const filename = generateFilename(streamData);
    
    chrome.downloads.download({
      url: segmentUrl,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('ダウンロードエラー:', chrome.runtime.lastError);
        notifyRecordingStatus('error');
      } else {
        recordingState.downloadId = downloadId;
        console.log('ダウンロード開始:', downloadId);
        notifyRecordingStatus('started');
      }
    });
    
  } catch (error) {
    console.error('HLS ダウンロードエラー:', error);
    notifyRecordingStatus('error');
  }
}

// M3U8プレイリストの解析
function parseM3U8(playlist) {
  const lines = playlist.split('\n');
  const segments = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line && !line.startsWith('#')) {
      segments.push(line);
    }
  }
  
  return segments;
}

// 相対URLの解決
function resolveURL(baseUrl, relativePath) {
  if (relativePath.startsWith('http')) {
    return relativePath;
  }
  
  const base = new URL(baseUrl);
  return new URL(relativePath, base).href;
}

// ファイル名の生成
function generateFilename(streamData) {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const channelName = streamData.channelName || 'unknown';
  
  return `twitch-${channelName}-${timestamp}.ts`;
}

// 録画状態の通知
function notifyRecordingStatus(status) {
  chrome.runtime.sendMessage({
    action: 'recordingStatus',
    status: status
  }).catch(() => {
    // ポップアップが閉じられている場合はエラーを無視
  });
}

// ダウンロード完了の監視
chrome.downloads.onChanged.addListener((delta) => {
  if (delta.id === recordingState.downloadId) {
    if (delta.state && delta.state.current === 'complete') {
      console.log('ダウンロード完了');
      recordingState.isRecording = false;
      notifyRecordingStatus('completed');
    } else if (delta.state && delta.state.current === 'interrupted') {
      console.log('ダウンロード中断');
      recordingState.isRecording = false;
      notifyRecordingStatus('error');
    }
  }
});

// Webリクエストの監視（HLS URLの検出）
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    if (details.url.includes('.m3u8') || details.url.includes('usher.ttvnw.net')) {
      console.log('HLS URL detected:', details.url);
      
      // アクティブなタブに通知
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'hlsUrlDetected',
            url: details.url
          }).catch(() => {
            // コンテンツスクリプトが読み込まれていない場合はエラーを無視
          });
        }
      });
    }
  },
  {urls: ["https://usher.ttvnw.net/*", "https://*.hls.ttvnw.net/*"]},
  ["requestBody"]
);

// アラーム設定（定期的な処理用）
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkRecording') {
    if (recordingState.isRecording) {
      console.log('録画状態チェック:', recordingState);
    }
  }
});

// 定期チェックの設定
chrome.alarms.create('checkRecording', {
  delayInMinutes: 1,
  periodInMinutes: 1
});