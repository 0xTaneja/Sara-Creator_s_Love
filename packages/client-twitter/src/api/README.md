# Sara API Server

This API server provides endpoints to fetch creator token data from MongoDB.

## Endpoints

### GET /api/tokens
Returns a list of all creator tokens.

### GET /api/tokens/:id
Returns a specific creator token by its MongoDB ID.

## Running the Server

To start the API server:

```bash
npm run start-api
```

The server will run on port 3001 by default. You can change the port by setting the `PORT` environment variable.

## Integration with Frontend

The Sara client application is configured to fetch token data from this API server. Make sure the server is running before starting the client application.

## Development

During development, if the API server is not available, the client will fall back to using mock data.

## Environment Variables

- `PORT`: The port to run the server on (default: 3001)
- `MONGODB_URI`: The MongoDB connection string 