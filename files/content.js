{
  "manifest_version": 3,
  "name": "Twitch Stream Saver",
  "version": "1.0",
  "description": "Twitch配信を保存するための拡張機能",
  "permissions": [
    "activeTab",
    "storage",
    "downloads",
    "webRequest",
    "scripting"
  ],
  "host_permissions": [
    "https://www.twitch.tv/*",
    "https://usher.ttvnw.net/*",
    "https://video-weaver.*.hls.ttvnw.net/*",
    "https://*.ttvnw.net/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://www.twitch.tv/*"],
      "js": ["content.js"],
      "run_at": "document_end"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "Twitch Stream Saver"
  },
  "web_accessible_resources": [
    {
      "resources": ["inject.js"],
      "matches": ["https://www.twitch.tv/*"]
    }
  ]
}