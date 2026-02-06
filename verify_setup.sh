#!/bin/bash
# Quick verification script to check your setup

echo "🔍 Verifying Setup..."
echo ""

# Check Railway backend
RAILWAY_URL="https://videogenerator-production.up.railway.app"
echo "1. Testing Railway backend..."
if curl -s "$RAILWAY_URL/health" > /dev/null 2>&1; then
    HEALTH_RESPONSE=$(curl -s "$RAILWAY_URL/health")
    if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
        echo "   ✅ Railway backend is healthy"
    else
        echo "   ⚠️  Railway backend responded but: $HEALTH_RESPONSE"
    fi
else
    echo "   ❌ Railway backend is not accessible (502 or connection error)"
fi
echo ""

# Check env files
echo "2. Checking environment files..."
if [ -f ".env.local" ]; then
    echo "   ✅ Root .env.local exists"
    if grep -q "VITE_API_URL" .env.local; then
        API_URL=$(grep "VITE_API_URL" .env.local | cut -d '=' -f2)
        echo "   ✅ VITE_API_URL is set to: $API_URL"
    else
        echo "   ⚠️  VITE_API_URL not found in root .env.local"
    fi
else
    echo "   ⚠️  Root .env.local not found"
fi

if [ -f "frontend/.env.local" ]; then
    echo "   ✅ Frontend .env.local exists"
    if grep -q "VITE_API_URL" frontend/.env.local; then
        API_URL=$(grep "VITE_API_URL" frontend/.env.local | cut -d '=' -f2)
        echo "   ✅ VITE_API_URL is set to: $API_URL"
    else
        echo "   ⚠️  VITE_API_URL not found in frontend/.env.local"
    fi
else
    echo "   ⚠️  Frontend .env.local not found"
fi
echo ""

# Check if frontend is running
echo "3. Checking frontend dev server..."
if lsof -i :5173 > /dev/null 2>&1; then
    echo "   ✅ Frontend dev server is running on port 5173"
    echo "   💡 If you just updated .env.local, restart the dev server!"
else
    echo "   ⚠️  Frontend dev server is not running"
    echo "   💡 Start it with: cd frontend && npm run dev"
fi
echo ""

echo "📝 Next Steps:"
echo "   1. If Railway backend is down (502), check Railway logs and add missing env vars"
echo "   2. If VITE_API_URL is set, restart your frontend dev server"
echo "   3. Check browser console for connection errors"
