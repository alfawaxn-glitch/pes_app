# PES | Pro Esports System

A futuristic, high-performance esports tournament management platform built with a Liquid Glass UI. This application allows for real-time tournament tracking, player management, and automated bracket progression.

## Features
- **Premium Design**: Dark transparent background, neon red accents, and smooth blur animations.
- **FIFA-style Brackets**: Admin can click players to advance them from Quarter-Finals to Finals in real-time.
- **Real-time Sync**: All updates (new users, tournament changes, winner selections) reflect instantly for all users via Socket.io.
- **Secure Authentication**: JWT-based login with profile picture upload using Multer.
- **Admin Control**: Special access for `pesadmin` to manage events and users.

## Prerequisites
- **Node.js**: Version 16.x or higher
- **MongoDB**: A local instance running at `mongodb://localhost:27017` or a MongoDB Atlas URI.

## Installation

1.  **Extract the files** into a project directory.
2.  **Install dependencies**:
    