#!/usr/bin/env python3
"""
Parse fact_dependency_tree.md and generate:
1. Individual fact markdown files in _facts/
2. A facts.yml data file for Jekyll
"""

import re
import os
import json
from pathlib import Path

def parse_fact_tree(content):
    """Parse the fact dependency tree markdown and extract facts."""
    facts = []
    current_fact = None
    current_level = 0
    current_section = ""
    is_rejected_section = False
    
    lines = content.split('\n')
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Track section headers for level detection
        if line.startswith('## FOUNDATIONAL'):
            current_level = 0
            current_section = "foundational"
            is_rejected_section = False
        elif line.startswith('## LEVEL 1'):
            current_level = 1
            current_section = "historical"
            is_rejected_section = False
        elif line.startswith('## LEVEL 2') or 'LEVEL 2' in line:
            current_level = 2
            current_section = "derived"
            is_rejected_section = False
        elif line.startswith('## LEVEL 3'):
            current_level = 3
            current_section = "scriptural"
            is_rejected_section = False
        elif line.startswith('## LEVEL 4'):
            current_level = 4
            current_section = "calendar"
            is_rejected_section = False
        elif line.startswith('## LEVEL 5'):
            current_level = 5
            current_section = "validation"
            is_rejected_section = False
        elif line.startswith('## ALTERNATIVE FACTS') or line.startswith('## REJECTED'):
            current_level = -1
            current_section = "rejected"
            is_rejected_section = True
        elif line.startswith('## DEPENDENCY SUMMARY') or line.startswith('## STRONGEST'):
            # Stop parsing, we're past the facts
            break
        
        # Detect new fact (### FactName)
        if line.startswith('### ') and not line.startswith('### Most') and not line.startswith('### Path') and not line.startswith('### Alternative') and not line.startswith('### Strongest') and not line.startswith('### Additional') and not line.startswith('### Foundational') and not line.startswith('### Weakest'):
            # Save previous fact
            if current_fact:
                facts.append(current_fact)
            
            fact_name = line[4:].strip()
            current_fact = {
                'name': fact_name,
                'title': fact_name,  # Will be processed later
                'level': current_level,
                'section': current_section,
                'rejected': is_rejected_section,
                'statement': '',
                'evidence': [],
                'dependencies': [],
                'confidence': 'Medium',
                'source': '',
                'rejection_reason': [],
                'alternative_accepted': ''
            }
        
        # Parse fact properties
        elif current_fact and line.startswith('- **Fact**:'):
            current_fact['statement'] = line.replace('- **Fact**:', '').strip()
        
        elif current_fact and line.startswith('- ') and not line.startswith('- **'):
            # Simple statement line (for foundational facts)
            if not current_fact['statement']:
                current_fact['statement'] = line[2:].strip()
            else:
                current_fact['evidence'].append(line[2:].strip())
        
        elif current_fact and line.startswith('- **Source**:'):
            current_fact['source'] = line.replace('- **Source**:', '').strip()
        
        elif current_fact and line.startswith('- **Evidence**:'):
            # Evidence may be on same line or following lines
            evidence_text = line.replace('- **Evidence**:', '').strip()
            if evidence_text:
                current_fact['evidence'].append(evidence_text)
            # Check for multi-line evidence
            i += 1
            while i < len(lines) and lines[i].strip().startswith('- ') and not lines[i].strip().startswith('- **'):
                ev_line = lines[i].strip()
                if ev_line.startswith('- '):
                    current_fact['evidence'].append(ev_line[2:].strip())
                i += 1
            i -= 1  # Back up one since we'll increment at end of loop
        
        elif current_fact and line.startswith('- **Dependencies**:'):
            deps_text = line.replace('- **Dependencies**:', '').strip()
            # Parse dependencies - they might have parenthetical explanations
            deps_raw = deps_text.split(',')
            for dep in deps_raw:
                # Remove parenthetical explanations
                dep_clean = re.sub(r'\([^)]*\)', '', dep).strip()
                if dep_clean and dep_clean.lower() != 'none':
                    current_fact['dependencies'].append(dep_clean)
        
        elif current_fact and line.startswith('- **Confidence**:'):
            current_fact['confidence'] = line.replace('- **Confidence**:', '').strip()
        
        elif current_fact and line.startswith('- **Confidence in Fact**:'):
            current_fact['confidence'] = line.replace('- **Confidence in Fact**:', '').strip()
        
        elif current_fact and line.startswith('- **Rejection**:'):
            # Rejection reasons may be on same line or following lines
            rejection_text = line.replace('- **Rejection**:', '').strip()
            if rejection_text:
                current_fact['rejection_reason'].append(rejection_text)
            # Check for multi-line rejection
            i += 1
            while i < len(lines) and lines[i].strip().startswith('- ') and not lines[i].strip().startswith('- **'):
                rej_line = lines[i].strip()
                if rej_line.startswith('- '):
                    current_fact['rejection_reason'].append(rej_line[2:].strip())
                i += 1
            i -= 1
        
        elif current_fact and line.startswith('- **Alternative Accepted**:'):
            current_fact['alternative_accepted'] = line.replace('- **Alternative Accepted**:', '').strip()
        
        i += 1
    
    # Don't forget the last fact
    if current_fact:
        facts.append(current_fact)
    
    return facts


def yaml_escape(s):
    """Escape string for YAML."""
    if not s:
        return '""'
    s = str(s)
    # If contains special chars, quote it
    if any(c in s for c in [':', '#', "'", '"', '\n', '[', ']', '{', '}', ',', '&', '*', '!', '|', '>', '%', '@', '`']):
        # Use double quotes and escape internal quotes
        s = s.replace('\\', '\\\\').replace('"', '\\"')
        return f'"{s}"'
    return s


def to_yaml(obj, indent=0):
    """Convert Python object to YAML string."""
    prefix = '  ' * indent
    
    if isinstance(obj, dict):
        lines = []
        for k, v in obj.items():
            if isinstance(v, (list, dict)) and v:
                lines.append(f"{prefix}{k}:")
                lines.append(to_yaml(v, indent + 1))
            elif isinstance(v, list) and not v:
                lines.append(f"{prefix}{k}: []")
            elif isinstance(v, bool):
                lines.append(f"{prefix}{k}: {'true' if v else 'false'}")
            elif isinstance(v, int):
                lines.append(f"{prefix}{k}: {v}")
            elif v is None:
                lines.append(f"{prefix}{k}: null")
            else:
                lines.append(f"{prefix}{k}: {yaml_escape(v)}")
        return '\n'.join(lines)
    
    elif isinstance(obj, list):
        lines = []
        for item in obj:
            if isinstance(item, dict):
                lines.append(f"{prefix}-")
                lines.append(to_yaml(item, indent + 1))
            else:
                lines.append(f"{prefix}- {yaml_escape(item)}")
        return '\n'.join(lines)
    
    else:
        return f"{prefix}{yaml_escape(obj)}"


def generate_fact_title(name):
    """Convert CamelCase to readable title."""
    # Add spaces before capitals
    title = re.sub(r'([A-Z])', r' \1', name).strip()
    # Handle special cases
    title = title.replace('B C', 'BC')
    title = title.replace('A D', 'AD')
    title = title.replace('1 B C', '1 BC')
    title = title.replace('4 B C', '4 BC')
    title = title.replace('32 A D', '32 AD')
    title = title.replace('29 A D', '29 AD')
    title = title.replace('458 B C', '458 BC')
    title = title.replace('457 B C', '457 BC')
    title = title.replace('40 B C', '40 BC')
    title = title.replace('37 B C', '37 BC')
    return title


def write_fact_files(facts, output_dir):
    """Write individual fact markdown files."""
    facts_dir = output_dir / '_facts'
    facts_dir.mkdir(exist_ok=True)
    
    for fact in facts:
        filename = fact['name'].lower() + '.md'
        filepath = facts_dir / filename
        
        # Build front matter
        front_matter = {
            'layout': 'fact',
            'name': fact['name'],
            'title': generate_fact_title(fact['name']),
            'level': fact['level'],
            'section': fact['section'],
            'statement': fact['statement'],
            'confidence': fact['confidence'],
            'rejected': fact['rejected'],
        }
        
        if fact['evidence']:
            front_matter['evidence'] = fact['evidence']
        
        if fact['dependencies']:
            front_matter['dependencies'] = fact['dependencies']
        
        if fact['source']:
            front_matter['source'] = fact['source']
        
        if fact['rejection_reason']:
            front_matter['rejection_reason'] = fact['rejection_reason']
        
        if fact['alternative_accepted']:
            front_matter['alternative_accepted'] = fact['alternative_accepted']
        
        # Write file
        with open(filepath, 'w') as f:
            f.write('---\n')
            f.write(to_yaml(front_matter))
            f.write('\n---\n\n')
            
            # Add any additional content if needed
            if fact['rejected'] and fact['rejection_reason']:
                f.write('## Why This Alternative Was Rejected\n\n')
                for reason in fact['rejection_reason']:
                    f.write(f'- {reason}\n')
        
        print(f"  Created: {filepath.name}")


def write_facts_yaml(facts, output_dir):
    """Write facts.yml data file for Jekyll."""
    data_dir = output_dir / '_data'
    data_dir.mkdir(exist_ok=True)
    
    facts_data = {}
    for fact in facts:
        facts_data[fact['name']] = {
            'title': generate_fact_title(fact['name']),
            'statement': fact['statement'],
            'level': fact['level'],
            'confidence': fact['confidence'],
            'rejected': fact['rejected'],
            'dependencies': fact['dependencies'],
        }
    
    with open(data_dir / 'facts.yml', 'w') as f:
        f.write(to_yaml(facts_data))
    
    print(f"  Created: _data/facts.yml with {len(facts)} facts")


def main():
    import sys
    
    # Paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent  # Go up from http/scripts to timetested
    http_dir = script_dir.parent
    
    fact_tree_path = project_root / 'fact_dependency_tree.md'
    
    print(f"Parsing: {fact_tree_path}", file=sys.stderr)
    
    # Read and parse
    with open(fact_tree_path, 'r') as f:
        content = f.read()
    
    facts = parse_fact_tree(content)
    print(f"Found {len(facts)} facts", file=sys.stderr)
    
    # Check for --json flag to output parsed data
    if len(sys.argv) > 1 and sys.argv[1] == '--json':
        # Output as JSON for external processing
        print(json.dumps(facts, indent=2))
        return
    
    # Generate outputs
    print("\nGenerating fact files...", file=sys.stderr)
    write_fact_files(facts, http_dir)
    
    print("\nGenerating facts.yml...", file=sys.stderr)
    write_facts_yaml(facts, http_dir)
    
    print("\nDone!", file=sys.stderr)


if __name__ == '__main__':
    main()
