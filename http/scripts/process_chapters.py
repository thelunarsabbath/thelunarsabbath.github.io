#!/usr/bin/env python3
"""
Process book chapters and create Jekyll-compatible versions with front matter.
Run this from the http/ directory.
"""

import os
import re
from pathlib import Path

# Chapter metadata - add related facts for each chapter
CHAPTER_METADATA = {
    "01_Introduction": {
        "title": "Introduction",
        "related_facts": ["ScripturalAuthority", "HermeneuticalPrinciples"]
    },
    "02_Inherited_Lies": {
        "title": "Inherited Lies",
        "related_facts": ["ScripturalAuthority", "HermeneuticalPrinciples"]
    },
    "03_Principles_of_Evaluation": {
        "title": "Principles of Evaluation",
        "related_facts": ["ScripturalAuthority", "HermeneuticalPrinciples", "CalendarAccessibility"]
    },
    "04_Alleged_Authority_of_Sanhedrin": {
        "title": "Alleged Authority of Sanhedrin",
        "related_facts": ["ScripturalAuthority"]
    },
    "05_Where_Does_the_Day_Start": {
        "title": "Where Does the Day Start?",
        "related_facts": ["CalendarAccessibility", "CelestialAuthority"]
    },
    "06_When_Does_the_Day_Start": {
        "title": "When Does the Day Start?",
        "related_facts": ["DayStartsAtMorning", "ScripturalAuthority"]
    },
    "07_When_Does_the_Month_Start": {
        "title": "When Does the Month Start?",
        "related_facts": ["MonthStartsWithFullMoon", "CalendarAccessibility", "CelestialAuthority"]
    },
    "08_When_does_the_Year_Start": {
        "title": "When Does the Year Start?",
        "related_facts": ["CelestialAuthority", "ScripturalAuthority"]
    },
    "09_How_to_Observe_the_Signs": {
        "title": "How to Observe the Signs",
        "related_facts": ["CalendarAccessibility", "CelestialAuthority", "MonthStartsWithFullMoon"]
    },
    "10_When_is_the_Sabbath": {
        "title": "When is the Sabbath?",
        "related_facts": ["LunarSabbathSystem", "Consecutive15thsAsSabbaths", "FirstFruitsParadox"]
    },
    "11_The_Day_of_Saturn": {
        "title": "The Day of Saturn",
        "related_facts": ["SaturdaySabbathIsPagan", "LunarSabbathSystem"]
    },
    "12_32_AD_Resurrection": {
        "title": "32 AD Resurrection",
        "related_facts": ["Crucifixion32AD", "Tiberius15thYear", "HerodsDeath"]
    },
    "13_Herod_the_Great": {
        "title": "Herod the Great",
        "related_facts": ["HerodsDeath", "January1BCEclipse", "HerodsCaptureOfJerusalem"]
    },
    "14_Passion_Week_-_3_Days_&_3_Nights": {
        "title": "Passion Week - 3 Days & 3 Nights",
        "related_facts": ["Crucifixion32AD", "LunarSabbathSystem"]
    },
    "15_Solar_Only_Calendars": {
        "title": "Solar Only Calendars",
        "related_facts": ["CelestialAuthority", "MonthStartsWithFullMoon"]
    },
    "16_The_Path_to_Salvation": {
        "title": "The Path to Salvation",
        "related_facts": ["ScripturalAuthority"]
    },
    "17_Commands_to_Follow": {
        "title": "Commands to Follow",
        "related_facts": ["ScripturalAuthority"]
    },
    "18_Appointed_Times": {
        "title": "Appointed Times",
        "related_facts": ["LunarSabbathSystem", "FirstFruitsAlwaysOn16th", "MonthStartsWithFullMoon"]
    },
    "19_Miscellaneous_Commands": {
        "title": "Miscellaneous Commands",
        "related_facts": ["ScripturalAuthority"]
    }
}

EXTRA_METADATA = {
    "e01_Herod_Regal_vs_Defacto": {
        "title": "Herod: Regnal vs De Facto Years",
        "related_facts": ["HerodsDeath", "HerodsCaptureOfJerusalem"]
    },
    "e02_Battle_of_Actium": {
        "title": "The Battle of Actium",
        "related_facts": ["HerodsDeath"]
    },
    "e03_Herods_Appointment": {
        "title": "Herod's Appointment",
        "related_facts": ["HerodsDeath", "HerodsCaptureOfJerusalem"]
    },
    "e04_StabilityOfAustronomy": {
        "title": "Stability of Astronomy",
        "related_facts": ["AstronomicalStability", "CelestialStability"]
    }
}


def process_chapter(source_path, dest_path, metadata, chapter_num=None):
    """Read source chapter and write Jekyll version with front matter."""
    with open(source_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove the first heading if it matches the title
    lines = content.split('\n')
    if lines and lines[0].startswith('# '):
        lines = lines[1:]
    elif lines and lines[0].startswith('**') and lines[0].endswith('**'):
        lines = lines[1:]
    
    content = '\n'.join(lines).strip()
    
    # Build front matter
    front_matter = [
        '---',
        'layout: chapter',
        f'title: "{metadata["title"]}"',
    ]
    
    if chapter_num:
        front_matter.append(f'chapter_number: {chapter_num}')
    
    if metadata.get('related_facts'):
        front_matter.append('related_facts:')
        for fact in metadata['related_facts']:
            front_matter.append(f'  - {fact}')
    
    front_matter.append('---')
    front_matter.append('')
    
    full_content = '\n'.join(front_matter) + content
    
    with open(dest_path, 'w', encoding='utf-8') as f:
        f.write(full_content)
    
    print(f"  Created: {dest_path.name}")


def main():
    script_dir = Path(__file__).parent
    http_dir = script_dir.parent
    project_root = http_dir.parent
    
    chapters_src = project_root / 'chapters'
    chapters_dest = http_dir / '_chapters'
    extras_src = project_root / 'extra'
    extras_dest = http_dir / '_extras'
    
    # Ensure destination directories exist
    chapters_dest.mkdir(exist_ok=True)
    extras_dest.mkdir(exist_ok=True)
    
    print("Processing chapters...")
    for filename in sorted(os.listdir(chapters_src)):
        if filename.endswith('.md'):
            name = filename[:-3]  # Remove .md
            if name in CHAPTER_METADATA:
                # Extract chapter number
                match = re.match(r'(\d+)_', name)
                chapter_num = int(match.group(1)) if match else None
                
                process_chapter(
                    chapters_src / filename,
                    chapters_dest / filename,
                    CHAPTER_METADATA[name],
                    chapter_num
                )
            else:
                print(f"  Warning: No metadata for {filename}")
    
    print("\nProcessing extras...")
    for filename in sorted(os.listdir(extras_src)):
        if filename.endswith('.md'):
            name = filename[:-3]
            if name in EXTRA_METADATA:
                process_chapter(
                    extras_src / filename,
                    extras_dest / filename,
                    EXTRA_METADATA[name]
                )
            else:
                print(f"  Warning: No metadata for {filename}")
    
    print("\nDone!")


if __name__ == '__main__':
    main()
