# File Management Platform

A modern, full-stack file management platform with a Java Spring Boot backend and a React + Material UI frontend. Features unified handling of local files, Amazon S3 storage, and PostgreSQL databases with an intuitive wizard-based interface.

https://github.com/user-attachments/assets/f1edb475-9ea2-4de6-9fa7-ef8736511584


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

### Step 1: Choose Data Source
- Select **Local Files** 📁 to upload from your computer
- Select **Amazon S3** 🖼️ to connect to your S3 bucket
- Select **PostgreSQL** 🐘 to connect to your database

### Step 2: Connect to Source

#### For Local Files:
- **Upload Button:** Click "Upload Files & Folders" to select files
- **Drag & Drop:** Drag files or entire folders directly into the drop zone
- **Folder Support:** Maintains complete folder structure automatically

#### For S3:
- Enter your **Access Key**, **Secret Key**, and **Region**
- Specify the **S3 Path** (e.g., `s3://my-bucket/folder/`)
- Click **Connect** to load your S3 file structure

#### For PostgreSQL:
- Enter your **Host**, **Port**, **Database**, **Username**, and **Password**
- Optionally specify a **Schema** (defaults to 'public')
- Click **Connect** to list all available tables and views


### Step 3: Select Files
- **Tree Navigation:** Expand folders to see contents
- **File Selection:** Use checkboxes to select individual files
- **Folder Selection:** Select entire folders with all contents
- **Filtering:** Use file type dropdown (All, CSV, JSON, PDF, Parquet, TXT, SQL)
- **Search:** Type to filter files by name or extension in real-time

#### PostgreSQL Table Previews
- **Click on Tables:** Click any table name to see its structure and sample data
- **Schema Information:** View column names, types, nullable status, defaults, and max lengths
- **Sample Data:** See the first 5 rows of actual data from the table
  
### Step 4: Import
- Review your selected files count
- Click **Import Selected Files** to process
- Monitor real-time progress with detailed status updates

### File Type Icons
-  **CSV** - Teal spreadsheet icon
-  **JSON** - Orange code icon  
-  **Parquet** - Dark blue data icon
-  **PDF** - Red document icon
-  **TXT** - Purple text icon
-  **SQL** - Orange code icon
-  **Folders** - Orange folder icon
-  **PostgreSQL Tables** - Blue table icon
-  **PostgreSQL Views** - Blue eye icon
-  **PostgreSQL Schemas** - Blue database icon

---
## Technical Architecture

### Backend (Spring Boot)
- **S3 Integration:** AWS SDK v2 with recursive file listing
- **PostgreSQL Integration:** JDBC connectivity with table schema and sample data retrieval
- **File Processing:** Unified handling for local, S3, and PostgreSQL data sources
- **Progress Tracking:** Real-time import progress with job management
- **RESTful API:** Clean endpoints for file operations
- **Enhanced Error Handling:** Specific HTTP status codes and user-friendly error messages for database connections

### Frontend (React + Material-UI)
- **Unified Data Processing:** Same code path for local, S3, and PostgreSQL data sources
- **Professional UI:** Logos and titles for each data source type
- **Tree View Component:** Recursive folder/file rendering with PostgreSQL object support
- **Table Previews:** Interactive PostgreSQL table schema and sample data display
- **Drag & Drop:** Advanced file upload with folder structure preservation
- **Enhanced Delete:** Consistent delete functionality across all data sources
- **State Management:** React hooks with optimized re-rendering
- **Responsive Design:** Mobile-friendly Material-UI components


## Project Structure

```
file-management-platform/
├── backend/                 # Spring Boot API
│   ├── src/main/java/io/backend/fileservice/
│   │   ├── FileController.java      # REST endpoints
│   │   ├── S3Service.java          # S3 operations
│   │   ├── FileService.java        # Local file operations
│   │   └── S3Request.java          # Request models
│   └── pom.xml                     # Maven dependencies
│
├── frontend/                # React application  
│   ├── src/
│   │   ├── components/
│   │   │   ├── StepWizard.js       # Main wizard component
│   │   │   ├── FileTree.js         # Tree view component
│   │   │   ├── LocalInput.js       # Local file upload
│   │   │   ├── S3Input.js          # S3 connection form
│   │   │   ├── PostgresInput.js    # PostgreSQL connection form
│   │   │   ├── TablePreviewDialog.js # PostgreSQL table previews
│   │   │   └── ProgressBar.js      # Import progress
│   │   ├── FileManager.js          # Legacy file manager
│   │   └── App.js                  # Main app component
│   ├── public/
│   │   ├── postgresql.svg          # PostgreSQL elephant logo
│   │   └── s3.png                  # Amazon S3 logo
│   └── package.json                # npm dependencies
│
└── README.md                       # This file
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
