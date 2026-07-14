// Use environment variable for API URL, fallback to deployed backend
const server = process.env.REACT_APP_API_URL || "https://meetflow-z69w.onrender.com";

export default server;
