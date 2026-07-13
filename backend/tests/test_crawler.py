from backend.crawler.crawler import WebCrawler

def test_crawler_url_normalization():
    crawler = WebCrawler()
    
    url1 = "https://docs.python.org/3/index.html#section-1"
    url2 = "https://docs.python.org/3/index.html/"
    
    assert crawler._normalize_url(url1) == "https://docs.python.org/3/index.html"
    assert crawler._normalize_url(url2) == "https://docs.python.org/3/index.html"

def test_crawler_is_same_domain():
    crawler = WebCrawler()
    
    base_domain = "python.org"
    url_internal = "https://docs.python.org/3/library/index.html"
    url_external = "https://github.com/python/cpython"
    
    assert crawler._is_same_domain(url_internal, base_domain) is True
    assert crawler._is_same_domain(url_external, base_domain) is False

def test_crawler_should_ignore_url():
    crawler = WebCrawler()
    
    assert crawler._should_ignore_url("https://python.org/logo.png") is True
    assert crawler._should_ignore_url("https://python.org/docs/index.html") is False
    assert crawler._should_ignore_url("https://python.org/login?redir=/docs") is True
    assert crawler._should_ignore_url("ftp://python.org/docs") is True
