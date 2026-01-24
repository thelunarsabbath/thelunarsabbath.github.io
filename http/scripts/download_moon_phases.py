#!/usr/bin/env python3
"""
Download and parse Fred Espenak's Six Millennium Catalog of Moon Phases.
This contains EVERY new moon and full moon from 2000 BCE to 4000 CE.
"""
import urllib.request
import re
import json
import os

BASE_URL = "https://astropixels.com/ephemeris/phasescat/"

# Century ranges for BCE and CE
BCE_RANGES = [
    "-1999", "-1899", "-1799", "-1699", "-1599",
    "-1499", "-1399", "-1299", "-1199", "-1099",
    "-0999", "-0899", "-0799", "-0699", "-0599",
    "-0499", "-0399", "-0299", "-0199", "-0099"
]

CE_RANGES = [
    "0001", "0101", "0201", "0301", "0401",
    "0501", "0601", "0701", "0801", "0901",
    "1001", "1101", "1201", "1301", "1401",
    "1501", "1601", "1701", "1801", "1901",
    "2001", "2101", "2201", "2301", "2401",
    "2501", "2601", "2701", "2801", "2901",
    "3001", "3101", "3201", "3301", "3401",
    "3501", "3601", "3701", "3801", "3901"
]

def date_to_jd(year, month, day, hour, minute):
    """Convert date to Julian Day"""
    h = hour + minute / 60.0
    
    if month <= 2:
        year -= 1
        month += 12
    
    # Use Julian calendar for dates before 1582 Oct 15
    if year < 1582 or (year == 1582 and month < 10) or (year == 1582 and month == 10 and day < 15):
        b = 0
    else:
        a = int(year / 100)
        b = 2 - a + int(a / 4)
    
    jd = int(365.25 * (year + 4716)) + int(30.6001 * (month + 1)) + day + b - 1524.5 + h / 24.0
    return jd

def parse_century_page(html, century_start):
    """Parse a century page and extract moon phases."""
    phases = []
    
    # Look for year blocks: Year New Moon First Quarter Full Moon Last Quarter
    # Data lines look like: -1499 Jan 7 02:42 Jan 14 00:58 Jan 22 05:25 n Jan 29 21:46
    
    months = {
        'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
        'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
    }
    
    # Pattern for a data line: year followed by multiple phase entries
    # Each phase: [eclipse_marker] Month Day HH:MM
    lines = html.split('\n')
    current_year = None
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Check if line starts with a year
        parts = line.split()
        if not parts:
            continue
        
        # Try to parse as year line
        try:
            year = int(parts[0])
            if -2000 <= year <= 4000:
                current_year = year
                parts = parts[1:]  # Remove year from parts
            else:
                continue
        except ValueError:
            # Not a year, check if we have a current year and this continues it
            if current_year is None:
                continue
        
        # Parse phase entries
        i = 0
        phase_num = 0  # 0=new, 1=first quarter, 2=full, 3=last quarter
        while i < len(parts):
            # Skip eclipse markers
            if parts[i] in ['n', 'p', 't', 'T', 'A', 'H', 'P']:
                i += 1
                continue
            
            # Look for Month Day HH:MM pattern
            if parts[i] in months:
                month = months[parts[i]]
                if i + 2 < len(parts):
                    try:
                        day = int(parts[i + 1])
                        time_parts = parts[i + 2].split(':')
                        if len(time_parts) == 2:
                            hour = int(time_parts[0])
                            minute = int(time_parts[1])
                            
                            jd = date_to_jd(current_year, month, day, hour, minute)
                            
                            # Only keep new moons (phase_num 0) and full moons (phase_num 2)
                            if phase_num % 4 == 0:  # New moon
                                phases.append({'jd': round(jd, 4), 'y': current_year, 't': 'n'})
                            elif phase_num % 4 == 2:  # Full moon
                                phases.append({'jd': round(jd, 4), 'y': current_year, 't': 'f'})
                            
                            phase_num += 1
                            i += 3
                            continue
                    except (ValueError, IndexError):
                        pass
            i += 1
    
    return phases

def download_and_parse(century):
    """Download and parse a century page."""
    url = f"{BASE_URL}phases{century}.html"
    print(f"  Downloading {url}...")
    
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            html = response.read().decode('utf-8')
        return parse_century_page(html, century)
    except Exception as e:
        print(f"    ERROR: {e}")
        return []

# Start with just the century we need for testing
print("Testing with -1499 to -1400 century...")
phases = download_and_parse("-1499")

print(f"\nFound {len(phases)} phases")

# Check for May 1446 BC (year -1445)
print("\nNew moons in year -1445 (1446 BC):")
for p in phases:
    if p['y'] == -1445 and p['t'] == 'n':
        # Convert JD back to date for verification
        jd = p['jd']
        z = int(jd + 0.5)
        f = jd + 0.5 - z
        a = z
        b = a + 1524
        c = int((b - 122.1) / 365.25)
        d = int(365.25 * c)
        e = int((b - d) / 30.6001)
        day = b - d - int(30.6001 * e)
        month = e - 1 if e < 14 else e - 13
        year = c - 4716 if month > 2 else c - 4715
        hours = f * 24
        hh = int(hours)
        mm = int((hours - hh) * 60)
        
        months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        print(f"  {months[month]} {day}, {hh:02d}:{mm:02d} UTC (JD {jd})")
