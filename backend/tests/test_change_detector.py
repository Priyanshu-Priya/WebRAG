from backend.services.change_detector import ChangeDetector

def test_change_detector_new_page():
    new_text = "This is a brand new page.\nIt has multiple paragraphs."
    result = ChangeDetector.detect_changes("", new_text)
    
    assert result["sections_added"] > 0
    assert result["sections_removed"] == 0
    assert "First indexing" in result["report_text"]

def test_change_detector_modified_page():
    old_text = "Python is a powerful language. It is used for web apps and AI. It is easy to learn."
    new_text = "Python is a powerful programming language. It is used for web apps and machine learning. It is easy to learn. It was created by Guido."
    
    result = ChangeDetector.detect_changes(old_text, new_text)
    
    # Check that additions and modifications are detected
    assert result["sections_added"] > 0 or result["paragraphs_changed"] > 0
    assert result["sections_removed"] == 0
    assert "Guido" in result["report_text"]
