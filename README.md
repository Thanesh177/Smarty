# Smarty Web Extension

A React + Vite web extension for an educational short-form content app. This frontend is structured to plug into the same backend/API used by a mobile app and is ready for AWS hosting.

## Included
- Vertical educational feed UI
- Login/register screens
- Profile page
- Saved posts page
- Content creator/upload page
- API client abstraction for auth/feed/posts/profile/reactions
- AWS-ready environment configuration
- Amplify/S3 + CloudFront hosting instructions

## Expected backend routes
This project assumes your backend exposes routes similar to:
- `POST /auth/login`
- `POST /auth/register`
- `GET /posts/feed`
- `GET /posts/:id`
- `POST /posts`
- `POST /posts/:id/like`
- `POST /posts/:id/save`
- `GET /users/me`
- `GET /users/me/saved`

Update the `src/api/endpoints.js` file if your route names differ.

## Setup
```bash
npm install
cp .env.example .env
npm run dev
```

## Build
```bash
npm run build
```
