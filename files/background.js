// バックグラウンドスクリプト - 録画処理とダウンロード管理

let recordingState = {
  isRecording: false,
  streamData: null,
  chunks: [],
  downloadId: null,
  settings: {
    saveFormat: 'ts', // ts, mp4
    quality: 'best',
    duration: 0, // 0 = 無制限、その他は分単位
    saveLocation: 'downloads'
  }
};

// 拡張機能のインストール時
chrome.runtime.onInstalled.addListener(() => {
  // 設定を初期化
  chrome.storage.sync.get(['saverSettings'], function(result) {
    if (result.saverSettings) {
      recordingState.settings = { ...recordingState.settings, ...result.saverSettings };
    }
  });
});

// メッセージリスナー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'startRecording':
      startRecording(request.streamData, request.settings);
      break;
    case 'stopRecording':
      stopRecording();
      break;
    case 'getRecordingStatus':
      sendResponse({
        isRecording: recordingState.isRecording,
        streamData: recordingState.streamData,
        settings: recordingState.settings
      });
      break;
    case 'updateSettings':
      updateSettings(request.settings);
      sendResponse({success: true});
      break;
    case 'getSettings':
      sendResponse({settings: recordingState.settings});
      break;
  }
});

// 設定更新
function updateSettings(newSettings) {
  recordingState.settings = { ...recordingState.settings, ...newSettings };
  chrome.storage.sync.set({ saverSettings: recordingState.settings });
}

// 録画開始
async function startRecording(streamData, settings = {}) {
  try {
    recordingState.isRecording = true;
    recordingState.streamData = streamData;
    recordingState.chunks = [];
    
    // 設定を更新
    if (settings) {
      recordingState.settings = { ...recordingState.settings, ...settings };
    }
    
    // HLS ストリームの処理
    if (streamData.url) {
      await downloadHLSStream(streamData);
    }
    
  } catch (error) {
    console.error('録画開始エラー:', error);
    recordingState.isRecording = false;
    notifyRecordingStatus('error', error.message);
  }
}

// 録画停止
function stopRecording() {
  recordingState.isRecording = false;
  
  if (recordingState.downloadId) {
    chrome.downloads.cancel(recordingState.downloadId);
  }
  
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
    
    // 最初のセグメントをダウンロード
    const firstSegment = segments[0];
    const segmentUrl = resolveURL(streamData.url, firstSegment);
    
    // ファイル名を生成
    const filename = generateFilename(streamData, recordingState.settings);
    
    chrome.downloads.download({
      url: segmentUrl,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('ダウンロードエラー:', chrome.runtime.lastError);
        notifyRecordingStatus('error', chrome.runtime.lastError.message);
      } else {
        recordingState.downloadId = downloadId;
        notifyRecordingStatus('started');
      }
    });
    
  } catch (error) {
    console.error('HLS ダウンロードエラー:', error);
    notifyRecordingStatus('error', error.message);
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
function generateFilename(streamData, settings) {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const channelName = streamData.channelName || 'unknown';
  const title = streamData.streamInfo?.title || '';
  const category = streamData.streamInfo?.category || '';
  
  // ファイル名テンプレート
  let filename = `${channelName}-${timestamp}`;
  
  // タイトルを追加（ファイル名に使用できない文字を除去）
  if (title) {
    const safeTitle = title.replace(/[<>:"/\\|?*]/g, '').substring(0, 50);
    filename = `${channelName}-${safeTitle}-${timestamp}`;
  }
  
  // 拡張子を追加
  const extension = settings.saveFormat === 'mp4' ? 'mp4' : 'ts';
  filename += `.${extension}`;
  
  // 保存先フォルダを追加
  if (settings.saveLocation && settings.saveLocation !== 'downloads') {
    filename = `${settings.saveLocation}/${filename}`;
  }
  
  return filename;
}

// 録画状態の通知
function notifyRecordingStatus(status, message = '') {
  chrome.runtime.sendMessage({
    action: 'recordingStatus',
    status: status,
    message: message
  }).catch(() => {
    // ポップアップが閉じられている場合はエラーを無視
  });
}

// ダウンロード完了の監視
chrome.downloads.onChanged.addListener((delta) => {
  if (delta.id === recordingState.downloadId) {
    if (delta.state && delta.state.current === 'complete') {
      recordingState.isRecording = false;
      notifyRecordingStatus('completed');
    } else if (delta.state && delta.state.current === 'interrupted') {
      recordingState.isRecording = false;
      notifyRecordingStatus('error', 'ダウンロードが中断されました');
    }
  }
});

// Webリクエストの監視（HLS URLの検出）
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    if (details.url.includes('.m3u8') || details.url.includes('usher.ttvnw.net')) {
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

// 定期的な録画時間制限チェック
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'recordingTimeLimit') {
    if (recordingState.isRecording && recordingState.settings.duration > 0) {
      stopRecording();
      notifyRecordingStatus('completed', '設定された時間に達したため録画を停止しました');
    }
  }
});

// 録画時間制限の設定
function setRecordingTimeLimit(minutes) {
  if (minutes > 0) {
    chrome.alarms.create('recordingTimeLimit', {
      delayInMinutes: minutes
    });
  }
}