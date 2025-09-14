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
---

I would like to thank especially.

## Website generation
{% for link in page.links %}
<a href="{{ link.url }}" rel="nofollow noopener noreferrer"><i class="{{ link.icon | default: 'fas fa-link' }}" aria-hidden="true"></i> {{ link.label }}</a>
{% endfor %}