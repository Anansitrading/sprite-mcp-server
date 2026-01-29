#!/bin/bash
cd /home/sprite/sprite-mcp-server
exec node dist/index.js "$@"
