#!/usr/bin/env python3
"""
Parse moon phase data from the HTML we already fetched.
This creates a JSON file with all new moons and full moons.
"""
import re
import json

# Data extracted from the AstroPixels webpage for years -1499 to -1400
# The webpage shows: Year New Moon First Quarter Full Moon Last Quarter
# Format: Month Day HH:MM for each phase

# Parse the raw data for years around 1446 BC
# From the webpage, year -1445 shows:
# -1445 Jan 3 20:35 Jan 10 18:46 Jan 17 11:08 Jan 25 09:51
#       Feb 2 11:36 Feb 9 04:17 Feb 16 00:25 Feb 24 03:41
#       ... May 1 10:35 May 8 06:52 May 16 00:52 May 23 19:19 ...

# For now, let me just manually extract the key data point we need
# and verify it matches what we expect

# Year -1445 (1446 BC) new moons from the webpage:
new_moons_1445 = [
    (-1445, 1, 3, 20, 35),   # Jan 3
    (-1445, 2, 2, 11, 36),   # Feb 2
    (-1445, 3, 3, 22, 17),   # Mar 3
    (-1445, 4, 2, 5, 30),    # Apr 2
    (-1445, 5, 1, 10, 35),   # May 1
    (-1445, 5, 30, 14, 59),  # May 30
    (-1445, 6, 29, 0, 0),    # Jun 29 (approximate from the pattern)
    (-1445, 7, 28, 0, 0),    # Jul 28
    (-1445, 8, 26, 13, 46),  # Aug 26
    (-1445, 9, 25, 4, 13),   # Sep 25
    (-1445, 10, 24, 22, 49), # Oct 24
    (-1445, 11, 23, 20, 25), # Nov 23
    (-1445, 12, 23, 18, 41), # Dec 23
]

# Wait, I need to re-read the data. The format shows 4 phases per row.
# Looking at the data more carefully:
# -1445 Jan 3 20:35 [New] Jan 10 18:46 [FQ] Jan 17 11:08 [Full] Jan 25 09:51 [LQ]
# ...
# The row for May shows:
# May 1 10:35 [New] May 8 06:52 [FQ] May 16 00:52 [Full] May 23 19:19 [LQ]

# Wait, that doesn't match! Let me look again at the webpage data.
# Looking at the pattern in the HTML:
# Year New Moon First Quarter Full Moon Last Quarter
# 
# Each year has multiple rows of 4 phases each (New, FQ, Full, LQ)
# 
# For year -1445:
# Jan 3 20:35  | Jan 10 18:46 | Jan 17 11:08 | Jan 25 09:51
# Feb 2 11:36  | Feb 9 04:17  | Feb 16 00:25 | Feb 24 03:41
# ...
# May 1 10:35  | May 8 06:52  | May 16 00:52 | May 23 19:19
#
# So May 1 10:35 is a NEW MOON!
# May 8 06:52 is First Quarter (NOT new moon)

# Let me re-read more carefully. Looking at the header:
# "Year New Moon First Quarter Full Moon Last Quarter"
# 
# So the columns are: New Moon | First Quarter | Full Moon | Last Quarter
# 
# That means:
# May 1 10:35 = NEW MOON
# May 8 06:52 = First Quarter
# May 16 00:52 = FULL MOON
# May 23 19:19 = Last Quarter

# So the new moon in May 1446 BC is May 1, 10:35 UTC!
# But Stellarium shows May 8 as the conjunction...

# Wait, there might be TWO new moons in May. Let me check the next row:
# May 30 14:59 = NEW MOON (this is the next new moon after May 1)

# So the new moons around May 1446 BC are:
# - May 1, 10:35 UTC
# - May 30, 14:59 UTC

# But Stellarium shows conjunction around May 8... That's strange.
# Unless there's a calibration difference.

# Actually wait - I need to double-check. Let me look at the astronomical year.
# Year -1445 = 1446 BC
# Year -1446 = 1447 BC

# Let me look at year -1446 data:
# From the earlier eclipse data: March 21, 1447 BC had a solar eclipse (new moon)
# That matches with the March -1446 new moon.

# So for year -1445 (1446 BC), the new moons should be:
# Jan 3, Feb 2, Mar 3, Apr 2, May 1, May 30, Jun 29, Jul 28...

# But wait - the user was getting "May 8" from Swiss Ephemeris and Stellarium
# as the conjunction date. If Fred Espenak's data shows May 1 as the new moon,
# there's a significant discrepancy!

# Let me verify by calculating the Julian Day for May 1, -1445, 10:35 UTC
# and comparing with the eclipse-interpolated result.

def date_to_jd(year, month, day, hour, minute):
    h = hour + minute / 60.0
    y = year
    m = month
    if m <= 2:
        y -= 1
        m += 12
    # Julian calendar for ancient dates
    jd = int(365.25 * (y + 4716)) + int(30.6001 * (m + 1)) + day - 1524.5 + h / 24.0
    return jd

may1_jd = date_to_jd(-1445, 5, 1, 10, 35)
may8_jd = date_to_jd(-1445, 5, 8, 6, 52)

print("Fred Espenak's Moon Phase data for 1446 BC (year -1445):")
print(f"  May 1, 10:35 UTC = JD {may1_jd:.4f} (NEW MOON)")
print(f"  May 8, 06:52 UTC = JD {may8_jd:.4f} (First Quarter)")
print()
print("Earlier eclipse interpolation gave: May 8, 23:26 UTC")
print("Stellarium shows: May 8, ~9:00 AM UTC")
print()
print("This suggests a ~7 day discrepancy between Fred Espenak's data and Stellarium!")
print()
print("This could be due to different ΔT models or other factors.")
print("Fred Espenak uses Morrison-Stephenson (2004) polynomial fits.")
