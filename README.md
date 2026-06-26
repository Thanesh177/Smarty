# Smarty

> An AI-powered social learning platform that combines short educational content, real-time discussions, quizzes, AI assistance, and cloud-native infrastructure.

![React](https://img.shields.io/badge/Frontend-React-blue)
![AWS](https://img.shields.io/badge/Cloud-AWS-orange)
![Terraform](https://img.shields.io/badge/IaC-Terraform-purple)
![Python](https://img.shields.io/badge/Backend-Python-green)
![Android](https://img.shields.io/badge/Mobile-Android-success)

---

# Overview

Smarty is a cloud-native educational platform designed to make learning interactive and engaging. The platform allows users to discover educational content, create AI-assisted learning posts, participate in real-time chat rooms, complete quizzes, receive personalized recommendations, and collaborate with other learners.

The application is built using a serverless AWS architecture and follows Infrastructure-as-Code principles using Terraform.

---

# Features

## Authentication

- Amazon Cognito authentication
- Google Sign-In
- Secure JWT authentication
- User profile management

---

## Learning Feed

- Educational short-form posts
- AI-generated content
- Image uploads
- Likes
- Comments
- Save posts
- Personal feed

---

## AI Features

- AI content generation
- AI explanations
- Translation
- Quiz generation
- Learning recommendations

---

## Community

- Public discussion rooms
- Real-time WebSocket chat
- Room invitations
- Join requests
- User moderation

---

## Quiz System

- AI generated quizzes
- Quiz history
- Progress tracking
- Cached questions
- Performance analytics

---

## Notifications

- Firebase Cloud Messaging
- Daily reminders
- Scheduled AI content
- Push notifications

---

# Architecture

```
                    React Web
                        │
                AWS Amplify Hosting
                        │
         ┌──────────────┴──────────────┐
         │                             │
     HTTP API                    WebSocket API
(API Gateway v2)            (API Gateway v2)
         │                             │
         └──────────────┬──────────────┘
                        │
                  AWS Lambda
                        │
      ┌──────────┬───────────┬──────────┐
      │          │           │          │
 DynamoDB      Cognito      S3     CloudFront
      │
 CloudWatch Logs
      │
EventBridge Scheduler
```

---

# Tech Stack

## Frontend

- React
- JavaScript
- CSS
- Vite

## Mobile

- Android
- Java
- Firebase Messaging

## Backend

- AWS Lambda
- Python
- Node.js

## Database

- Amazon DynamoDB

## Authentication

- Amazon Cognito
- Google OAuth

## Storage

- Amazon S3

## CDN

- Amazon CloudFront

## API

- API Gateway HTTP API
- API Gateway WebSocket API

## Infrastructure

- Terraform

---

# Infrastructure

Smarty infrastructure is fully managed using Terraform.

Managed resources include:

- Amplify
- Cognito
- Lambda
- DynamoDB
- S3
- CloudFront
- API Gateway
- CloudWatch Logs
- EventBridge Scheduler

Terraform uses a remote backend stored in Amazon S3.

---

# Project Structure

```
Smarty
│
├── android/
├── backend/
├── react/
├── smarty-terraform/
│   ├── environment/
│   ├── modules/
│   └── global/
├── lambda/
└── README.md
```

---

# AWS Services

- Amazon Amplify
- Amazon Cognito
- Amazon API Gateway
- AWS Lambda
- Amazon DynamoDB
- Amazon S3
- Amazon CloudFront
- Amazon CloudWatch
- Amazon EventBridge Scheduler

---

# Infrastructure as Code

This project was migrated from manually managed AWS resources to Terraform using an import-first migration strategy.

The migration included:

- Importing existing production resources
- Preventing accidental infrastructure destruction
- Remote Terraform state
- Modular Terraform architecture
- Production-safe resource management

---

# Security

- JWT Authentication
- Google OAuth
- IAM Roles
- Least privilege access
- Protected infrastructure using Terraform
- CloudFront CDN
- Secure file uploads

---

# Development

Clone the repository

```bash
git clone https://github.com/Thanesh177/Smarty.git
```

Install frontend

```bash
npm install
```

Run locally

```bash
npm run dev
```

Terraform

```bash
cd smarty-terraform/environment/prod

terraform init

terraform plan
```

---

# Future Improvements

- CI/CD with GitHub Actions
- AWS Secrets Manager
- Terraform OIDC authentication
- Automated Lambda deployments
- Monitoring dashboards
- Containerized workloads
- Multi-region deployment

---

# Author

**Thanesh Nadarajah**

Master's Student – Computer Science

Cloud • AWS • Terraform • React • Python • Serverless Architecture

GitHub:

https://github.com/Thanesh177

---

# License

This project is intended for educational and portfolio purposes.
