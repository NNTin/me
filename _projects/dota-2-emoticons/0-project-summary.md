---
title: 'dota-2-emoticons'
permalink: /projects/dota-2-emoticons/
excerpt: 'dota-2-emoticons'
categories:
  - projects
tags:
#  - projects
---

<style>
{% raw %}
* {
  cursor: url({% endraw %}{{ '/assets/images/dota-2-emoticons/cursor-default.png' | relative_url }}{% raw %}), default !important;
}

* body a,
.arrow,
a.progress {
  cursor: url({% endraw %}{{ '/assets/images/dota-2-emoticons/cursor-move.png' | relative_url }}{% raw %}), default !important;
}

@keyframes aaaah {
  0% { transform: translateX(0px); }
  100% { transform: translateX(-576px); }
}

@keyframes angel {
  0% { transform: translateX(0px); }
  100% { transform: translateX(-736px); }
}

@keyframes blink {
  0% { transform: translateX(0px); }
  100% { transform: translateX(-1024px); }
}

@keyframes bts3_merlini {
  0% { transform: translateX(0px); }
  100% { transform: translateX(-1056px); }
} 

/* Multiple selectors to ensure we catch the link */
a[href="#aaaah"],
.md a[href="#aaaah"],
.page__content a[href="#aaaah"],
.single a[href="#aaaah"] {
  display: inline-block !important;
  height: 32px !important;
  width: 32px !important; 
  opacity: 1 !important;
  vertical-align: middle !important;
  text-indent: -9999px !important; /* Hide the text */
  overflow: hidden !important;
  position: relative !important;
}

/* Create a pseudo-element for the sprite animation */
a[href="#aaaah"]::before,
.md a[href="#aaaah"]::before,
.page__content a[href="#aaaah"]::before,
.single a[href="#aaaah"]::before {
  content: "" !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 1152px !important; /* Full sprite width */
  height: 32px !important;
  background: url({% endraw %}{{ '/assets/images/dota-2-emoticons/Dota2Emoticons1.png' | relative_url }}{% raw %}) 0px 0px no-repeat !important;
  background-size: auto !important;
  
  /* Aaah animation: 18 frames over 1.8 seconds */
  animation: aaaah 1.8s steps(18) infinite !important;
}

/* Angel animation - same setup but different positioning */
a[href="#angel"],
.md a[href="#angel"],
.page__content a[href="#angel"],
.single a[href="#angel"] {
  display: inline-block !important;
  height: 32px !important;
  width: 32px !important; 
  opacity: 1 !important;
  vertical-align: middle !important;
  text-indent: -9999px !important; /* Hide the text */
  overflow: hidden !important;
  position: relative !important;
}

/* Create a pseudo-element for the angel sprite animation */
a[href="#angel"]::before,
.md a[href="#angel"]::before,
.page__content a[href="#angel"]::before,
.single a[href="#angel"]::before {
  content: "" !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 1152px !important; /* Full sprite width */
  height: 32px !important;
  background: url({% endraw %}{{ '/assets/images/dota-2-emoticons/Dota2Emoticons1.png' | relative_url }}{% raw %}) 0px -128px no-repeat !important;
  background-size: auto !important;
  
  /* Angel animation: 23 frames over 2.3 seconds */
  animation: angel 2.3s steps(23) infinite !important;
}

/* Blink animation - positioned at row 14 (-448px) */
a[href="#blink"],
.md a[href="#blink"],
.page__content a[href="#blink"],
.single a[href="#blink"] {
  display: inline-block !important;
  height: 32px !important;
  width: 32px !important; 
  opacity: 1 !important;
  vertical-align: middle !important;
  text-indent: -9999px !important; /* Hide the text */
  overflow: hidden !important;
  position: relative !important;
}

/* Create a pseudo-element for the blink sprite animation */
a[href="#blink"]::before,
.md a[href="#blink"]::before,
.page__content a[href="#blink"]::before,
.single a[href="#blink"]::before {
  content: "" !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 1152px !important; /* Full sprite width */
  height: 32px !important;
  background: url({% endraw %}{{ '/assets/images/dota-2-emoticons/Dota2Emoticons1.png' | relative_url }}{% raw %}) 0px -448px no-repeat !important;
  background-size: auto !important;
  
  /* Blink animation: 32 frames over 3.2 seconds */
  animation: blink 3.2s steps(32) infinite !important;
}

/* BTS3 Merlini animation - positioned at row 23 (-736px) */
a[href="#bts3_merlini"],
.md a[href="#bts3_merlini"],
.page__content a[href="#bts3_merlini"],
.single a[href="#bts3_merlini"] {
  display: inline-block !important;
  height: 32px !important;
  width: 32px !important; 
  opacity: 1 !important;
  vertical-align: middle !important;
  text-indent: -9999px !important; /* Hide the text */
  overflow: hidden !important;
  position: relative !important;
}

/* Create a pseudo-element for the bts3_merlini sprite animation */
a[href="#bts3_merlini"]::before,
.md a[href="#bts3_merlini"]::before,
.page__content a[href="#bts3_merlini"]::before,
.single a[href="#bts3_merlini"]::before {
  content: "" !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 1152px !important; /* Full sprite width */
  height: 32px !important;
  background: url({% endraw %}{{ '/assets/images/dota-2-emoticons/Dota2Emoticons1.png' | relative_url }}{% raw %}) 0px -736px no-repeat !important;
  background-size: auto !important;
  
  /* BTS3 Merlini animation: 33 frames over 3.3 seconds */
  animation: bts3_merlini 3.3s steps(33) infinite !important;
}
{% endraw %}
</style>

## 📊 Project Summary

[![GitHub Stars](https://img.shields.io/github/stars/nntin/Dota-2-Emoticons?style)](https://github.com/nntin/Dota-2-Emoticons/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/nntin/Dota-2-Emoticons?style)](https://github.com/nntin/Dota-2-Emoticons/network)
[![GitHub Issues](https://img.shields.io/github/issues/nntin/Dota-2-Emoticons?style)](https://github.com/nntin/Dota-2-Emoticons/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/nntin/Dota-2-Emoticons?style)](https://github.com/nntin/Dota-2-Emoticons/pulls)
[![GitHub Last Commit](https://img.shields.io/github/last-commit/nntin/Dota-2-Emoticons?style)](https://github.com/nntin/Dota-2-Emoticons/commits)
[![GitHub Language Count](https://img.shields.io/github/languages/count/nntin/Dota-2-Emoticons?style)](https://github.com/nntin/Dota-2-Emoticons)
[![Top Language](https://img.shields.io/github/languages/top/nntin/Dota-2-Emoticons?style)](https://github.com/nntin/Dota-2-Emoticons)

**dota-2-emoticons** was one of my earliest projects — a simple tool that let Reddit users display animated Dota 2 flair next to their usernames using clever CSS tricks. It generated both the sprite sheet and the corresponding CSS rules needed to make the emoticons appear inline, styled, and animated.

Example Animation: [#aaaah](#aaaah), [#angel](#angel), [#blink](#blink) and [#bts3_merlini](#bts3_merlini)

The project itself isn't particularly impressive by today's standards, but at the time it was a great introduction to how stylesheets, sprites, and web animations work together. I learned a lot about positioning, layering, and how to make CSS do more than just decorate static content.

It's a small project, but one that helped lay the groundwork for more complex frontend work later on.