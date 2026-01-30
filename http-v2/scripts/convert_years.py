#!/usr/bin/env python3
"""
Convert historical-events.json from legacy year format to astronomical years.

Legacy format: -1446 = 1446 BC (simple negation, WRONG)
Astronomical:  -1445 = 1446 BC (year 0 = 1 BC)

Conversion for BC years: astronomical = legacy + 1
AD years stay the same.
"""

import json
import re

def convert_year(year):
    """Convert legacy year to astronomical year."""
    if year < 0:
        # Legacy BC year to astronomical
        # -1446 (legacy = 1446 BC) → -1445 (astronomical)
        return year + 1
    return year

def process_dates(obj):
    """Recursively process all date objects."""
    if isinstance(obj, dict):
        # Check if this is a year-containing object
        if 'year' in obj and isinstance(obj['year'], int) and obj['year'] < 0:
            obj['year'] = convert_year(obj['year'])
        
        # Recurse into all values
        for key, value in obj.items():
            process_dates(value)
    elif isinstance(obj, list):
        for item in obj:
            process_dates(item)
    return obj

def main():
    # Read the JSON
    with open('historical-events.json', 'r') as f:
        data = json.load(f)
    
    # Update the meta description
    data['meta']['year_notation'] = "Years use astronomical numbering: 1 AD = 1, 1 BC = 0, 2 BC = -1, 1446 BC = -1445. Formula: BC year N = 1-N internally."
    
    # Process all dates
    process_dates(data)
    
    # Write back
    with open('historical-events.json', 'w') as f:
        json.dump(data, f, indent=2)
    
    print("Conversion complete!")
    print("Legacy format: -1446 = 1446 BC (simple negation)")
    print("New format:    -1445 = 1446 BC (astronomical)")

if __name__ == '__main__':
    main()
