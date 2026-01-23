---
layout: fact
name: ExodusCalendarTest
title: Exodus Calendar Test
level: 5
section: validation
statement: "Testing calendar theories against the scriptural fact that the 15th of 2nd month was a Sabbath in 1446 BC"
confidence: High
rejected: false
evidence:
  - "Given: Scripture establishes the 15th of 2nd month was a Sabbath (Exodus 16)"
  - "Given: The Exodus occurred in 1446 BC (from 1 Kings 6:1)"
  - "Test: Calculate what day of week the 15th falls on under different calendar systems"
  - "**Sliver Moon + Saturday Sabbath**: 15th = Friday → FAILS (contradicts Scripture)"
  - "**Dark Moon + Saturday Sabbath**: 15th = Saturday → PASSES"
  - "**Full Moon + Lunar Sabbath**: 15th = Sabbath by definition → PASSES"
  - "This test ELIMINATES the sliver moon calendar but does not discriminate between Dark Moon Saturday and Lunar Sabbath"
dependencies:
  - Consecutive15thsAsSabbaths
  - ExodusDate
  - AstronomicalStability
locations:
  - file: 10_When_is_the_Sabbath
    section: "Testing Known Weekly Sabbaths"
    excerpt: "For the sake of this experiment we will consider two traditional calendar theories..."
---

This validation test uses the scriptural fact (15th was a Sabbath) combined with astronomical calculations to test which calendar theories are compatible with Scripture. The sliver moon calendar FAILS this test, while both dark moon Saturday and lunar Sabbath pass.
