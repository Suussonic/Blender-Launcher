"""
Blender version scraper for official builds
Fetches stable, daily, and patch builds from official sources
Uses the new archive URLs for improved data access
"""
import sys
import json
import urllib.request
import urllib.parse
import re
from html.parser import HTMLParser
from typing import List, Dict, Any, Optional
from datetime import datetime
import dateutil.parser

def log(msg):
    """Log message to stdout for IPC"""
    print(json.dumps({"type": "log", "message": msg}), flush=True)

def error(msg):
    """Send error"""
    print(json.dumps({"type": "error", "message": msg}), flush=True)

def versions_found(version_type: str, versions: List[Dict[str, Any]]):
    """Send found versions"""
    print(json.dumps({"type": "versions", "version_type": version_type, "versions": versions}), flush=True)

class BlenderArchiveParser(HTMLParser):
    """Parse Blender archive pages to extract version information"""
    
    def __init__(self, version_type: str):
        super().__init__()
        self.version_type = version_type
        self.versions = []
        self.in_version_row = False
        self.current_version_data = {}
        self.current_data_type = None
        self.html_content = ""
        self.current_date = None
        
    def set_html_content(self, content: str):
        """Store HTML content for date extraction"""
        self.html_content = content
        
    def extract_date_from_html(self):
        """Extract current date being processed from HTML context"""
        if self.current_date:
            return self.current_date
        return datetime.now().strftime('%d %b %H:%M')
        
    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        
        # Look for download links to Windows builds
        if tag == 'a' and 'href' in attrs_dict:
            href = attrs_dict['href']
            if self.is_windows_build(href):
                # Try to extract date from the URL or nearby context
                self.extract_date_from_url(href)
                self.process_windows_build(href)
                
    def handle_data(self, data):
        """Handle text data to extract dates"""
        # Look for date patterns in the HTML text
        date_pattern = r'(\d{1,2} \w{3} \d{2}:\d{2})'
        m = re.search(date_pattern, data.strip())
        if m:
            raw = m.group(1)
            try:
                # Parse like '14 Nov 02:10' using current year as default
                dt = dateutil.parser.parse(raw, default=datetime(datetime.now().year, 1, 1))
                self.current_date = dt.isoformat()
            except Exception:
                self.current_date = raw
            
    def extract_date_from_url(self, href: str):
        """Try to extract date information from URL or context"""
        # Look for date patterns in the URL itself
        date_patterns = [
            r'(\d{2} \w{3} \d{2}:\d{2})',  # 14 Nov 02:10
            r'(\d{4}-\d{2}-\d{2})',        # 2024-11-14
            r'(\w{3} \d{1,2})',             # Nov 14
        ]
        
        for pattern in date_patterns:
            match = re.search(pattern, href)
            if match:
                raw = match.group(1)
                try:
                    dt = dateutil.parser.parse(raw, default=datetime(datetime.now().year, 1, 1))
                    self.current_date = dt.isoformat()
                except Exception:
                    self.current_date = raw
                return
    
    def is_windows_build(self, href: str) -> bool:
        """Check if link is a Windows build"""
        return ('windows' in href.lower() and 
                'amd64' in href.lower() and 
                href.endswith('.zip'))
    
    def process_windows_build(self, href: str):
        """Extract version info from Windows build URL"""
        # Parse different URL patterns for patch and daily builds
        if self.version_type == 'patch':
            self.process_patch_build(href)
        elif self.version_type == 'daily':
            self.process_daily_build(href)
            
    def process_patch_build(self, href: str):
        """Process patch build URL"""
        # Pattern: blender-X.X.X-alpha+main-PRXXXXX.hash-windows.amd64-release.zip
        pattern = r'blender-(\d+\.\d+\.\d+)-(\w+)\+main-([^.]+)\.([^-]+)-windows\.amd64-release\.zip'
        match = re.search(pattern, href)
        
        if match:
            version = match.group(1)
            variant = match.group(2)  # alpha, beta, rc
            pr_info = match.group(3)  # PR number or branch info
            commit_hash = match.group(4)
            
            # Create unique version identifier with hash
            unique_version = f"{version}-{variant} ({commit_hash[:8]})"
            
            version_info = {
                'version': unique_version,
                'url': href,
                'date': self.extract_date_from_html(),
                'type': f"{variant.title()} Patch",
                'description': f"Patch build {pr_info}",
                'hash': commit_hash[:8],
                'architecture': 'x64',
                'pr': pr_info
            }
            
            # Only add if not already present (avoid duplicates)
            if not any(v['hash'] == version_info['hash'] for v in self.versions):
                self.versions.append(version_info)
    
    def process_daily_build(self, href: str):
        """Process daily build URL"""
        # Pattern: blender-X.X.X-type+branch.hash-windows.amd64-release.zip
        pattern = r'blender-(\d+\.\d+\.\d+)-(\w+)\+([^.]+)\.([^-]+)-windows\.amd64-release\.zip'
        match = re.search(pattern, href)
        
        if match:
            version = match.group(1)
            build_type = match.group(2)  # alpha, beta
            branch = match.group(3)      # main, v50, etc.
            commit_hash = match.group(4)
            
            # Create unique version identifier with hash
            unique_version = f"{version}-{build_type} ({commit_hash[:8]})"
            
            version_info = {
                'version': unique_version,
                'url': href,
                'date': self.extract_date_from_html(),
                'type': f"{build_type.title()} Daily",
                'description': f"Daily build from {branch}",
                'hash': commit_hash[:8],
                'architecture': 'x64',
                'branch': branch
            }
            
            # Only add if not already present
            if not any(v['hash'] == version_info['hash'] for v in self.versions):
                self.versions.append(version_info)


def fetch_stable_versions() -> List[Dict[str, Any]]:
    """Fetch stable Blender versions from official releases"""
    try:
        log("Fetching stable versions from download.blender.org...")
        
        # Keep using the main release page for stable versions
        url = "https://download.blender.org/release/"
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'Blender-Launcher/1.0')
        
        with urllib.request.urlopen(req) as response:
            html_content = response.read().decode('utf-8')
        
        # Extract version folders from HTML
        versions = []
        folder_pattern = r'href="(Blender(\d+\.\d+))/"'
        matches = re.findall(folder_pattern, html_content)
        
        for folder_name, version in matches:
            version_info = {
                'version': version,
                'url': f"https://download.blender.org/release/{folder_name}/blender-{version}-windows-x64.zip",
                'date': 'Official Release',
                'type': 'Stable Release',
                'description': f'Blender {version} stable release',
                'architecture': 'x64'
            }
            versions.append(version_info)
        
        # Sort by version number (descending)
        def version_sort_key(v):
            try:
                parts = v['version'].split('.')
                return [int(p) for p in parts]
            except:
                return [0]
        
        stable_versions = sorted(versions, key=version_sort_key, reverse=True)
        
        log(f"Found {len(stable_versions)} stable versions")
        return stable_versions
        
    except Exception as e:
        error(f"Failed to fetch stable versions: {str(e)}")
        return []

def fetch_patch_versions() -> List[Dict[str, Any]]:
    """Fetch patch build versions from archive"""
    try:
        log("Fetching patch builds from builder.blender.org archive...")
        
        # Use the new archive URL for patch builds
        url = "https://builder.blender.org/download/patch/archive/"
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'Blender-Launcher/1.0')
        
        with urllib.request.urlopen(req) as response:
            html_content = response.read().decode('utf-8')
        
        # Extract date and version info using regex on the raw HTML
        versions = []
        
        # Pattern to match table rows with version info
        # Looking for: Blender version, variant, date, architecture, download link
        row_pattern = r'<tr[^>]*>.*?blender-(\d+\.\d+\.\d+)-(\w+)\+main-([^.]+)\.([^-]+)-windows\.(\w+)-release\.zip.*?(\d{2} \w{3} \d{2}:\d{2}).*?</tr>'
        matches = re.findall(row_pattern, html_content, re.DOTALL)
        
        for match in matches:
            version, variant, pr_info, commit_hash, architecture, date_str = match
            
            # Build the download URL
            download_url = f"https://cdn.builder.blender.org/download/patch/archive/blender-{version}-{variant}+main-{pr_info}.{commit_hash}-windows.{architecture}-release.zip"
            
            # Map architecture names
            arch_display = 'x64' if architecture == 'amd64' else ('ARM64' if architecture == 'arm64' else architecture.upper())
            
            unique_version = f"{version}-{variant} ({commit_hash[:8]})"
            
            # Try to parse the found date into ISO format (add current year if missing)
            try:
                parsed_dt = dateutil.parser.parse(date_str, default=datetime(datetime.now().year, 1, 1))
                date_iso = parsed_dt.isoformat()
            except Exception:
                date_iso = date_str

            version_info = {
                'version': unique_version,
                'url': download_url,
                'date': date_iso,
                'type': f"{variant.title()} Patch",
                'description': f"Patch build {pr_info}",
                'hash': commit_hash[:8],
                'architecture': arch_display,
                'pr': pr_info
            }

            versions.append(version_info)
        
        # If regex parsing failed, fall back to HTML parser
        if not versions:
            parser = BlenderArchiveParser('patch')
            parser.set_html_content(html_content)
            parser.feed(html_content)
            versions = parser.versions
        
        # Sort and limit patch versions (most recent first)
        patch_versions = sorted(versions, key=lambda x: x.get('date', ''), reverse=True)[:15]
        
        log(f"Found {len(patch_versions)} patch builds")
        return patch_versions
        
    except Exception as e:
        error(f"Failed to fetch patch versions: {str(e)}")
        return []

def fetch_daily_versions() -> List[Dict[str, Any]]:
    """Fetch daily build versions from archive"""
    try:
        log("Fetching daily builds from builder.blender.org archive...")
        
        # Use the new archive URL for daily builds
        url = "https://builder.blender.org/download/daily/archive/"
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'Blender-Launcher/1.0')
        
        with urllib.request.urlopen(req) as response:
            html_content = response.read().decode('utf-8')
        
        # Extract date and version info using regex on the raw HTML
        versions = []
        
        # Pattern to match table rows with version info - capture ALL Windows builds (any architecture)
        row_pattern = r'<tr[^>]*>.*?blender-(\d+\.\d+\.\d+)-(\w+)\+([^.]+)\.([^-]+)-windows\.(\w+)-release\.zip.*?(\d{2} \w{3} \d{2}:\d{2}).*?</tr>'
        matches = re.findall(row_pattern, html_content, re.DOTALL)
        
        for match in matches:
            version, build_type, branch, commit_hash, architecture, date_str = match
            
            # Build the download URL
            download_url = f"https://cdn.builder.blender.org/download/daily/archive/blender-{version}-{build_type}+{branch}.{commit_hash}-windows.{architecture}-release.zip"
            
            # Map architecture names
            arch_display = 'x64' if architecture == 'amd64' else ('ARM64' if architecture == 'arm64' else architecture.upper())
            
            unique_version = f"{version}-{build_type} ({commit_hash[:8]})"
            # Try to parse the found date into ISO format (add current year if missing)
            try:
                parsed_dt = dateutil.parser.parse(date_str, default=datetime(datetime.now().year, 1, 1))
                date_iso = parsed_dt.isoformat()
            except Exception:
                date_iso = date_str

            version_info = {
                'version': unique_version,
                'url': download_url,
                'date': date_iso,
                'type': f"{build_type.title()} Daily",
                'description': f"Daily build from {branch}",
                'hash': commit_hash[:8],
                'architecture': arch_display,
                'branch': branch
            }

            versions.append(version_info)
        
        # If regex parsing failed, fall back to HTML parser
        if not versions:
            parser = BlenderArchiveParser('daily')
            parser.set_html_content(html_content)
            parser.feed(html_content)
            versions = parser.versions
        
        # Sort daily versions (most recent first) - use datetime objects for proper sorting
        def sort_key(v):
            date_val = v.get('date', '')
            if not date_val:
                return datetime.min
            try:
                # Try to parse as ISO datetime
                return dateutil.parser.parse(date_val)
            except:
                return datetime.min
        
        daily_versions = sorted(versions, key=sort_key, reverse=True)
        
        log(f"Found {len(daily_versions)} daily builds")
        return daily_versions
        
    except Exception as e:
        error(f"Failed to fetch daily versions: {str(e)}")
        return []



def main():
    if len(sys.argv) < 2:
        error("Usage: fetch_blender_versions.py <stable|daily|patch|all>")
        sys.exit(1)
    
    version_type = sys.argv[1].lower()
    
    log("Starting Blender version fetch...")
    
    if version_type == 'stable' or version_type == 'all':
        stable_versions = fetch_stable_versions()
        versions_found('stable', stable_versions)
    
    if version_type == 'daily' or version_type == 'all':
        daily_versions = fetch_daily_versions()
        versions_found('daily', daily_versions)
    
    if version_type == 'patch' or version_type == 'all':
        patch_versions = fetch_patch_versions()
        versions_found('patch', patch_versions)
    
    log("Version fetch completed")

if __name__ == '__main__':
    main()