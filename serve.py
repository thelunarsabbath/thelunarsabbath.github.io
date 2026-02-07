#!/usr/bin/env python3
"""
Simple SPA-compatible HTTP server.
Serves static files, but falls back to index.html for unknown paths (SPA routing).

Port: use PORT=3000 python serve.py, or python serve.py 3000, or default 8080.
Ctrl+C shuts down and releases the port.
"""

import http.server
import socketserver
import os
import signal
import sys

DEFAULT_PORT = 8080

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
        
        # Only 404 when it looks like a static file request (known extension) that doesn't exist.
        # Paths like /reader/multiverse/Gen.1.15/Dan.9.24 have dots but are SPA routes, not files.
        basename = os.path.basename(path.rstrip('/'))
        static_extensions = ('.html', '.htm', '.js', '.css', '.json', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.txt', '.pdf', '.wasm', '.map')
        if basename and any(basename.lower().endswith(ext) for ext in static_extensions):
            self.send_error(404, f"File not found: {path}")
            return

        # SPA fallback: serve index.html for unknown paths (likely routes)
        self.path = '/index.html'
        return super().do_GET()
    
    def end_headers(self):
        # Add cache-control for development
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

def get_local_ip():
    """Get the local network IP address"""
    import socket
    try:
        # Connect to an external address to determine local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "unknown"

def get_port():
    if len(sys.argv) > 1:
        try:
            return int(sys.argv[1])
        except ValueError:
            print(f"Invalid port: {sys.argv[1]}", file=sys.stderr)
            sys.exit(1)
    return int(os.environ.get('PORT', DEFAULT_PORT))


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    port = get_port()

    # Allow rebinding the port immediately after shutdown (avoids "Address already in use")
    class ReusableTCPServer(socketserver.TCPServer):
        allow_reuse_address = True

    with ReusableTCPServer(("0.0.0.0", port), SPAHandler) as httpd:
        local_ip = get_local_ip()
        print(f"SPA Server running at:")
        print(f"  Local:   http://localhost:{port}")
        print(f"  Network: http://{local_ip}:{port}")
        print("\nPress Ctrl+C to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            httpd.shutdown()
            print("\nServer stopped.")
