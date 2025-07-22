# File Management Platform

A full-stack file management platform with a Java Spring Boot backend and a React + Material UI frontend.  
Supports local file browsing, selection, and future S3 integration.

---

## Features

- **Source selection:** Choose between Local and S3 (Amazon Simple Storage Service).
- **File explorer:** Tree view for navigating and selecting files/folders.
- **Search and filter:** Quickly find files by name or type.
- **Upload, download, delete:** Manage files directly from the UI.
- **Load selected files:** Send a list of files to the backend for further processing.
- **Modern UI:** Built with React and Material UI.

---

## Getting Started

### Prerequisites

- Java 17+
- Maven
- Node.js (v18+) and npm

---

### Backend (Spring Boot)

1. **Navigate to the backend directory:**
   ```sh
   cd backend
   ```

2. **Run the backend server:**
   ```sh
   mvn spring-boot:run
   ```
   The backend will start on [http://localhost:8080](http://localhost:8080).

---

### Frontend (React)

1. **Navigate to the frontend directory:**
   ```sh
   cd frontend
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Start the React app:**
   ```sh
   npm start
   ```
   The frontend will open at [http://localhost:3000](http://localhost:3000).

---

## Usage

- **Select source:** Use the dropdown to choose "Local" or "S3".
- **Browse files:** Navigate folders, select files/folders with checkboxes.
- **Search/filter:** Use the search bar and file type filter.
- **Load:** Click "Load" to send selected files to the backend.
- **Upload:** Use the "Search Files" button to upload new files (local only).
- **Download/Delete:** Use the icons next to each file.

---

## Project Structure

```
file-management-platform/
  backend/    # Spring Boot backend
  frontend/   # React frontend
```
