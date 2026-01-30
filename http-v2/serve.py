#!/usr/bin/env python3
"""
Simple SPA-compatible HTTP server.
Serves static files, but falls back to index.html for unknown paths (SPA routing).
"""

import http.server
import socketserver
import os

PORT = 8080

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    # Follow symlinks
    def translate_path(self, path):
        result = super().translate_path(path)
        # Resolve symlinks to their real path
        if os.path.islink(result):
            result = os.path.realpath(result)
        return result
    
    def do_GET(self):
        # Get the file path
        path = self.path.split('?')[0]  # Remove query string
        
        # Check if it's a real file or directory (following symlinks)
        file_path = self.translate_path(path)
        
        # Use lexists to check if symlink exists, then realpath to resolve
        if os.path.lexists(file_path):
            real_path = os.path.realpath(file_path)
            if os.path.exists(real_path) and (os.path.isfile(real_path) or os.path.isdir(real_path)):
                # Serve the actual file/directory
                return super().do_GET()
        
        # Check if path has a file extension - if so, it's a real file request that failed
        if '.' in os.path.basename(path):
            # Return 404 for actual file requests that don't exist
            self.send_error(404, f"File not found: {path}")
            return
        
        # SPA fallback: serve index.html for unknown paths (likely routes)
        self.path = '/index.html'
        return super().do_GET()
    
    def end_headers(self):
        # Add cache-control for development
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    with socketserver.TCPServer(("", PORT), SPAHandler) as httpd:
        print(f"SPA Server running at http://localhost:{PORT}")
        print("Press Ctrl+C to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
