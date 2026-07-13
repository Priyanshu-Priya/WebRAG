from backend.parser.cleaner import HTMLCleaner, Chunker

def test_html_cleaner():
    html = """
    <html>
        <head><title>Test Page Title</title></head>
        <body>
            <header>Header content should be removed</header>
            <nav>Navigation links should be removed</nav>
            <main>
                <h1>Welcome to WebRAG</h1>
                <p>WebRAG is a grounded RAG QA bot that answers queries based on live crawled content.</p>
            </main>
            <footer>Footer copyright notes should be removed</footer>
            <script>console.log("noisy scripts remove me");</script>
        </body>
    </html>
    """
    cleaned = HTMLCleaner.clean(html)
    assert "Welcome to WebRAG" in cleaned
    assert "WebRAG is a grounded" in cleaned
    assert "Header content" not in cleaned
    assert "noisy scripts" not in cleaned
    
    title = HTMLCleaner.extract_title(html)
    assert title == "Test Page Title"

def test_chunker():
    text = "This is a sentence. " * 50 # Create a long text block
    chunks = Chunker.chunk_text(text, chunk_size=100, chunk_overlap=20, metadata_base={"url": "http://test.com"})
    
    assert len(chunks) > 1
    assert chunks[0]["url"] == "http://test.com"
    assert "chunk_index" in chunks[0]
    assert "chunk_hash" in chunks[0]
    assert "content" in chunks[0]
