# BlogSpace - Blog Management System

A full-stack blog app built for the Cognetix Full Stack Developer Internship (Intermediate stage).

Users can register, log in, and create, edit and delete their own blog posts. Everyone can read, search and filter posts.

## Features

- Secure registration and login (bcrypt password hashing, JWT stored in an httpOnly cookie)
- Create, edit and delete posts (only the author can change or delete a post)
- Search posts, filter by category, click a tag to filter, pagination
- RESTful API with Node.js, Express and MongoDB (Mongoose)
- Friendly error handling: invalid input, wrong login, expired session, server or database down
- Responsive and accessible UI (keyboard friendly, labelled form fields, skip link)
- Security basics: helmet, rate limiting on login, input validation, XSS-safe rendering

## Tech stack

Node.js, Express, MongoDB with Mongoose, plain HTML/CSS/JavaScript frontend.

## Setup

1. Install dependencies

   ```bash
   npm install
   ```

2. Create your `.env` file (copy `.env.example` and fill in the values)

   ```
   PORT=3000
   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/blogspace
   JWT_SECRET=<a long random string, at least 16 characters>
   ```

   You can use a free MongoDB Atlas cluster, or a local MongoDB (`mongodb://127.0.0.1:27017/blogspace`).

3. Start the server

   ```bash
   npm start
   ```

4. Open http://localhost:3000

## API

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | /api/auth/register | - | Create an account |
| POST | /api/auth/login | - | Log in |
| POST | /api/auth/logout | - | Log out |
| GET | /api/auth/me | yes | Current user |
| GET | /api/posts?search=&category=&tag=&page= | - | List posts |
| GET | /api/posts/categories | - | List categories |
| GET | /api/posts/:id | - | Read one post |
| POST | /api/posts | yes | Create a post |
| PUT | /api/posts/:id | yes (author) | Edit a post |
| DELETE | /api/posts/:id | yes (author) | Delete a post |

## Project structure

```
server.js          Express app and startup
models/            Mongoose models (User, Post)
routes/            auth and posts routes
middleware/auth.js Login check
public/            Frontend (index.html, style.css, app.js)
```

## Author

Built by Lingadarini as part of the Cognetix internship program.
