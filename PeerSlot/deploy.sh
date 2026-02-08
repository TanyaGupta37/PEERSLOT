#!/bin/bash

# PeerSlot Production Deployment Script
# This script helps deploy the availability system to Firebase

echo "🚀 PeerSlot Availability System - Production Deployment"
echo "========================================================"
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found!"
    echo "📦 Installing Firebase CLI..."
    npm install -g firebase-tools
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install Firebase CLI"
        echo "💡 Please install manually: npm install -g firebase-tools"
        exit 1
    fi
    echo "✅ Firebase CLI installed"
fi

echo ""
echo "🔐 Step 1: Login to Firebase"
echo "----------------------------"
firebase login

if [ $? -ne 0 ]; then
    echo "❌ Firebase login failed"
    exit 1
fi

echo ""
echo "✅ Logged in to Firebase"
echo ""

# Navigate to project directory
cd "$(dirname "$0")"

echo "📂 Current directory: $(pwd)"
echo ""

echo "🔧 Step 2: Initialize Firebase (if needed)"
echo "-------------------------------------------"
read -p "Do you want to initialize Firebase? (y/n): " init_choice

if [ "$init_choice" = "y" ] || [ "$init_choice" = "Y" ]; then
    firebase init
fi

echo ""
echo "📤 Step 3: Deploy Firestore Rules"
echo "----------------------------------"
read -p "Deploy Firestore rules? (y/n): " rules_choice

if [ "$rules_choice" = "y" ] || [ "$rules_choice" = "Y" ]; then
    firebase deploy --only firestore:rules
    if [ $? -eq 0 ]; then
        echo "✅ Firestore rules deployed"
    else
        echo "❌ Failed to deploy Firestore rules"
    fi
fi

echo ""
echo "📊 Step 4: Deploy Firestore Indexes"
echo "------------------------------------"
read -p "Deploy Firestore indexes? (y/n): " indexes_choice

if [ "$indexes_choice" = "y" ] || [ "$indexes_choice" = "Y" ]; then
    firebase deploy --only firestore:indexes
    if [ $? -eq 0 ]; then
        echo "✅ Firestore indexes deployed"
        echo "⏳ Note: Indexes may take a few minutes to build"
    else
        echo "❌ Failed to deploy Firestore indexes"
    fi
fi

echo ""
echo "🌐 Step 5: Deploy to Firebase Hosting"
echo "--------------------------------------"
read -p "Deploy to Firebase Hosting? (y/n): " hosting_choice

if [ "$hosting_choice" = "y" ] || [ "$hosting_choice" = "Y" ]; then
    firebase deploy --only hosting
    if [ $? -eq 0 ]; then
        echo "✅ Deployed to Firebase Hosting"
        echo ""
        echo "🎉 Your app is live at:"
        echo "   https://peerslot-agile.web.app"
        echo "   https://peerslot-agile.firebaseapp.com"
    else
        echo "❌ Failed to deploy to hosting"
    fi
fi

echo ""
echo "========================================================"
echo "✅ Deployment process complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Go to Firebase Console: https://console.firebase.google.com/project/peerslot-agile"
echo "2. Enable Email/Password authentication"
echo "3. Create test users"
echo "4. Test the application"
echo ""
echo "📖 For detailed instructions, see:"
echo "   PRODUCTION_DEPLOYMENT_GUIDE.md"
echo ""
