#!/usr/bin/env python3
"""
Restructure dates in historical-events.json:
- Move year into lunar date when lunar month/day exists
- Keep gregorian only when it has month/day (not just year)
"""

import json

def restructure_dates(dates):
    """Restructure a dates object."""
    if not isinstance(dates, dict):
        return dates
    
    lunar = dates.get('lunar', {})
    gregorian = dates.get('gregorian', {})
    anno_mundi = dates.get('anno_mundi', {})
    
    # Check if we have lunar month or day
    has_lunar_month_day = lunar.get('month') is not None or lunar.get('day') is not None
    
    # Check if gregorian has only year (no month/day)
    gregorian_only_year = (
        gregorian.get('year') is not None and 
        gregorian.get('month') is None and 
        gregorian.get('day') is None
    )
    
    # If we have lunar month/day and gregorian only has year, move year to lunar
    if has_lunar_month_day and gregorian_only_year:
        lunar['year'] = gregorian['year']
        del dates['gregorian']
        dates['lunar'] = lunar
    
    # Also check if lunar already exists but year is in gregorian
    elif 'lunar' in dates and 'gregorian' in dates and gregorian_only_year:
        if 'year' not in lunar or lunar.get('year') is None:
            lunar['year'] = gregorian['year']
            del dates['gregorian']
    
    return dates

def process_event(event):
    """Process a single event."""
    if 'dates' in event:
        event['dates'] = restructure_dates(event['dates'])
    if 'start' in event:
        event['start'] = restructure_dates(event['start'])
    if 'end' in event:
        event['end'] = restructure_dates(event['end'])
    if 'end_dates' in event:
        event['end_dates'] = restructure_dates(event['end_dates'])
    return event

def main():
    with open('historical-events.json', 'r') as f:
        data = json.load(f)
    
    # Process all events
    if 'events' in data:
        for event in data['events']:
            process_event(event)
    
    # Update meta
    data['meta']['date_structure'] = {
        "description": "Year belongs with lunar date for biblical events",
        "lunar": "Contains year, month, day for biblically-dated events",
        "gregorian": "Only used when specific Gregorian month/day is attested (astronomical records, inscriptions)",
        "anno_mundi": "Year from creation (Anno Mundi) for early Genesis events"
    }
    
    with open('historical-events.json', 'w') as f:
        json.dump(data, f, indent=2)
    
    print("Restructured dates - year now in lunar when appropriate")

if __name__ == '__main__':
    main()
