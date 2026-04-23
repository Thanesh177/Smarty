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

## Deploy on AWS
### Option 1: AWS Amplify Hosting
1. Push this project to GitHub.
2. Open AWS Amplify.
3. Connect the repository.
4. Set environment variables from `.env.example`.
5. Build command: `npm ci && npm run build`
6. Output directory: `dist`

### Option 2: S3 + CloudFront
1. Run `npm run build`.
2. Upload `dist/` to an S3 bucket enabled for static hosting.
3. Put CloudFront in front of the bucket.
4. Configure custom error responses to redirect 403/404 to `/index.html` for React Router.

## Notes
- If your mobile app already uses API Gateway + Lambda + DynamoDB, this frontend can call the same API.
- If you use Cognito, replace the temporary local auth flow with your production token exchange logic.
