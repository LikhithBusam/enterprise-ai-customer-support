import json
from pathlib import Path

RESULTS_DIR = Path("experiments/results")

def main():
    for rate in ["0.0", "0.3", "0.7"]:
        filepath = RESULTS_DIR / f"memory_augmented_{rate}.jsonl"
        if not filepath.exists():
            print(f"File not found: {filepath}")
            continue
            
        records = []
        with open(filepath) as f:
            for line in f:
                if line.strip():
                    records.append(json.loads(line))
                    
        # Deduplicate: keep the last entry
        seen = {}
        for r in records:
            seen[r["ticket_id"]] = r
            
        unique_records = list(seen.values())
        
        # Write back to file
        with open(filepath, "w") as f:
            for r in unique_records:
                f.write(json.dumps(r) + "\n")
                
        print(f"Deduplicated {filepath.name}: {len(records)} raw entries -> {len(unique_records)} unique records.")
        assert len(unique_records) == 200, f"Error: expected exactly 200 unique tickets for FR={rate}, got {len(unique_records)}"

if __name__ == "__main__":
    main()
