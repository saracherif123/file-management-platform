import { FaFileCsv, FaFileAlt, FaFileCode, FaFile, FaFolder, FaFilePdf, FaTable, FaDatabase } from 'react-icons/fa';

// Icons can be found here: https://react-icons.github.io/react-icons/
export default function FileIconView({ type }) {
   type = type?.toUpperCase();

   if (type === 'CSV') { return <FaFileCsv color="#2a9d8f" style={{ marginTop: 4.5 }} />; }
   if (type === 'JSON') { return <FaFileCode color="#e76f51" style={{ marginTop: 4.5 }} />; }
   if (type === 'PARQUET') { return <FaFileAlt color="#264653" style={{ marginTop: 4.5 }} />; }
   if (type === 'PDF') { return <FaFilePdf color="#e74c3c" style={{ marginTop: 4.5 }} />; }
   if (type === 'TXT') { return <FaFileAlt color="#6d6875" style={{ marginTop: 4.5 }} />; }
   if (type === 'SQL') { return <FaFileCode color="#f4a261" style={{ marginTop: 4.5 }} />; }
   if (type === 'TABLE') { return <FaTable color="#f4a261" style={{ marginTop: 4.5 }} />; }
   if (type === 'DATABASE') { return <FaDatabase color="#000000ff" style={{ marginTop: 4.5 }} />; }
   if (type === 'FOLDER') { return <FaFolder color="#f4a261" style={{ marginTop: 4.5 }} />; }

   // Fallback icon
   return <FaFile style={{ marginTop: 4.5 }} />;
}
