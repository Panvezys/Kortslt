import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import time
import csv
import json
import argparse
import sys
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ScraperConfig:
    url: str
    max_pages: int = 10
    delay: float = 1.0
    output_format: str = "json"
    output_file: str = "output"
    follow_links: bool = False
    selector: Optional[str] = None
    headers: dict = field(default_factory=lambda: {
        "User-Agent": "Mozilla/5.0 (compatible; PythonScraper/1.0)"
    })


def fetch_page(url: str, headers: dict) -> Optional[BeautifulSoup]:
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        return BeautifulSoup(response.text, "html.parser")
    except requests.RequestException as e:
        print(f"Error fetching {url}: {e}", file=sys.stderr)
        return None


def extract_data(soup: BeautifulSoup, selector: Optional[str]) -> list[dict]:
    results = []

    if selector:
        elements = soup.select(selector)
        for el in elements:
            results.append({
                "text": el.get_text(strip=True),
                "html": str(el),
                "href": el.get("href", ""),
            })
    else:
        # Default: extract all paragraphs, headings, and links
        for tag in soup.find_all(["h1", "h2", "h3", "p", "a"]):
            results.append({
                "tag": tag.name,
                "text": tag.get_text(strip=True),
                "href": tag.get("href", ""),
            })

    return results


def collect_links(soup: BeautifulSoup, base_url: str) -> list[str]:
    base_domain = urlparse(base_url).netloc
    links = []
    for a in soup.find_all("a", href=True):
        href = urljoin(base_url, a["href"])
        if urlparse(href).netloc == base_domain:
            links.append(href)
    return list(set(links))


def save_json(data: list[dict], filename: str):
    path = f"{filename}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(data)} records to {path}")


def save_csv(data: list[dict], filename: str):
    if not data:
        print("No data to save.")
        return
    path = f"{filename}.csv"
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)
    print(f"Saved {len(data)} records to {path}")


def scrape(config: ScraperConfig) -> list[dict]:
    visited = set()
    queue = [config.url]
    all_data = []

    while queue and len(visited) < config.max_pages:
        url = queue.pop(0)
        if url in visited:
            continue

        print(f"Scraping: {url}")
        soup = fetch_page(url, config.headers)
        if soup is None:
            continue

        visited.add(url)
        page_data = extract_data(soup, config.selector)
        for record in page_data:
            record["source_url"] = url
        all_data.extend(page_data)

        if config.follow_links:
            new_links = collect_links(soup, config.url)
            queue.extend(link for link in new_links if link not in visited)

        if queue:
            time.sleep(config.delay)

    return all_data


def main():
    parser = argparse.ArgumentParser(description="Simple web scraper")
    parser.add_argument("url", help="URL to scrape")
    parser.add_argument("--max-pages", type=int, default=10, help="Max pages to scrape (default: 10)")
    parser.add_argument("--delay", type=float, default=1.0, help="Delay between requests in seconds (default: 1.0)")
    parser.add_argument("--format", choices=["json", "csv"], default="json", help="Output format (default: json)")
    parser.add_argument("--output", default="scraped_data", help="Output filename without extension (default: scraped_data)")
    parser.add_argument("--follow-links", action="store_true", help="Follow links on the same domain")
    parser.add_argument("--selector", help="CSS selector to extract specific elements")

    args = parser.parse_args()

    config = ScraperConfig(
        url=args.url,
        max_pages=args.max_pages,
        delay=args.delay,
        output_format=args.format,
        output_file=args.output,
        follow_links=args.follow_links,
        selector=args.selector,
    )

    data = scrape(config)

    if config.output_format == "csv":
        save_csv(data, config.output_file)
    else:
        save_json(data, config.output_file)


if __name__ == "__main__":
    main()
