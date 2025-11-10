"""
Blender version scraper for official builds
Fetches stable, daily, and experimental builds from official sources
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

class BlenderVersionParser(HTMLParser):
    """Parse Blender download pages to extract version links"""
    
    def __init__(self, base_url: str, version_type: str):
        super().__init__()
        self.base_url = base_url
        self.version_type = version_type
        self.versions = []
        self.current_tag = None
        self.current_attrs = {}
        
    def handle_starttag(self, tag, attrs):
        self.current_tag = tag
        self.current_attrs = dict(attrs)
        
        if tag == 'a' and 'href' in self.current_attrs:
            href = self.current_attrs['href']
            self.process_link(href)
    
    def process_link(self, href: str):
        """Process a link to extract version info"""
        if self.version_type == 'stable':
            self.process_stable_link(href)
        elif self.version_type == 'daily':
            self.process_daily_link(href)
        elif self.version_type == 'experimental':
            self.process_experimental_link(href)
    
    def process_stable_link(self, href: str):
        """Process stable release links"""
        # Pattern: blender-4.3.0-windows-x64.zip
        pattern = r'blender-(\d+\.\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z]+\d*)?)-windows-x64\.zip'
        match = re.search(pattern, href)
        
        if match:
            version = match.group(1)
            # Build full URL
            if href.startswith('http'):
                url = href
            else:
                url = urllib.parse.urljoin(self.base_url, href)
            
            # Extract major.minor for folder structure
            version_parts = version.split('.')
            if len(version_parts) >= 2:
                major_minor = f"{version_parts[0]}.{version_parts[1]}"
                # Ensure URL follows correct pattern
                expected_url = f"https://download.blender.org/release/Blender{major_minor}/blender-{version}-windows-x64.zip"
                
                self.versions.append({
                    "version": version,
                    "url": expected_url,
                    "type": "stable",
                    "date": None  # Will be populated if we can extract date
                })
    
    def process_daily_link(self, href: str):
        """Process daily build links"""
        # Skip SHA256 files and non-zip files
        if '.sha256' in href or not href.endswith('.zip'):
            return
            
        # Pattern for daily builds: blender-4.4.0-alpha+main.a1b2c3d4e5f6-windows.amd64-release.zip
        pattern = r'blender-(\d+\.\d+\.\d+(?:-[a-zA-Z]+)?(?:\+[^-]+)?(?:\.[a-f0-9]+)?)-windows\.amd64-release\.zip'
        match = re.search(pattern, href)
        
        if match:
            version = match.group(1)
            if href.startswith('http'):
                url = href
            else:
                url = urllib.parse.urljoin(self.base_url, href)
            
            # Check for duplicates
            existing_versions = [v['version'] for v in self.versions]
            if version not in existing_versions:
                self.versions.append({
                    "version": version,
                    "url": url,
                    "type": "daily",
                    "date": None  # Could extract from file timestamp if available
                })
    
    def process_experimental_link(self, href: str):
        """Process experimental build links"""
        # Skip SHA256 files and non-zip files
        if '.sha256' in href or not href.endswith('.zip'):
            return
            
        # Pattern for experimental: similar to daily but may have branch names
        pattern = r'blender-(\d+\.\d+\.\d+(?:-[a-zA-Z]+)?(?:\+[^-]+)?(?:\.[a-f0-9]+)?)-windows\.amd64-release\.zip'
        match = re.search(pattern, href)
        
        if match:
            version = match.group(1)
            if href.startswith('http'):
                url = href
            else:
                url = urllib.parse.urljoin(self.base_url, href)
            
            # Check for duplicates
            existing_versions = [v['version'] for v in self.versions]
            if version not in existing_versions:
                self.versions.append({
                    "version": version,
                    "url": url,
                    "type": "experimental",
                    "date": None
                })

def fetch_stable_versions() -> List[Dict[str, Any]]:
    """Fetch stable versions from download.blender.org"""
    try:
        log("Fetching stable versions...")
        
        # Get main release page to find version folders
        main_url = "https://download.blender.org/release/"
        req = urllib.request.Request(main_url)
        req.add_header('User-Agent', 'Blender-Launcher/1.0')
        
        with urllib.request.urlopen(req) as response:
            content = response.read().decode('utf-8')
        
        # Find Blender version folders (Blender4.3, Blender4.2, etc.)
        folder_pattern = r'href="(Blender\d+\.\d+)/"'
        folders = re.findall(folder_pattern, content)
        
        all_versions = []
        
        # Sort folders by version number (newest first) and take recent ones
        def folder_version_key(folder):
            try:
                # Extract version number from "BlenderX.Y"
                version_match = re.match(r'Blender(\d+)\.(\d+)', folder)
                if version_match:
                    major, minor = version_match.groups()
                    return (int(major), int(minor))
                return (0, 0)
            except:
                return (0, 0)
        
        folders.sort(key=folder_version_key, reverse=True)
        recent_folders = folders[:15]  # Take the 15 most recent versions
        
        for folder in recent_folders:
            folder_url = f"{main_url}{folder}/"
            try:
                req = urllib.request.Request(folder_url)
                req.add_header('User-Agent', 'Blender-Launcher/1.0')
                
                with urllib.request.urlopen(req) as response:
                    folder_content = response.read().decode('utf-8')
                
                parser = BlenderVersionParser(folder_url, 'stable')
                parser.feed(folder_content)
                all_versions.extend(parser.versions)
                
            except Exception as e:
                log(f"Error fetching folder {folder}: {e}")
                continue
        
        # Sort versions by version number (newest first)  
        def version_key(v):
            try:
                parts = v['version'].split('.')
                return [int(p) for p in parts if p.isdigit()]
            except:
                return [0]
        
        all_versions.sort(key=version_key, reverse=True)
        log(f"Found {len(all_versions)} stable versions")
        
        return all_versions
        
    except Exception as e:
        error(f"Failed to fetch stable versions: {e}")
        return []

def fetch_daily_versions() -> List[Dict[str, Any]]:
    """Fetch daily builds from builder.blender.org"""
    try:
        log("Fetching daily builds...")
        
        url = "https://builder.blender.org/download/daily/"
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'Blender-Launcher/1.0')
        
        with urllib.request.urlopen(req) as response:
            content = response.read().decode('utf-8')
        
        parser = BlenderVersionParser(url, 'daily')
        parser.feed(content)
        
        # Sort by version (newest first)
        parser.versions.sort(key=lambda x: x['version'], reverse=True)
        log(f"Found {len(parser.versions)} daily builds")
        return parser.versions[:50]  # Limit to 50 most recent
        
    except Exception as e:
        error(f"Failed to fetch daily builds: {e}")
        return []

def fetch_experimental_versions() -> List[Dict[str, Any]]:
    """Fetch experimental builds from builder.blender.org"""
    try:
        log("Fetching experimental builds...")
        
        url = "https://builder.blender.org/download/experimental/"
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'Blender-Launcher/1.0')
        
        with urllib.request.urlopen(req) as response:
            content = response.read().decode('utf-8')
        
        parser = BlenderVersionParser(url, 'experimental')
        parser.feed(content)
        
        # Sort by version (newest first)
        parser.versions.sort(key=lambda x: x['version'], reverse=True)
        log(f"Found {len(parser.versions)} experimental builds")
        return parser.versions[:50]  # Limit to 50 most recent
        
    except Exception as e:
        error(f"Failed to fetch experimental builds: {e}")
        return []

def main():
    if len(sys.argv) < 2:
        error("Usage: fetch_blender_versions.py <stable|daily|experimental|all>")
        sys.exit(1)
    
    version_type = sys.argv[1].lower()
    
    log("Starting Blender version fetch...")
    
    if version_type == 'stable' or version_type == 'all':
        stable_versions = fetch_stable_versions()
        versions_found('stable', stable_versions)
    
    if version_type == 'daily' or version_type == 'all':
        daily_versions = fetch_daily_versions()
        versions_found('daily', daily_versions)
    
    if version_type == 'experimental' or version_type == 'all':
        experimental_versions = fetch_experimental_versions()
        versions_found('experimental', experimental_versions)
    
    log("Version fetch completed")

if __name__ == '__main__':
    main()