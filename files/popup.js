let streamData = null;
let isRecording = false;

document.addEventListener('DOMContentLoaded', function() {
  const statusEl = document.getElementById('status');
  const streamInfoEl = document.getElementById('streamInfo');
  const captureBtn = document.getElementById('captureBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const qualitySelect = document.getElementById('qualitySelect');
  const progressEl = document.getElementById('progress');
  const progressBar = document.getElementById('progressBar');
  
  // 現在のタブがTwitchかどうかチェック
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const tab = tabs[0];
    if (tab.url && tab.url.includes('twitch.tv')) {
      statusEl.className = 'status ready';
      statusEl.textContent = 'Twitchページを検出しました';
      captureBtn.disabled = false;
      
      // 配信情報を取得
      chrome.tabs.sendMessage(tab.id, {action: 'getStreamInfo'}, function(response) {
        if (response && response.streamInfo) {
          updateStreamInfo(response.streamInfo);
        }
      });
    }
  });
  
  // 配信URLを取得
  captureBtn.addEventListener('click', function() {
    captureBtn.disabled = true;
    captureBtn.textContent = '取得中...';
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'captureStream',
        quality: qualitySelect.value
      }, function(response) {
        if (response && response.success) {
          streamData = response.streamData;
          statusEl.className = 'status ready';
          statusEl.textContent = '配信URLを取得しました';
          downloadBtn.disabled = false;
          captureBtn.textContent = '配信URLを取得';
          captureBtn.disabled = false;
        } else {
          statusEl.className = 'status not-ready';
          statusEl.textContent = '配信URLの取得に失敗しました';
          captureBtn.textContent = '配信URLを取得';
          captureBtn.disabled = false;
        }
      });
    });
  });
  
  // ダウンロード開始
  downloadBtn.addEventListener('click', function() {
    if (!streamData) return;
    
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  });
  
  function startRecording() {
    isRecording = true;
    downloadBtn.textContent = '録画停止';
    progressEl.style.display = 'block';
    
    // バックグラウンドスクリプトに録画開始を通知
    chrome.runtime.sendMessage({
      action: 'startRecording',
      streamData: streamData
    });
    
    // 進捗更新のシミュレーション
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 2;
      if (progress > 100) progress = 100;
      progressBar.style.width = progress + '%';
      
      if (!isRecording) {
        clearInterval(progressInterval);
        progressEl.style.display = 'none';
        progressBar.style.width = '0%';
      }
    }, 1000);
  }
  
  function stopRecording() {
    isRecording = false;
    downloadBtn.textContent = 'ダウンロード開始';
    
    chrome.runtime.sendMessage({
      action: 'stopRecording'
    });
    
    statusEl.className = 'status ready';
    statusEl.textContent = '録画を停止しました';
  }
  
  function updateStreamInfo(info) {
    streamInfoEl.style.display = 'block';
    document.getElementById('streamerName').textContent = info.channelName || '-';
    document.getElementById('streamTitle').textContent = info.title || '-';
    document.getElementById('viewerCount').textContent = info.viewerCount || '-';
  }
  
  // バックグラウンドスクリプトからのメッセージを受信
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'recordingStatus') {
      if (request.status === 'completed') {
        isRecording = false;
        downloadBtn.textContent = 'ダウンロード開始';
        statusEl.className = 'status ready';
        statusEl.textContent = '録画完了しました';
      } else if (request.status === 'error') {
        isRecording = false;
        downloadBtn.textContent = 'ダウンロード開始';
        statusEl.className = 'status not-ready';
        statusEl.textContent = '録画エラーが発生しました';
      }
    }
  });
});