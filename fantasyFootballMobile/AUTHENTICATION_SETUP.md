# Authentication Setup Guide

This guide will help you set up the login system for the Fantasy Football Mobile app.

## Overview

The app now includes a login system where each team owner can only see their own players in the Player Stats page, and only their current week matchup in the Matchups page (while past weeks show all matchups).

## Setup Steps

### 1. Create User Accounts in Firebase Authentication

You have two options:

#### Option A: Use the Setup Script (Recommended)

1. Install Firebase Admin SDK:
   ```bash
   npm install firebase-admin
   ```

2. Download your Firebase service account key:
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save the JSON file as `serviceAccountKey.json` in the project root

3. Update the user emails in `setupUsers.js` to match your actual team owners' email addresses

4. Run the setup script:
   ```bash
   node setupUsers.js
   ```

#### Option B: Manual Creation

1. Go to Firebase Console → Authentication → Users
2. Click "Add User" for each team owner
3. Use the following email format: `{teamname}@example.com` (e.g., `paul@example.com`)

### 2. Update Email-to-Team Mapping

In both `PlayerStatsPage.js` and `MatchupsPage.js`, update the `emailToTeamMap` object to match your actual user emails:

```javascript
const emailToTeamMap = {
  'paul': 'Paul',
  'mick': 'Mick', 
  'steve': 'Steve',
  'jason': 'Jason',
  'mike': 'Mike',
  'chris': 'Chris',
  'mark': 'Mark',
  'john': 'John',
  // Add more mappings as needed
};
```

### 3. Test the Login System

1. Start the app: `expo start`
2. Try logging in with one of the created user accounts
3. Verify that:
   - Only the user's players appear in the Player Stats page
   - The Owners filter is removed from the filters
   - Only the user's current week matchup appears in Matchups page
   - Past weeks show all matchups

## Features

### Player Stats Page
- Users can only see players from their own team
- The Owners filter has been removed
- All other filters (Position, Team, Year, Week) remain functional

### Matchups Page
- Current week: Only shows the user's matchup
- Past weeks: Shows all matchups
- Users can still view historical data for all teams

### Rosters Page
- Remains unchanged - shows all team rosters
- This allows users to see other teams' rosters for strategic purposes

### Navigation
- Added logout functionality in the slide-out menu
- Shows user's email in the navbar
- Authentication state persists across app restarts

## Security Notes

- Users can only access their own team's data
- The app uses Firebase Authentication for secure login
- Passwords should be changed after initial setup
- Consider implementing password reset functionality

## Troubleshooting

### User can't see their players
- Check that the email-to-team mapping is correct
- Verify the team name matches exactly with the Firebase data
- Ensure the user account exists in Firebase Authentication

### Login fails
- Check that the user account exists in Firebase Authentication
- Verify the email and password are correct
- Check Firebase Console for any authentication errors

### Team mapping issues
- The team names in the mapping must exactly match the team names in your `fantasyTeams` collection
- Check the Firebase Console to see the exact team names 