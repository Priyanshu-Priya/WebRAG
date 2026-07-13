import difflib
from typing import Dict, Any

class ChangeDetector:
    @staticmethod
    def detect_changes(old_text: str, new_text: str) -> Dict[str, Any]:
        """
        Compares old text and new text using difflib.
        Returns statistics and a detailed text report.
        """
        if not old_text:
            # Entirely new page
            return {
                "sections_added": len(new_text.splitlines()),
                "sections_removed": 0,
                "paragraphs_changed": 0,
                "report_text": "First indexing of this page. Complete content added."
            }

        # Split text into lines/paragraphs for line-by-line comparison
        old_lines = [line.strip() for line in old_text.split(".") if line.strip()]
        new_lines = [line.strip() for line in new_text.split(".") if line.strip()]

        # Generate diff using ndiff to analyze line additions and removals
        diff = [line for line in difflib.ndiff(old_lines, new_lines) if not line.startswith("?")]

        added_count = 0
        removed_count = 0
        changed_count = 0
        report_lines = []

        # Simple state machine to group sequential "-" and "+" into "changed"
        idx = 0
        n = len(diff)
        
        while idx < n:
            line = diff[idx]
            tag = line[0]
            content = line[2:]

            if tag == "+":
                added_count += 1
                report_lines.append(f"+ {content}")
                idx += 1
            elif tag == "-":
                # Lookahead to see if next is a "+" which means a change/replacement
                if idx + 1 < n and diff[idx + 1][0] == "+":
                    changed_count += 1
                    report_lines.append(f"~ Changed:\n  OLD: {content}\n  NEW: {diff[idx + 1][2:]}")
                    idx += 2
                else:
                    removed_count += 1
                    report_lines.append(f"- {content}")
                    idx += 1
            else:
                # No change
                idx += 1

        # Truncate report text if it's too long
        if len(report_lines) > 50:
            truncated_report = "\n".join(report_lines[:50]) + f"\n... and {len(report_lines) - 50} more changes."
        else:
            truncated_report = "\n".join(report_lines)

        if not report_lines:
            truncated_report = "No modifications detected in content structure."

        return {
            "sections_added": added_count,
            "sections_removed": removed_count,
            "paragraphs_changed": changed_count,
            "report_text": truncated_report
        }
