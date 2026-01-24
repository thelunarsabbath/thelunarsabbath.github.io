#!/usr/bin/env python3
"""
Create a compact JSON file of NASA eclipse data for lunar phase interpolation.
Solar eclipses = new moon (conjunction)
Lunar eclipses = full moon
"""
import csv
import json
import re

# Solar eclipses (new moon)
solar_eclipses = []
with open('/Users/dlarimer/timetested/http/data/nasa_solar_eclipses.csv', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        jd = float(row['julian_date'])
        year = int(row['year'])
        solar_eclipses.append({
            'jd': round(jd, 4),
            'y': year,
            't': 'n'  # new moon
        })

# Lunar eclipses (full moon) - parse fixed-width text file
lunar_eclipses = []
with open('/Users/dlarimer/timetested/http/data/nasa_lunar_eclipses.txt', 'r') as f:
    for line in f:
        # Skip header lines
        if not line.strip() or not line[0].isdigit():
            continue
        
        # Parse fixed-width format
        # Cat Num: 0-5, Date: 7-20, Time: 21-29
        try:
            cat_num = line[0:5].strip()
            if not cat_num.isdigit():
                continue
            
            # Parse date: YYYY MMM DD (wider range to capture full date)
            date_part = line[6:20].strip()
            time_part = line[20:30].strip()
            
            # Parse year (can be negative)
            match = re.match(r'(-?\d+)\s+(\w+)\s+(\d+)', date_part)
            if not match:
                continue
            
            year = int(match.group(1))
            month_name = match.group(2)
            day = int(match.group(3))
            
            # Convert month name to number
            months = {'Jan':1, 'Feb':2, 'Mar':3, 'Apr':4, 'May':5, 'Jun':6,
                     'Jul':7, 'Aug':8, 'Sep':9, 'Oct':10, 'Nov':11, 'Dec':12}
            month = months.get(month_name, 1)
            
            # Parse time HH:MM:SS
            time_match = re.match(r'(\d+):(\d+):(\d+)', time_part)
            if time_match:
                hours = int(time_match.group(1))
                mins = int(time_match.group(2))
                secs = int(time_match.group(3))
                day_frac = (hours + mins/60 + secs/3600) / 24
            else:
                day_frac = 0.5
            
            # Calculate Julian Day
            # Gregorian to JD formula
            a = (14 - month) // 12
            y = year + 4800 - a
            m = month + 12 * a - 3
            jdn = day + (153 * m + 2) // 5 + 365 * y + y // 4 - y // 100 + y // 400 - 32045
            jd = jdn + day_frac - 0.5
            
            lunar_eclipses.append({
                'jd': round(jd, 4),
                'y': year,
                't': 'f'  # full moon
            })
        except Exception as e:
            continue

# Combine and sort by Julian Day
all_eclipses = solar_eclipses + lunar_eclipses
all_eclipses.sort(key=lambda x: x['jd'])

print(f"Solar eclipses: {len(solar_eclipses)}")
print(f"Lunar eclipses: {len(lunar_eclipses)}")
print(f"Total eclipses: {len(all_eclipses)}")

# Save compact JSON
with open('/Users/dlarimer/timetested/http/data/eclipses.json', 'w') as f:
    json.dump(all_eclipses, f, separators=(',', ':'))

# Check file size
import os
size = os.path.getsize('/Users/dlarimer/timetested/http/data/eclipses.json')
print(f"File size: {size / 1024:.1f} KB")

# Verify with a sample
print("\nSample entries around 1446 BC:")
for e in all_eclipses:
    if -1447 <= e['y'] <= -1445:
        phase = 'New Moon' if e['t'] == 'n' else 'Full Moon'
        print(f"  JD {e['jd']} ({e['y']}): {phase}")
