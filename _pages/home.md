---
layout: default
permalink: /
excerpt: >
  my little home on the web
---

<style>
html, body {
  height: 100%;
  margin: 0;
  padding: 0;
}

.page__content {
  height: calc(100vh - 120px);
  padding: 0 !important;
  margin: 0 !important;
}

.iframe-container {
  width: 100%;
  height: 100%;
  border: none;
  overflow: hidden;
}

.iframe-container iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.page__footer {
  margin-top: 0 !important;
}
</style>

<div class="iframe-container">
  <iframe id="main-iframe" frameborder="0" allowfullscreen></iframe>
</div>

<script>
// Force iframe to reload completely on each page visit
document.addEventListener('DOMContentLoaded', function() {
  const iframe = document.getElementById('main-iframe');
  const timestamp = new Date().getTime();
  iframe.src = 'https://nntin.xyz/d-zone?s=repos&socketURL=wss://hermes.nntin.xyz/dzone&t=' + timestamp;
});

// Also reload when the page becomes visible again (tab switching)
document.addEventListener('visibilitychange', function() {
  if (!document.hidden) {
    const iframe = document.getElementById('main-iframe');
    const timestamp = new Date().getTime();
    iframe.src = 'https://nntin.xyz/d-zone?s=repos&socketURL=wss://hermes.nntin.xyz/dzone&t=' + timestamp;
  }
});
</script>

