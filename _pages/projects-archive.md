---
title: "Projects"
layout: archive
permalink: /projects-archive/
author_profile: true
---

<h2 id="projects" class="archive__subtitle">Projects</h2>

{% for post in site.projects %}
  {% unless post.sitemap == false %}
    {% include archive-single.html %}
  {% endunless %}
{% endfor %}