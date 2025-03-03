# LEONARDO API TESTING

This is a **ERN (Express, React, Node.js)** stack application with separate `client` and `server` folders.

## Project Structure

```
│── /client        # React frontend
│── /server        # Express backend
```

## Getting Started

### Prerequisites

Ensure you have the following installed:

- **Node.js** (LTS version recommended)
- **npm** or **yarn**

### Installation

1. **Clone the repository:**
   ```sh
   git clone https://github.com/Mihirjataniya/Leonardo-api-testing
   ```

2. **Install dependencies:**
   ```sh
   cd client
   npm install
   cd ../server
   npm install
   ```

### Environment Variables

The `server/.env` file must contain:

```
API_KEY=your_api_key_here
```

Replace `your_api_key_here` with the actual API key.

### Running the Application

#### Start the server
```sh
cd server
node index.js
```

#### Start the client
```sh
cd client
npm run dev
```

The frontend should now be accessible at `http://localhost:5173` and the backend at `http://localhost:5000` (or your configured port).




