---
title: "Credits"
permalink: /credits/
excerpt: "Credits"
toc: false
links:
  - label: "Jekyll"
    icon: "fab fa-fw fa-github"
    url: "https://github.com/jekyll/jekyll"
  - label: "Michael Rose"
    icon: "fab fa-fw fa-github"
    url: "https://github.com/mmistakes/minimal-mistakes"
  - label: "Red-DiscordBot"
    icon: "fab fa-fw fa-github"
    url: "https://github.com/Cog-Creators/Red-DiscordBot"
  - label: "Lightnovel Crawler"
    icon: "fab fa-fw fa-github"
    url: "https://github.com/dipu-bd/lightnovel-crawler"
  - label: "D-Zone"
    icon: "fab fa-fw fa-github"
    url: "https://github.com/d-zone-org/d-zone"
---

I would like to thank:
{% for link in page.links %}
<a href="{{ link.url }}" rel="nofollow noopener noreferrer"><i class="{{ link.icon | default: 'fas fa-link' }}" aria-hidden="true"></i> {{ link.label }}</a>
{% endfor %}