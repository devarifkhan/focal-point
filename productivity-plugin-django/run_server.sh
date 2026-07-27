#!/bin/bash

# Start the Django server with WebSocket support
echo "Starting Django server with WebSocket support..."
daphne -b 0.0.0.0 -p 8000 productivity_plugin_api.asgi:application