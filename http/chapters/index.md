---
layout: post
title: Chapters
content-type: post
permalink: /chapters/
---

# Book Chapters

Browse all chapters of TIME Tested Tradition.

---

## Main Chapters

<ul class="toc-list">
{% assign sorted_chapters = site.chapters | sort: "chapter_number" %}
{% for chapter in sorted_chapters %}
{% if chapter.content_type != "extra" %}
<li>
    <a href="{{ chapter.url }}">
        <span>{{ chapter.title }}</span>
        {% if chapter.chapter_number %}
        <span class="chapter-num">Chapter {{ chapter.chapter_number }}</span>
        {% endif %}
    </a>
</li>
{% endif %}
{% endfor %}
</ul>

---

## Extra Chapters

<ul class="toc-list">
{% for extra in site.extras %}
<li>
    <a href="{{ extra.url }}">
        <span>{{ extra.title }}</span>
    </a>
</li>
{% endfor %}
</ul>
