#!/bin/bash

# Kill all child processes on exit
trap 'kill $(jobs -p)' EXIT

echo "Starting Backend..."
cd backend
go run . &
BACKEND_PID=$!

echo "Starting Frontend..."
cd ../frontend
npm run dev -- --host &
FRONTEND_PID=$!

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
