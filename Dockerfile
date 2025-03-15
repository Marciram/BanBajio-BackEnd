FROM node:18-slim

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy local code to the container
COPY . .

# Make port available to the world outside this container
EXPOSE 8080

# Set the environment variable for port
ENV PORT=8080

# Run the app when the container launches
CMD ["npm", "start"]