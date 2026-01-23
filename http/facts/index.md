---
layout: post
title: Facts Index
content-type: post
permalink: /facts/
---

# Facts Index

Browse all facts from the TIME Tested Tradition evidence base. Each fact links to its supporting evidence and the chapters where it's discussed.

---

## Foundational Assumptions

These are axioms that form the foundation of the argument.

<div class="facts-grid">
{% for fact in site.facts %}
{% if fact.level == 0 and fact.rejected != true %}
<div class="fact-card">
    <h3><a href="{{ fact.url }}">{{ fact.title }}</a></h3>
    <p>{{ fact.statement | truncatewords: 20 }}</p>
    <span class="confidence-badge small {{ fact.confidence | downcase | replace: ' ', '-' }}">{{ fact.confidence }}</span>
</div>
{% endif %}
{% endfor %}
</div>

---

## Level 1: Independent Historical Facts

Verified from external sources.

<div class="facts-grid">
{% for fact in site.facts %}
{% if fact.level == 1 and fact.rejected != true %}
<div class="fact-card">
    <h3><a href="{{ fact.url }}">{{ fact.title }}</a></h3>
    <p>{{ fact.statement | truncatewords: 20 }}</p>
    <span class="confidence-badge small {{ fact.confidence | downcase | replace: ' ', '-' }}">{{ fact.confidence }}</span>
</div>
{% endif %}
{% endfor %}
</div>

---

## Level 2: Derived Historical Facts

Calculated from Level 1 facts.

<div class="facts-grid">
{% for fact in site.facts %}
{% if fact.level == 2 and fact.rejected != true %}
<div class="fact-card">
    <h3><a href="{{ fact.url }}">{{ fact.title }}</a></h3>
    <p>{{ fact.statement | truncatewords: 20 }}</p>
    <span class="confidence-badge small {{ fact.confidence | downcase | replace: ' ', '-' }}">{{ fact.confidence }}</span>
</div>
{% endif %}
{% endfor %}
</div>

---

## Level 3: Scriptural Interpretations

Depend on foundational principles.

<div class="facts-grid">
{% for fact in site.facts %}
{% if fact.level == 3 and fact.rejected != true %}
<div class="fact-card">
    <h3><a href="{{ fact.url }}">{{ fact.title }}</a></h3>
    <p>{{ fact.statement | truncatewords: 20 }}</p>
    <span class="confidence-badge small {{ fact.confidence | downcase | replace: ' ', '-' }}">{{ fact.confidence }}</span>
</div>
{% endif %}
{% endfor %}
</div>

---

## Level 4: Calendar System Conclusions

<div class="facts-grid">
{% for fact in site.facts %}
{% if fact.level == 4 and fact.rejected != true %}
<div class="fact-card">
    <h3><a href="{{ fact.url }}">{{ fact.title }}</a></h3>
    <p>{{ fact.statement | truncatewords: 20 }}</p>
    <span class="confidence-badge small {{ fact.confidence | downcase | replace: ' ', '-' }}">{{ fact.confidence }}</span>
</div>
{% endif %}
{% endfor %}
</div>

---

## Level 5: Historical Validation Tests

<div class="facts-grid">
{% for fact in site.facts %}
{% if fact.level == 5 and fact.rejected != true %}
<div class="fact-card">
    <h3><a href="{{ fact.url }}">{{ fact.title }}</a></h3>
    <p>{{ fact.statement | truncatewords: 20 }}</p>
    <span class="confidence-badge small {{ fact.confidence | downcase | replace: ' ', '-' }}">{{ fact.confidence }}</span>
</div>
{% endif %}
{% endfor %}
</div>

---

## Rejected Alternatives

Facts that were evaluated and rejected.

<div class="facts-grid">
{% for fact in site.facts %}
{% if fact.rejected == true %}
<div class="fact-card" style="opacity: 0.7; border-color: #dc3545;">
    <h3><a href="{{ fact.url }}">{{ fact.title }}</a></h3>
    <p>{{ fact.statement | truncatewords: 20 }}</p>
    <span class="confidence-badge small" style="background: #f8d7da; color: #721c24;">Rejected</span>
</div>
{% endif %}
{% endfor %}
</div>
