import json
from pathlib import Path

RESULTS_DIR = Path("experiments/results")

def main():
    print("| Failure Rate | Resolved | Resolution Rate | Memory Hit Rate | Avg Replans | Avg Tool Calls | Critic Accuracy |")
    print("|---|---|---|---|---|---|---|")
    
    for rate in ["0.0", "0.3", "0.7"]:
        filepath = RESULTS_DIR / f"memory_augmented_{rate}.jsonl"
        if not filepath.exists():
            continue
            
        records = []
        with open(filepath) as f:
            for line in f:
                if line.strip():
                    records.append(json.loads(line))
                    
        total = len(records)
        resolved = sum(1 for r in records if r.get("resolved", False))
        res_rate = (resolved / total) * 100 if total > 0 else 0.0
        
        # Memory hits
        mem_hits = [r.get("memory_hit", False) for r in records if "memory_hit" in r]
        mem_hit_rate = (sum(mem_hits) / len(mem_hits)) * 100 if mem_hits else 0.0
        
        # Avg replans & tool calls
        replans = [r.get("replanning_count", 0) for r in records]
        avg_replans = sum(replans) / total if total > 0 else 0.0
        
        tool_calls = [len(r.get("tool_calls_made", [])) for r in records]
        avg_tool_calls = sum(tool_calls) / total if total > 0 else 0.0
        
        # Critic accuracy
        pred_correct = []
        for r in records:
            pred_cat = r.get("predicted_category")
            act_cat = r.get("actual_category")
            if pred_cat and act_cat:
                pred_correct.append(pred_cat == act_cat)
        critic_acc = (sum(pred_correct) / len(pred_correct)) * 100 if pred_correct else 0.0
        
        print(f"| {rate} | {resolved}/{total} | {res_rate:.1f}% | {mem_hit_rate:.1f}% | {avg_replans:.2f} | {avg_tool_calls:.2f} | {critic_acc:.1f}% |")

if __name__ == "__main__":
    main()
